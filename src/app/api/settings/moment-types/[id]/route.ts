import { handleApiError, noContent, readJson } from "@/lib/api";
import { deleteMomentType, saveMomentType } from "@/lib/data-store";
import { requireAreaWorkspace } from "@/lib/auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { await requireAreaWorkspace("settings"); return Response.json(await saveMomentType(await readJson<Record<string, unknown>>(request), (await context.params).id)); }
  catch (error) { return handleApiError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { await requireAreaWorkspace("settings"); await deleteMomentType((await context.params).id); return noContent(); }
  catch (error) { return handleApiError(error); }
}
