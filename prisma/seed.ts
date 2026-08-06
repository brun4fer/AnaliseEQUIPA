import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const momentTypes = [
  { code: "ORG_OF", name: "Offensive Organization", color: "#2dd66f", defaultShortcut: "1", sortOrder: 1 },
  { code: "ORG_DEF", name: "Defensive Organization", color: "#38bdf8", defaultShortcut: "2", sortOrder: 2 },
  { code: "TRANS_OF", name: "Offensive Transition", color: "#facc15", defaultShortcut: "3", sortOrder: 3 },
  { code: "TRANS_DEF", name: "Defensive Transition", color: "#fb7185", defaultShortcut: "4", sortOrder: 4 },
  { code: "BOLA_PARADA", name: "Set Pieces", color: "#a78bfa", defaultShortcut: "5", sortOrder: 5 }
];

const subMomentTypes = [
  { code: "CRUZAMENTO", name: "Cross", color: "#38bdf8", requiresFieldLocation: true, requiresGoalLocation: true, defaultShortcut: "C", sortOrder: 1 },
  { code: "REMATE", name: "Shot", color: "#facc15", requiresFieldLocation: true, requiresGoalLocation: true, defaultShortcut: "S", sortOrder: 2 },
  { code: "PERDA", name: "Turnover", color: "#ef4444", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: "T", sortOrder: 3 },
  { code: "RECUPERACAO", name: "Ball Recovery", color: "#22c55e", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: "R", sortOrder: 4 }
];

async function main() {
  for (const type of momentTypes) {
    await prisma.momentType.upsert({ where: { code: type.code }, update: type, create: type });
  }
  for (const type of subMomentTypes) {
    await prisma.subMomentType.upsert({ where: { code: type.code }, update: type, create: type });
  }

  const moments = await prisma.momentType.findMany();
  const submoments = await prisma.subMomentType.findMany();
  for (const moment of moments) {
    await prisma.momentType.update({
      where: { id: moment.id },
      data: { allowedSubmoments: { set: submoments.map((type) => ({ id: type.id })) } }
    });
  }
}

main().finally(() => prisma.$disconnect());
