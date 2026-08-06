import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const momentTypes = [
  { code: "ORG_OF", name: "Organização ofensiva", color: "#2dd66f", defaultShortcut: "1", sortOrder: 1 },
  { code: "ORG_DEF", name: "Organização defensiva", color: "#38bdf8", defaultShortcut: "2", sortOrder: 2 },
  { code: "TRANS_OF", name: "Transição ofensiva", color: "#facc15", defaultShortcut: "3", sortOrder: 3 },
  { code: "TRANS_DEF", name: "Transição defensiva", color: "#fb7185", defaultShortcut: "4", sortOrder: 4 },
  { code: "BOLA_PARADA", name: "Bolas paradas", color: "#a78bfa", defaultShortcut: "5", sortOrder: 5 }
];

const subMomentTypes = [
  { code: "CRUZAMENTO", name: "Cruzamento", color: "#38bdf8", requiresFieldLocation: true, requiresGoalLocation: true, defaultShortcut: "C", sortOrder: 1 },
  { code: "REMATE", name: "Remate", color: "#facc15", requiresFieldLocation: true, requiresGoalLocation: true, defaultShortcut: "R", sortOrder: 2 },
  { code: "PERDA", name: "Perda de bola", color: "#ef4444", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: "P", sortOrder: 3 },
  { code: "RECUPERACAO", name: "Recuperação", color: "#22c55e", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: "G", sortOrder: 4 }
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
