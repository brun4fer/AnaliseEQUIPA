import { handleApiError, readJson } from "@/lib/api";
import { createMaintenance, isMaintenanceResource, listMaintenance } from "@/lib/maintenance";
import { requireAreaWorkspace } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    await requireAreaWorkspace(["maintenance", "newMatch", "matches"]);
    const { resource } = await context.params;
    if (!isMaintenanceResource(resource)) return Response.json({ error: "Invalid maintenance resource." }, { status: 404 });
    return Response.json(await listMaintenance(resource));
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    await requireAreaWorkspace("maintenance");
    const { resource } = await context.params;
    if (!isMaintenanceResource(resource)) return Response.json({ error: "Invalid maintenance resource." }, { status: 404 });
    return Response.json(await createMaintenance(resource, await readJson<Record<string, unknown>>(request)), { status: 201 });
  } catch (error) { return handleApiError(error); }
}
