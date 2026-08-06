import { handleApiError, readJson } from "@/lib/api";
import { saveVideo } from "@/lib/data-store";

export async function PUT(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try { return Response.json(await saveVideo((await context.params).matchId, await readJson<Record<string, unknown>>(request))); }
  catch (error) { return handleApiError(error); }
}
