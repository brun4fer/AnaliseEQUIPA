import { cookies } from "next/headers";
import { accessAreas, isAccessArea, type AccessArea } from "@/lib/access-areas";
import { handleApiError, readJson } from "@/lib/api";
import { areaAccessVersion, createSessionToken, hashPassword, requireGlobalAccessWorkspace, requireWorkspace, SESSION_COOKIE, sessionCookieOptions, validateAccessPassword, verifyAreaPassword, verifyGlobalAccessPassword, verifyPassword, type SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Account = Awaited<ReturnType<typeof requireWorkspace>>;
type AccessState = NonNullable<SessionPayload["access"]>;

function readPassword(value: unknown) { const password = String(value || ""); validateAccessPassword(password); return password; }
function updateFor(area: AccessArea, hash: string) {
  switch (area) {
    case "matches": return { matchesAccessPasswordHash: hash, matchesAccessPasswordVersion: { increment: 1 } };
    case "newMatch": return { newMatchAccessPasswordHash: hash, newMatchAccessPasswordVersion: { increment: 1 } };
    case "maps": return { mapsAccessPasswordHash: hash, mapsAccessPasswordVersion: { increment: 1 } };
    case "reports": return { reportsAccessPasswordHash: hash, reportsAccessPasswordVersion: { increment: 1 } };
    case "maintenance": return { maintenanceAccessPasswordHash: hash, maintenanceAccessPasswordVersion: { increment: 1 } };
    case "settings": return { settingsAccessPasswordHash: hash, settingsAccessPasswordVersion: { increment: 1 } };
    case "help": return { helpAccessPasswordHash: hash, helpAccessPasswordVersion: { increment: 1 } };
    case "analysis": return { analysisAccessPasswordHash: hash, analysisAccessPasswordVersion: { increment: 1 } };
  }
}
async function setAccessCookie(account: Account, access: AccessState) {
  (await cookies()).set(SESSION_COOKIE, createSessionToken({ userId: account.user.id, username: account.user.username, role: account.user.role, mustChangePassword: account.user.mustChangePassword, needsOnboarding: false, access }), sessionCookieOptions);
}
function response(account: Account, access: AccessState) {
  const globalUnlocked = access.globalVersion === account.workspace.globalAccessPasswordVersion;
  const unlockedAreas = globalUnlocked ? [...accessAreas] : accessAreas.filter((area) => access.areaVersions?.[area] === areaAccessVersion(account, area));
  return { globalUnlocked, unlockedAreas };
}

export async function POST(request: Request) {
  try {
    const account = await requireWorkspace();
    const body = await readJson<Record<string, unknown>>(request);
    const action = String(body.action || "unlock");
    if (action === "unlock") {
      if (!isAccessArea(body.area)) throw new Error("Invalid access area.");
      const password = String(body.password || "");
      const access: AccessState = verifyGlobalAccessPassword(account, password)
        ? { ...account.session.access, globalVersion: account.workspace.globalAccessPasswordVersion }
        : verifyAreaPassword(account, body.area, password)
          ? { ...account.session.access, areaVersions: { ...account.session.access?.areaVersions, [body.area]: areaAccessVersion(account, body.area) } }
          : (() => { throw new Error("Incorrect area or global password."); })();
      await setAccessCookie(account, access);
      return Response.json(response(account, access));
    }
    if (action === "unlockGlobal") {
      if (!verifyGlobalAccessPassword(account, String(body.password || ""))) throw new Error("Incorrect global password.");
      const access = { ...account.session.access, globalVersion: account.workspace.globalAccessPasswordVersion };
      await setAccessCookie(account, access);
      return Response.json(response(account, access));
    }
    if (action === "resetGlobal") {
      if (!account.user.passwordHash || !verifyPassword(String(body.accountPassword || ""), account.user.passwordHash)) throw new Error("Incorrect sign-in password.");
      const workspace = await prisma.workspace.update({ where: { id: account.workspace.id }, data: { globalAccessPasswordHash: hashPassword(readPassword(body.password)), globalAccessPasswordVersion: { increment: 1 } } });
      const nextAccount = { ...account, workspace };
      const access = { globalVersion: workspace.globalAccessPasswordVersion, areaVersions: {} };
      await setAccessCookie(nextAccount, access);
      return Response.json(response(nextAccount, access));
    }
    throw new Error("Invalid access action.");
  } catch (error) { return handleApiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const account = await requireGlobalAccessWorkspace();
    const body = await readJson<Record<string, unknown>>(request);
    const target = String(body.target || "");
    const hash = hashPassword(readPassword(body.password));
    if (target === "global") {
      const workspace = await prisma.workspace.update({ where: { id: account.workspace.id }, data: { globalAccessPasswordHash: hash, globalAccessPasswordVersion: { increment: 1 } } });
      const nextAccount = { ...account, workspace };
      const access = { globalVersion: workspace.globalAccessPasswordVersion, areaVersions: {} };
      await setAccessCookie(nextAccount, access);
      return Response.json({ changed: true, ...response(nextAccount, access) });
    }
    if (!isAccessArea(target)) throw new Error("Invalid access area.");
    await prisma.workspace.update({ where: { id: account.workspace.id }, data: updateFor(target, hash) });
    await setAccessCookie(account, account.session.access || {});
    return Response.json({ changed: true, globalUnlocked: true, unlockedAreas: [...accessAreas] });
  } catch (error) { return handleApiError(error); }
}
