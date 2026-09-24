import { requireUser } from "@/lib/auth";
import { PortalShell } from "@/components/portal-shell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <PortalShell user={{ name: user.name, email: user.email, role: user.role }}>
      {children}
    </PortalShell>
  );
}
