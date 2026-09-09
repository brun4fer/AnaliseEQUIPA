import { handleApiError, readJson } from "@/lib/api";
import { saveSubMomentType } from "@/lib/data-store";
import { requireAreaWorkspace } from "@/lib/auth";

export async function POST(request: Request) {
  try { await requireAreaWorkspace("settings"); return Response.json(await saveSubMomentType(await readJson<Record<string, unknown>>(request)), { status: 201 }); }
  catch (error) { return handleApiError(error); }
}
