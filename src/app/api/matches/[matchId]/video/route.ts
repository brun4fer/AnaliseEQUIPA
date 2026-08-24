import { handleApiError, readJson } from "@/lib/api";
import { requireManagementWorkspace, requireWorkspace } from "@/lib/auth";
import { saveVideo } from "@/lib/data-store";
import { prisma } from "@/lib/prisma";
import { abortMultipartUpload, createPlaybackUrl, deleteR2Object } from "@/lib/r2";

export async function GET(_: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { workspace } = await requireWorkspace();
    const { matchId } = await context.params;
    const video = await prisma.video.findFirst({ where: { matchId, match: { workspaceId: workspace.id } } });
    if (!video) return Response.json({ error: "This match does not have a video." }, { status: 404 });
    if (video.storageStatus !== "READY" || !video.storageKey) {
      return Response.json({ error: "The video has not been uploaded to Cloudflare R2 yet." }, { status: 404 });
    }
    return Response.json(createPlaybackUrl(video.storageKey));
  } catch (error) { return handleApiError(error); }
}

// Retained for older clients that only register a local file's metadata.
export async function PUT(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try { return Response.json(await saveVideo((await context.params).matchId, await readJson<Record<string, unknown>>(request))); }
  catch (error) { return handleApiError(error); }
}

export async function DELETE(_: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { workspace } = await requireManagementWorkspace();
    const { matchId } = await context.params;
    const video = await prisma.video.findFirst({ where: { matchId, match: { workspaceId: workspace.id } } });
    if (!video) return Response.json({ deleted: true });
    if (video.storageKey && video.uploadId) await abortMultipartUpload(video.storageKey, video.uploadId).catch(() => undefined);
    if (video.storageKey) await deleteR2Object(video.storageKey);
    await prisma.video.delete({ where: { id: video.id } });
    return Response.json({ deleted: true });
  } catch (error) { return handleApiError(error); }
}
