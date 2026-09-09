import { handleApiError } from "@/lib/api";
import { getSettings } from "@/lib/data-store";
import { requireAreaWorkspace } from "@/lib/auth";

export async function GET() {
  try { await requireAreaWorkspace(["settings", "maps", "reports", "analysis"]); return Response.json(await getSettings()); }
  catch (error) { return handleApiError(error); }
}
