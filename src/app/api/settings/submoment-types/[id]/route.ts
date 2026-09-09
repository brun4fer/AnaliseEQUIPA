import { handleApiError, noContent, readJson } from "@/lib/api";
import { deleteSubMomentType, saveSubMomentType } from "@/lib/data-store";
import { requireAreaWorkspace } from "@/lib/auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { await requireAreaWorkspace("settings"); return Response.json(await saveSubMomentType(await readJson<Record<string, unknown>>(request), (await context.params).id)); }
  catch (error) { return handleApiError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { await requireAreaWorkspace("settings"); await deleteSubMomentType((await context.params).id); return noContent(); }
  catch (error) { return handleApiError(error); }
}
