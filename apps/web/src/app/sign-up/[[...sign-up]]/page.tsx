import { redirect } from "next/navigation";

/**
 * UniSphere has a single entry point for every role: /sign-in. Accounts are
 * provisioned by the coordination office, so the public sign-up flow is
 * redirected to sign-in (this keeps old links working).
 */
export default function SignUpPage() {
  redirect("/sign-in");
}
