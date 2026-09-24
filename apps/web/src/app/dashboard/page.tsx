import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string | undefined) ?? "unassigned";

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Dashboard (placeholder)</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Signed in as{" "}
        <span className="font-medium">{user?.primaryEmailAddress?.emailAddress}</span> · role:{" "}
        <span className="font-mono">{role}</span>
      </p>
      <p className="mt-6 text-sm text-zinc-500">
        M0 spike #2: Clerk auth + role claim round-trip. The real role portals land in M1.
      </p>
    </main>
  );
}
