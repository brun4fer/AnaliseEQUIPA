import { handleApiError, noContent, readJson } from "@/lib/api";
import { deleteSubMoment, updateSubMoment } from "@/lib/data-store";
import { requireAreaWorkspace } from "@/lib/auth";

export async function PATCH(request: Request, context: { params: Promise<{ subMomentId: string }> }) {
  try { await requireAreaWorkspace("analysis"); return Response.json(await updateSubMoment((await context.params).subMomentId, await readJson<Record<string, unknown>>(request))); }
  catch (error) { return handleApiError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ subMomentId: string }> }) {
  try { await requireAreaWorkspace("analysis"); await deleteSubMoment((await context.params).subMomentId); return noContent(); }
  catch (error) { return handleApiError(error); }
}
