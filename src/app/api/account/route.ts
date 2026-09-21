import { requireAccount } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { accessAreas } from "@/lib/access-areas";
import { hasAreaAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { user, workspace, session } = await requireAccount();
    const memberships = await prisma.workspaceMembership.findMany({ where: { userId: user.id }, include: { workspace: true }, orderBy: { createdAt: "asc" } });
    return Response.json({
      id: user.id,
      name: user.name,
      username: user.username,
      teamName: workspace?.name ?? null,
      activeWorkspaceId: workspace?.id ?? null,
      teams: memberships.map(({ workspace: item }) => ({ id: item.id, name: item.name })),
      needsOnboarding: !workspace,
      accessControl: workspace ? {
        globalUnlocked: session.access?.globalVersion === workspace.globalAccessPasswordVersion,
        unlockedAreas: accessAreas.filter((area) => hasAreaAccess({ user, workspace, session }, area))
      } : { globalUnlocked: false, unlockedAreas: [] }
    });
  } catch (error) { return handleApiError(error); }
}
