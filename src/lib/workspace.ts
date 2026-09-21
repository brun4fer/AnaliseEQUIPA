import { prisma } from "@/lib/prisma";
import { defaultMomentTypes, defaultSubMomentTypes, submomentCodesForMoment } from "@/lib/default-analysis-types";

export async function createWorkspaceForUser(userId: string, rawName: unknown) {
  const name = String(rawName || "").trim();
  if (name.length < 2 || name.length > 80) throw new Error("Team name must contain between 2 and 80 characters.");

  return prisma.$transaction(async (tx) => {
    await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const workspace = await tx.workspace.create({ data: { name } });
    await tx.momentType.createMany({ data: defaultMomentTypes.map((type) => ({ ...type, workspaceId: workspace.id })) });
    await tx.subMomentType.createMany({ data: defaultSubMomentTypes.map((type) => ({ ...type, workspaceId: workspace.id })) });
    const [moments, submoments] = await Promise.all([
      tx.momentType.findMany({ where: { workspaceId: workspace.id }, select: { id: true, code: true } }),
      tx.subMomentType.findMany({ where: { workspaceId: workspace.id }, select: { id: true, code: true } }),
    ]);
    for (const moment of moments) {
      const allowedCodes = new Set(submomentCodesForMoment(moment.code));
      await tx.momentType.update({ where: { id: moment.id }, data: { allowedSubmoments: { set: submoments.filter((type) => allowedCodes.has(type.code)).map(({ id }) => ({ id })) } } });
    }
    await tx.workspaceMembership.create({ data: { userId, workspaceId: workspace.id } });
    await tx.user.update({ where: { id: userId }, data: { workspaceId: workspace.id } });
    return workspace;
  });
}

export async function renameActiveWorkspace(userId: string, workspaceId: string, rawName: unknown) {
  const name = String(rawName || "").trim();
  if (name.length < 2 || name.length > 80) throw new Error("Team name must contain between 2 and 80 characters.");
  const membership = await prisma.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!membership) throw new Error("You do not have access to this team.");
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.update({ where: { id: workspaceId }, data: { name } });
    const matches = await tx.match.findMany({ where: { workspaceId }, select: { id: true, opponentName: true } });
    for (const match of matches) await tx.match.update({ where: { id: match.id }, data: { title: `${name} vs ${match.opponentName}` } });
    return workspace;
  });
}

export async function switchWorkspaceForUser(userId: string, workspaceId: unknown) {
  const id = String(workspaceId || "");
  const membership = await prisma.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId: id, userId } }, include: { workspace: true } });
  if (!membership) throw new Error("You do not have access to this team.");
  await prisma.user.update({ where: { id: userId }, data: { workspaceId: id } });
  return membership.workspace;
}
