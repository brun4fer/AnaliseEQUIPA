import { prisma } from "@/lib/prisma";
import { defaultMomentTypes, defaultSubMomentTypes, submomentCodesForMoment } from "@/lib/default-analysis-types";

export async function createWorkspaceForUser(userId: string, rawName: unknown) {
  const name = String(rawName || "").trim();
  if (name.length < 2 || name.length > 80) throw new Error("Team name must contain between 2 and 80 characters.");

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.workspaceId) throw new Error("This account already has a team.");
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
    await tx.user.update({ where: { id: userId }, data: { workspaceId: workspace.id } });
    return workspace;
  });
}
