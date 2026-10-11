/**
 * Clerk Backend helpers — server-side account provisioning (spec §4, §5).
 *
 * The project already talks to Clerk's REST API directly with the secret key
 * (see scripts/link-clerk-users.ts); the same thin wrapper is reused here so
 * there is no second authentication system. Secrets are never logged.
 */

const SECRET = process.env.CLERK_SECRET_KEY;

export class ClerkAdminError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ClerkAdminError";
  }
}

export function clerkConfigured(): boolean {
  return Boolean(SECRET);
}

async function clerk<T>(path: string, init?: RequestInit): Promise<T> {
  if (!SECRET) throw new ClerkAdminError(0, "CLERK_SECRET_KEY is not configured");
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${SECRET}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new ClerkAdminError(res.status, `clerk ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export type ClerkUserLite = {
  id: string;
  email_addresses?: { email_address: string }[];
  password_enabled?: boolean;
  external_accounts?: { provider?: string }[];
};

/** Clerk's `?email_address[]=` filter is unreliable (and paged) — scan all pages. */
export async function findClerkUserByEmail(email: string): Promise<ClerkUserLite | undefined> {
  const target = email.toLowerCase();
  let offset = 0;
  for (;;) {
    const page = await clerk<ClerkUserLite[]>(`/users?limit=100&offset=${offset}`);
    if (!Array.isArray(page) || page.length === 0) return undefined;
    const match = page.find((u) => u.email_addresses?.some((e) => e.email_address?.toLowerCase() === target));
    if (match) return match;
    if (page.length < 100) return undefined;
    offset += 100;
  }
}

/**
 * How does this account actually authenticate? Password-provisioned university
 * accounts use the password form; accounts created through Google have no
 * password at all and must use the Google button — the sign-in form tells the
 * user which one applies instead of leaving them with a raw Clerk error.
 */
export async function getClerkAuthSummary(
  email: string,
): Promise<{ passwordEnabled: boolean; googleLinked: boolean } | undefined> {
  const user = await findClerkUserByEmail(email);
  if (!user) return undefined;
  return {
    passwordEnabled: user.password_enabled === true,
    googleLinked: (user.external_accounts ?? []).some((a) => a.provider === "oauth_google"),
  };
}

/**
 * Secure account activation: the account holder receives Clerk's invitation
 * email and sets their own password (never a plaintext password set by us).
 */
export async function inviteClerkUser(email: string, redirectUrl: string): Promise<{ id: string }> {
  return clerk<{ id: string }>("/invitations", {
    method: "POST",
    body: JSON.stringify({ email_address: email, redirect_url: redirectUrl }),
  });
}

/** Deactivating an account must actually block authentication, not just hide UI. */
export async function setClerkBanned(clerkId: string, banned: boolean): Promise<void> {
  await clerk(`/users/${clerkId}`, {
    method: "PATCH",
    body: JSON.stringify({ banned, ...(banned ? {} : {}) }),
  });
}

/**
 * Single-use sign-in ticket for admin-assisted account recovery (§5 "reset or
 * initiate password recovery"). Minted server-side, handed to the admin once,
 * consumable only by the target account, expires quickly.
 */
export async function createClerkSignInToken(clerkId: string, expiresInSeconds = 900): Promise<string> {
  const res = await clerk<{ token: string }>("/sign_in_tokens", {
    method: "POST",
    body: JSON.stringify({ user_id: clerkId, expires_in_seconds: expiresInSeconds }),
  });
  return res.token;
}
