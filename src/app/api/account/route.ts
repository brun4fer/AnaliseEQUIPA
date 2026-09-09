import { requireAccount } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { accessAreas } from "@/lib/access-areas";
import { hasAreaAccess } from "@/lib/auth";

export async function GET() {
  try {
    const { user, workspace, session } = await requireAccount();
    return Response.json({
      id: user.id,
      name: user.name,
      username: user.username,
      teamName: workspace?.name ?? null,
      needsOnboarding: !workspace,
      accessControl: workspace ? {
        globalUnlocked: session.access?.globalVersion === workspace.globalAccessPasswordVersion,
        unlockedAreas: accessAreas.filter((area) => hasAreaAccess({ user, workspace, session }, area))
      } : { globalUnlocked: false, unlockedAreas: [] }
    });
  } catch (error) { return handleApiError(error); }
}
