import { handleApiError, noContent, readJson } from "@/lib/api";
import { requireAreaWorkspace } from "@/lib/auth";
import { createMatchScoreEvent, deleteMatchScoreEvent } from "@/lib/data-store";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    await requireAreaWorkspace("analysis");
    return Response.json(await createMatchScoreEvent((await context.params).matchId, await readJson<Record<string, unknown>>(request)), { status: 201 });
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    await requireAreaWorkspace("analysis");
    const { eventId } = await readJson<{ eventId: string }>(request);
    if (typeof eventId !== "string" || !eventId) throw new Error("Score change is required.");
    await deleteMatchScoreEvent((await context.params).matchId, eventId);
    return noContent();
  } catch (error) { return handleApiError(error); }
}
