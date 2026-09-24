import { prisma } from "@/lib/db";
import type { NotificationType, Prisma, Role } from "@unisphere/db";

/**
 * Notification fan-out (plan §6.6). Every transition calls exactly one of
 * these helpers; recipients come from the matrix, never from the client.
 * Helpers accept an optional transaction client so the notification commits
 * atomically with the state change.
 */

type Db = Prisma.TransactionClient | typeof prisma;

type NotifyInput = {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
};

/** Single recipient (decisions, accept/decline, session updates…). */
export async function notifyUser(userId: string, input: NotifyInput, db: Db = prisma) {
  return db.notification.create({ data: { userId, ...input } });
}

/** Everyone holding a role (e.g. faculty review queue, FYP submit → FYP_HEAD). */
export async function notifyRole(role: Role, input: NotifyInput, db: Db = prisma) {
  const users = await db.user.findMany({ where: { role }, select: { id: true } });
  if (users.length === 0) return { count: 0 };
  return db.notification.createMany({
    data: users.map((u) => ({ userId: u.id, ...input })),
  });
}

/** Broadcast to a full audience (coordinator/FYP-Head announcement). */
export async function broadcast(
  role: Role,
  input: Omit<NotifyInput, "type">,
  db: Db = prisma,
) {
  return notifyRole(role, { ...input, type: "ANNOUNCEMENT" }, db);
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(userId: string, opts?: { cursor?: string; take?: number }) {
  const take = Math.min(opts?.take ?? 20, 50);
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : null };
}

/** Ownership-scoped read (marking someone else's notification is a no-op 404). */
export async function markRead(userId: string, notificationId: string): Promise<boolean> {
  const res = await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return res.count > 0;
}

export async function markAllRead(userId: string): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return res.count;
}
