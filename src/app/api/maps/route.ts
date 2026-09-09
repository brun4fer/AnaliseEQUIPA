import { handleApiError } from "@/lib/api";
import { getMapPoints } from "@/lib/data-store";
import { requireAreaWorkspace } from "@/lib/auth";

export async function GET() {
  try { await requireAreaWorkspace("maps"); return Response.json(await getMapPoints()); }
  catch (error) { return handleApiError(error); }
}
