import { requireAreaWorkspace } from "@/lib/auth";
import { getMapMoments } from "@/lib/data-store";
import { handleApiError } from "@/lib/api";

export async function GET() {
  try {
    await requireAreaWorkspace("maps");
    return Response.json(await getMapMoments());
  } catch (error) { return handleApiError(error); }
}
