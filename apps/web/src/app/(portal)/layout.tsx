import { requireUser } from "@/lib/auth";
import { getUnreadCount } from "@/server/services/notifications";
import { PortalShell } from "@/components/portal-shell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  let unreadCount = 0;
  try {
    unreadCount = await getUnreadCount(user.id);
  } catch {
    unreadCount = 0; // DB down → no badge, page content explains
  }
  return (
    <PortalShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        registrationNo: user.registrationNo,
        employeeId: user.employeeId,
        hasAvatar: Boolean(user.avatarMime),
      }}
      unreadCount={unreadCount}
    >
      {children}
    </PortalShell>
  );
}
