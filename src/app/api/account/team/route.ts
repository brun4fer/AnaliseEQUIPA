import { cookies } from "next/headers";

import { handleApiError, readJson } from "@/lib/api";
import { AreaAccessError, createSessionToken, hasAreaAccess, requireAccount, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { createWorkspaceForUser, renameActiveWorkspace, switchWorkspaceForUser } from "@/lib/workspace";

function resetSession(user: Awaited<ReturnType<typeof requireAccount>>["user"]) {
  return createSessionToken({ userId: user.id, username: user.username, role: user.role, mustChangePassword: user.mustChangePassword, needsOnboarding: false });
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const { user } = account;
    if (account.workspace && !hasAreaAccess({ ...account, workspace: account.workspace }, "settings")) throw new AreaAccessError(["settings"]);
    const body = await readJson<{ teamName?: string }>(request);
    const workspace = await createWorkspaceForUser(user.id, body.teamName);
    (await cookies()).set(SESSION_COOKIE, resetSession(user), sessionCookieOptions);
    return Response.json({ id: workspace.id, teamName: workspace.name }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const account = await requireAccount();
    if (!account.workspace) throw new Error("Complete the team setup before continuing.");
    if (!hasAreaAccess({ ...account, workspace: account.workspace }, "settings")) throw new AreaAccessError(["settings"]);
    const body = await readJson<{ teamName?: string }>(request);
    const workspace = await renameActiveWorkspace(account.user.id, account.workspace.id, body.teamName);
    return Response.json({ id: workspace.id, teamName: workspace.name });
  } catch (error) { return handleApiError(error); }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireAccount();
    const body = await readJson<{ workspaceId?: string }>(request);
    const workspace = await switchWorkspaceForUser(user.id, body.workspaceId);
    (await cookies()).set(SESSION_COOKIE, resetSession(user), sessionCookieOptions);
    return Response.json({ id: workspace.id, teamName: workspace.name });
  } catch (error) { return handleApiError(error); }
}
