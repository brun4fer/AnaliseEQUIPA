import { handleApiError, readJson } from "@/lib/api";
import { createMoment } from "@/lib/data-store";
import { requireAreaWorkspace } from "@/lib/auth";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try { await requireAreaWorkspace("analysis"); return Response.json(await createMoment((await context.params).matchId, await readJson<Record<string, unknown>>(request)), { status: 201 }); }
  catch (error) { return handleApiError(error); }
}
