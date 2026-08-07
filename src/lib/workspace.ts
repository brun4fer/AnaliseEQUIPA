import { prisma } from "@/lib/prisma";

const defaultMomentTypes = [
  { code: "ORG_OF", name: "Offensive Organization", color: "#2dd66f", defaultShortcut: "1", sortOrder: 1 },
  { code: "ORG_DEF", name: "Defensive Organization", color: "#38bdf8", defaultShortcut: "2", sortOrder: 2 },
  { code: "TRANS_OF", name: "Offensive Transition", color: "#f59e0b", defaultShortcut: "3", sortOrder: 3 },
  { code: "TRANS_DEF", name: "Defensive Transition", color: "#ef4444", defaultShortcut: "4", sortOrder: 4 },
  { code: "SET_PIECES_DEF", name: "Defensive Set Pieces", color: "#a78bfa", defaultShortcut: "5", sortOrder: 5 },
  { code: "SET_PIECES_OF", name: "Offensive Set Pieces", color: "#ec4899", defaultShortcut: "6", sortOrder: 6 },
];

const defaultSubMomentTypes = [
  { code: "CROSS", name: "Cross", color: "#38bdf8", requiresFieldLocation: true, requiresGoalLocation: true, defaultShortcut: "C", sortOrder: 1 },
  { code: "SHOT", name: "Shot", color: "#facc15", requiresFieldLocation: true, requiresGoalLocation: true, defaultShortcut: "S", sortOrder: 2 },
  { code: "TURNOVER", name: "Turnover", color: "#ef4444", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: "T", sortOrder: 3 },
  { code: "RECOVERY", name: "Ball Recovery", color: "#22c55e", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: "R", sortOrder: 4 },
];

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
      tx.momentType.findMany({ where: { workspaceId: workspace.id }, select: { id: true } }),
      tx.subMomentType.findMany({ where: { workspaceId: workspace.id }, select: { id: true } }),
    ]);
    for (const moment of moments) {
      await tx.momentType.update({ where: { id: moment.id }, data: { allowedSubmoments: { set: submoments } } });
    }
    await tx.user.update({ where: { id: userId }, data: { workspaceId: workspace.id } });
    return workspace;
  });
}
