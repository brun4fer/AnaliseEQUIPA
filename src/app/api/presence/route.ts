import { handleApiError, readJson } from "@/lib/api";
import { requireWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTIVE_WINDOW_MS = 90_000;
const RETENTION_MS = 24 * 60 * 60 * 1000;

function validClientId(value: unknown) {
  const clientId = typeof value === "string" ? value.trim() : "";
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(clientId)) throw new Error("Invalid presence identity.");
  return clientId;
}

export async function POST(request: Request) {
  try {
    const { user, workspace } = await requireWorkspace();
    const { clientId: value } = await readJson<{ clientId?: string }>(request);
    const clientId = validClientId(value);
    const now = new Date();
    const activeAfter = new Date(now.getTime() - ACTIVE_WINDOW_MS);
    const removeBefore = new Date(now.getTime() - RETENTION_MS);

    const otherActiveSessions = await prisma.$transaction(async (tx) => {
      await tx.workspacePresence.deleteMany({ where: { lastSeenAt: { lt: removeBefore } } });
      await tx.workspacePresence.upsert({
        where: { workspaceId_clientId: { workspaceId: workspace.id, clientId } },
        create: { workspaceId: workspace.id, userId: user.id, clientId, lastSeenAt: now },
        update: { userId: user.id, lastSeenAt: now },
      });
      return tx.workspacePresence.count({
        where: {
          workspaceId: workspace.id,
          clientId: { not: clientId },
          lastSeenAt: { gte: activeAfter },
        },
      });
    });

    return Response.json({ activeElsewhere: otherActiveSessions > 0, otherActiveSessions });
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(request: Request) {
  try {
    const { workspace } = await requireWorkspace();
    const { clientId: value } = await readJson<{ clientId?: string }>(request);
    const clientId = validClientId(value);
    await prisma.workspacePresence.deleteMany({ where: { workspaceId: workspace.id, clientId } });
    return Response.json({ removed: true });
  } catch (error) { return handleApiError(error); }
}
