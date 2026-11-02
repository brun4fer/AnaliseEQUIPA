import type { MatchDetail } from "./domain";

export type ComparisonFilters = {
  momentTypeId?: string;
  submomentTypeId?: string;
  period?: "both" | "first_half" | "second_half";
};
export function compareGames(matches: MatchDetail[], filters: ComparisonFilters = {}) {
  return [...matches].sort((a, b) => {
    if (!a.matchDate && b.matchDate) return 1;
    if (a.matchDate && !b.matchDate) return -1;
    return (a.matchDate || "").localeCompare(b.matchDate || "") || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  }).map((match) => {
    const moments = match.moments.filter((moment) =>
      (!filters.momentTypeId || moment.momentTypeId === filters.momentTypeId)
      && (!filters.submomentTypeId || moment.subMoments.some((sub) => sub.subMomentTypeId === filters.submomentTypeId))
      && (!filters.period || (filters.period === "both" ? moment.period !== null : moment.period === filters.period))
    );
    const positive = moments.filter((moment) => moment.outcome === "positive").length;
    const negative = moments.filter((moment) => moment.outcome === "negative").length;
    return {
      id: match.id, title: match.title, date: match.matchDate,
      moments: moments.length,
      submoments: moments.reduce((sum, moment) => sum + moment.subMoments.filter((sub) => !filters.submomentTypeId || sub.subMomentTypeId === filters.submomentTypeId).length, 0),
      duration: moments.reduce((sum, moment) => sum + Math.max(0, moment.endTimeSeconds - moment.startTimeSeconds), 0),
      positive, negative, unclassified: moments.length - positive - negative,
      positiveRate: positive + negative ? 100 * positive / (positive + negative) : null,
    };
  });
}

export type GameComparison = ReturnType<typeof compareGames>[number];
