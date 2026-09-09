import { handleApiError, readJson } from "@/lib/api";
import { createMatch, listMatches } from "@/lib/data-store";
import { requireAreaWorkspace } from "@/lib/auth";

export async function GET() {
  try { await requireAreaWorkspace(["matches", "maps", "reports"]); return Response.json(await listMatches()); }
  catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try { await requireAreaWorkspace("newMatch"); return Response.json(await createMatch(await readJson<Record<string, unknown>>(request)), { status: 201 }); }
  catch (error) { return handleApiError(error); }
}
