import { requireAccount } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const { user, workspace } = await requireAccount();
    return Response.json({ id: user.id, name: user.name, username: user.username, teamName: workspace?.name ?? null, needsOnboarding: !workspace });
  } catch (error) { return handleApiError(error); }
}
