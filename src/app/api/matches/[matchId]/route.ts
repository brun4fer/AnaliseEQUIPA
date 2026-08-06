import { handleApiError } from "@/lib/api";
import { getMatch } from "@/lib/data-store";

export async function GET(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  try { return Response.json(await getMatch((await context.params).matchId)); }
  catch (error) { return handleApiError(error); }
}
