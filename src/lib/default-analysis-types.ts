export const defaultMomentTypes = [
  { code: "ORG_OF", name: "Offensive Organization", color: "#2dd66f", defaultShortcut: "1", sortOrder: 1 },
  { code: "ORG_DEF", name: "Defensive Organization", color: "#38bdf8", defaultShortcut: "2", sortOrder: 2 },
  { code: "TRANS_OF", name: "Offensive Transition", color: "#f59e0b", defaultShortcut: "3", sortOrder: 3 },
  { code: "TRANS_DEF", name: "Defensive Transition", color: "#ef4444", defaultShortcut: "4", sortOrder: 4 },
  { code: "SET_PIECES_OF", name: "Offensive Set Pieces", color: "#ec4899", defaultShortcut: "5", sortOrder: 5 },
  { code: "SET_PIECES_DEF", name: "Defensive Set Pieces", color: "#a78bfa", defaultShortcut: "6", sortOrder: 6 },
] as const;

export const defaultSubMomentTypes = [
  { code: "PERDA", name: "Perda da posse", color: "#ef4444", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: "T", sortOrder: 1 },
  { code: "GANHO_LATERAL", name: "Ganho de lançamento lateral", color: "#06b6d4", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: null, sortOrder: 2 },
  { code: "GANHO_LIVRE", name: "Ganho de livre", color: "#8b5cf6", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: null, sortOrder: 3 },
  { code: "GANHO_CANTO", name: "Ganho de canto", color: "#ec4899", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: null, sortOrder: 4 },
  { code: "ATAQUE_PROFUNDIDADE", name: "Ataque à profundidade", color: "#f59e0b", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: null, sortOrder: 5 },
  { code: "CRUZAMENTO", name: "Cruzamento", color: "#38bdf8", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: "C", sortOrder: 6 },
  { code: "REMATE", name: "Remate", color: "#facc15", requiresFieldLocation: true, requiresGoalLocation: true, defaultShortcut: "S", sortOrder: 7 },
  { code: "GOLO", name: "Golo", color: "#22c55e", requiresFieldLocation: true, requiresGoalLocation: true, defaultShortcut: null, sortOrder: 8 },
  { code: "RECUPERACAO", name: "Recuperação da posse", color: "#22c55e", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: "R", sortOrder: 9 },
  { code: "CEDENCIA_LATERAL", name: "Cedência de lançamento lateral", color: "#0ea5e9", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: null, sortOrder: 10 },
  { code: "CEDENCIA_LIVRE", name: "Cedência de livre", color: "#a78bfa", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: null, sortOrder: 11 },
  { code: "CEDENCIA_CANTO", name: "Cedência de canto", color: "#f472b6", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: null, sortOrder: 12 },
  { code: "CRUZAMENTO_CONCEDIDO", name: "Cruzamento concedido", color: "#fb7185", requiresFieldLocation: true, requiresGoalLocation: false, defaultShortcut: null, sortOrder: 13 },
  { code: "REMATE_CONCEDIDO", name: "Remate concedido", color: "#f97316", requiresFieldLocation: true, requiresGoalLocation: true, defaultShortcut: null, sortOrder: 14 },
  { code: "GOLO_CONCEDIDO", name: "Golo concedido", color: "#dc2626", requiresFieldLocation: true, requiresGoalLocation: true, defaultShortcut: null, sortOrder: 15 },
] as const;

export const offensiveSubmomentCodes = [
  "PERDA",
  "GANHO_LATERAL",
  "GANHO_LIVRE",
  "GANHO_CANTO",
  "ATAQUE_PROFUNDIDADE",
  "CRUZAMENTO",
  "REMATE",
  "GOLO",
] as const;

export const defensiveSubmomentCodes = [
  "RECUPERACAO",
  "CEDENCIA_LATERAL",
  "CEDENCIA_LIVRE",
  "CEDENCIA_CANTO",
  "CRUZAMENTO_CONCEDIDO",
  "REMATE_CONCEDIDO",
  "GOLO_CONCEDIDO",
] as const;

export function submomentCodesForMoment(momentCode: string): readonly string[] {
  return momentCode === "ORG_OF" || momentCode === "TRANS_OF" || momentCode === "SET_PIECES_OF"
    ? offensiveSubmomentCodes
    : momentCode === "ORG_DEF" || momentCode === "TRANS_DEF" || momentCode === "SET_PIECES_DEF"
      ? defensiveSubmomentCodes
      : [];
}
