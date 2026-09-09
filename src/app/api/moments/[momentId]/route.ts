import { handleApiError, noContent, readJson } from "@/lib/api";
import { deleteMoment, updateMoment } from "@/lib/data-store";
import { requireAreaWorkspace } from "@/lib/auth";

export async function PATCH(request: Request, context: { params: Promise<{ momentId: string }> }) {
  try { await requireAreaWorkspace(["analysis", "reports"]); return Response.json(await updateMoment((await context.params).momentId, await readJson<Record<string, unknown>>(request))); }
  catch (error) { return handleApiError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ momentId: string }> }) {
  try { await requireAreaWorkspace(["analysis", "reports"]); await deleteMoment((await context.params).momentId); return noContent(); }
  catch (error) { return handleApiError(error); }
}
