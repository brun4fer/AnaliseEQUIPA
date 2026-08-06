import { prisma } from "@/lib/prisma";
import { getAttackDirectionAtTime, getMatchPeriodAtTime } from "@/lib/match-periods";

const matchInclude = {
  video: true,
  moments: {
    include: {
      momentType: true,
      subMoments: { include: { subMomentType: true }, orderBy: { timeSeconds: "asc" as const } }
    },
    orderBy: { startTimeSeconds: "asc" as const }
  }
};

function serializeMatch(match: Awaited<ReturnType<typeof prisma.match.findFirstOrThrow>> & Record<string, unknown>) {
  const video = match.video as { fileSize: bigint } | null | undefined;
  const moments = (match.moments as unknown[] | undefined) ?? [];
  return {
    ...match,
    matchDate: match.matchDate instanceof Date ? match.matchDate.toISOString() : match.matchDate,
    video: video ? { ...video, fileSize: Number(video.fileSize) } : null,
    momentCount: moments.length,
    moments
  };
}

export async function listMatches() {
  const rows = await prisma.match.findMany({
    include: { _count: { select: { moments: true } } },
    orderBy: [{ matchDate: "desc" }, { createdAt: "desc" }]
  });
  return rows.map((match) => ({
    id: match.id,
    title: match.title,
    opponentName: match.opponentName,
    competition: match.competition,
    season: match.season,
    roundName: match.roundName,
    matchDate: match.matchDate?.toISOString() ?? null,
    momentCount: match._count.moments
  }));
}

export async function getMatch(matchId: string) {
  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId }, include: matchInclude });
  return serializeMatch(match as never);
}

export async function createMatch(input: Record<string, unknown>) {
  const seasonId = String(input.seasonId || "");
  const competitionId = String(input.competitionId || "");
  const opponentClubId = String(input.opponentClubId || "");
  if (!seasonId || !competitionId || !opponentClubId) throw new Error("Season, competition and opponent are required.");
  const competitionRecord = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: { season: true, clubs: { where: { id: opponentClubId }, select: { id: true, name: true } } }
  });
  if (!competitionRecord || competitionRecord.seasonId !== seasonId || competitionRecord.clubs.length !== 1) throw new Error("The selected opponent does not participate in this competition.");
  const opponent = competitionRecord.clubs[0];
  const title = String(input.title || `Feirense vs ${opponent.name}`).trim();
  const match = await prisma.match.create({
    data: {
      title,
      opponentName: opponent.name,
      competition: competitionRecord.name,
      season: competitionRecord.season.name,
      seasonId,
      competitionId,
      opponentClubId,
      roundName: optionalString(input.roundName),
      venue: optionalString(input.venue),
      notes: optionalString(input.notes),
      matchDate: input.matchDate ? new Date(String(input.matchDate)) : null,
      firstHalfAttackDirection: String(input.firstHalfAttackDirection || "left_to_right"),
      secondHalfAttackDirection: String(input.secondHalfAttackDirection || "right_to_left")
    },
    include: matchInclude
  });
  return serializeMatch(match as never);
}

export async function updateMatch(matchId: string, input: Record<string, unknown>) {
  const markerKeys = [
    "firstHalfStartSeconds",
    "firstHalfEndSeconds",
    "secondHalfStartSeconds",
    "secondHalfEndSeconds"
  ] as const;
  const data: Partial<Record<(typeof markerKeys)[number], number | null>> = {};

  for (const key of markerKeys) {
    if (input[key] !== undefined) data[key] = optionalNumber(input[key]);
  }

  const current = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  const nextMarkers = Object.fromEntries(markerKeys.map((key) => [key, data[key] === undefined ? current[key] : data[key]])) as Record<PeriodMarkerKey, number | null>;
  validatePeriodMarkers(nextMarkers);

  const match = await prisma.$transaction(async (tx) => {
    await tx.match.update({ where: { id: matchId }, data });
    await tx.moment.updateMany({ where: { matchId }, data: { period: null } });
    if (nextMarkers.firstHalfStartSeconds !== null && nextMarkers.firstHalfEndSeconds !== null) {
      await tx.moment.updateMany({ where: { matchId, startTimeSeconds: { gte: nextMarkers.firstHalfStartSeconds, lte: nextMarkers.firstHalfEndSeconds } }, data: { period: "first_half" } });
    }
    if (nextMarkers.secondHalfStartSeconds !== null && nextMarkers.secondHalfEndSeconds !== null) {
      await tx.moment.updateMany({ where: { matchId, startTimeSeconds: { gte: nextMarkers.secondHalfStartSeconds, lte: nextMarkers.secondHalfEndSeconds } }, data: { period: "second_half" } });
    }
    return tx.match.findUniqueOrThrow({ where: { id: matchId }, include: matchInclude });
  });
  return serializeMatch(match as never);
}

export async function saveVideo(matchId: string, input: Record<string, unknown>) {
  const video = await prisma.video.upsert({
    where: { matchId },
    update: {
      fileName: String(input.fileName),
      fileSize: BigInt(Number(input.fileSize)),
      durationSeconds: Number(input.durationSeconds),
      mimeType: String(input.mimeType || "video/mp4"),
      lastModified: input.lastModified ? new Date(String(input.lastModified)) : null
    },
    create: {
      matchId,
      fileName: String(input.fileName),
      fileSize: BigInt(Number(input.fileSize)),
      durationSeconds: Number(input.durationSeconds),
      mimeType: String(input.mimeType || "video/mp4"),
      lastModified: input.lastModified ? new Date(String(input.lastModified)) : null
    }
  });
  return { ...video, fileSize: Number(video.fileSize) };
}

export async function getSettings() {
  const [momentTypes, subMomentTypes] = await Promise.all([
    prisma.momentType.findMany({ include: { allowedSubmoments: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.subMomentType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
  ]);
  return { momentTypes, subMomentTypes };
}

export async function createMoment(matchId: string, input: Record<string, unknown>) {
  const start = Number(input.startTimeSeconds);
  const end = Number(input.endTimeSeconds);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Invalid moment interval.");
  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  return prisma.moment.create({
    data: {
      matchId,
      momentTypeId: String(input.momentTypeId),
      startTimeSeconds: start,
      endTimeSeconds: end,
      durationSeconds: end - start,
      period: getMatchPeriodAtTime(match, start),
      notes: optionalString(input.notes),
      outcome: optionalString(input.outcome)
    },
    include: { momentType: true, subMoments: { include: { subMomentType: true } } }
  });
}

export async function updateMoment(momentId: string, input: Record<string, unknown>) {
  const current = await prisma.moment.findUniqueOrThrow({ where: { id: momentId }, include: { match: true } });
  const start = input.startTimeSeconds === undefined ? current.startTimeSeconds : Number(input.startTimeSeconds);
  const end = input.endTimeSeconds === undefined ? current.endTimeSeconds : Number(input.endTimeSeconds);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Invalid moment interval.");
  return prisma.moment.update({
    where: { id: momentId },
    data: {
      momentTypeId: input.momentTypeId === undefined ? undefined : String(input.momentTypeId),
      startTimeSeconds: start,
      endTimeSeconds: end,
      durationSeconds: end - start,
      period: getMatchPeriodAtTime(current.match, start),
      notes: input.notes === undefined ? undefined : optionalString(input.notes),
      outcome: input.outcome === undefined ? undefined : optionalString(input.outcome)
    },
    include: { momentType: true, subMoments: { include: { subMomentType: true } } }
  });
}

export async function createSubMoment(momentId: string, input: Record<string, unknown>) {
  const type = await prisma.subMomentType.findUniqueOrThrow({ where: { id: String(input.subMomentTypeId) } });
  const fieldX = optionalCoordinate(input.fieldX);
  const fieldY = optionalCoordinate(input.fieldY);
  const goalX = optionalCoordinate(input.goalX);
  const goalY = optionalCoordinate(input.goalY);
  if (type.requiresFieldLocation && (fieldX === null || fieldY === null)) throw new Error("Mark the occurrence on the field.");
  if (type.requiresGoalLocation && (goalX === null || goalY === null)) throw new Error("Mark the destination on the goal.");
  return prisma.subMoment.create({
    data: {
      momentId,
      subMomentTypeId: type.id,
      timeSeconds: optionalNumber(input.timeSeconds),
      fieldX,
      fieldY,
      goalX,
      goalY,
      foot: optionalString(input.foot),
      notes: optionalString(input.notes),
      outcome: optionalString(input.outcome)
    },
    include: { subMomentType: true }
  });
}

export async function updateSubMoment(subMomentId: string, input: Record<string, unknown>) {
  return prisma.subMoment.update({
    where: { id: subMomentId },
    data: {
      subMomentTypeId: input.subMomentTypeId === undefined ? undefined : String(input.subMomentTypeId),
      timeSeconds: input.timeSeconds === undefined ? undefined : optionalNumber(input.timeSeconds),
      fieldX: input.fieldX === undefined ? undefined : optionalCoordinate(input.fieldX),
      fieldY: input.fieldY === undefined ? undefined : optionalCoordinate(input.fieldY),
      goalX: input.goalX === undefined ? undefined : optionalCoordinate(input.goalX),
      goalY: input.goalY === undefined ? undefined : optionalCoordinate(input.goalY),
      foot: input.foot === undefined ? undefined : optionalString(input.foot),
      notes: input.notes === undefined ? undefined : optionalString(input.notes),
      outcome: input.outcome === undefined ? undefined : optionalString(input.outcome)
    },
    include: { subMomentType: true }
  });
}

export async function getMapPoints() {
  const rows = await prisma.subMoment.findMany({
    include: {
      subMomentType: true,
      moment: { include: { momentType: true, match: true } }
    },
    orderBy: { createdAt: "asc" }
  });
  return rows.map((point) => {
    const eventTime = point.timeSeconds ?? point.moment.startTimeSeconds;
    const period = getMatchPeriodAtTime(point.moment.match, eventTime);
    return {
    id: point.id,
    matchId: point.moment.matchId,
    matchTitle: point.moment.match.title,
    momentId: point.momentId,
    momentTypeName: point.moment.momentType.name,
    subMomentTypeId: point.subMomentTypeId,
    subMomentTypeName: point.subMomentType.name,
    color: point.subMomentType.color,
    timeSeconds: point.timeSeconds,
    fieldX: point.fieldX,
    fieldY: point.fieldY,
    goalX: point.goalX,
    goalY: point.goalY,
      outcome: point.outcome,
      period,
      attackDirection: getAttackDirectionAtTime(point.moment.match, eventTime)
    };
  });
}

export async function saveMomentType(input: Record<string, unknown>, id?: string) {
  const data = {
    name: String(input.name || "").trim(),
    code: String(input.code || "").trim().toUpperCase(),
    color: String(input.color || "#2dd66f"),
    defaultShortcut: optionalString(input.defaultShortcut),
    sortOrder: Number(input.sortOrder || 0)
  };
  if (!data.name || !data.code) throw new Error("Name and code are required.");
  return id ? prisma.momentType.update({ where: { id }, data }) : prisma.momentType.create({ data });
}

export async function saveSubMomentType(input: Record<string, unknown>, id?: string) {
  const data = {
    name: String(input.name || "").trim(),
    code: String(input.code || "").trim().toUpperCase(),
    color: String(input.color || "#38bdf8"),
    requiresFieldLocation: input.requiresFieldLocation !== false,
    requiresGoalLocation: input.requiresGoalLocation === true,
    defaultShortcut: optionalString(input.defaultShortcut),
    sortOrder: Number(input.sortOrder || 0)
  };
  if (!data.name || !data.code) throw new Error("Name and code are required.");
  return id ? prisma.subMomentType.update({ where: { id }, data }) : prisma.subMomentType.create({ data });
}

export const deleteMoment = (id: string) => prisma.moment.delete({ where: { id } });
export const deleteSubMoment = (id: string) => prisma.subMoment.delete({ where: { id } });

function optionalString(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return String(value).trim();
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("Invalid number.");
  return number;
}

function optionalCoordinate(value: unknown) {
  const number = optionalNumber(value);
  if (number === null) return null;
  if (number < 0 || number > 100) throw new Error("Coordinates must be between 0 and 100.");
  return number;
}

type PeriodMarkerKey = "firstHalfStartSeconds" | "firstHalfEndSeconds" | "secondHalfStartSeconds" | "secondHalfEndSeconds";

function validatePeriodMarkers(markers: Record<PeriodMarkerKey, number | null>) {
  const ordered = [
    [markers.firstHalfStartSeconds, "Start 1st half"],
    [markers.firstHalfEndSeconds, "End 1st half"],
    [markers.secondHalfStartSeconds, "Start 2nd half"],
    [markers.secondHalfEndSeconds, "End 2nd half"]
  ] as const;
  for (const [seconds, label] of ordered) {
    if (seconds !== null && seconds < 0) throw new Error(`${label} cannot be negative.`);
  }
  let previous: number | null = null;
  for (const [seconds] of ordered) {
    if (seconds === null) continue;
    if (previous !== null && seconds < previous) throw new Error("Match period markers must be saved in chronological order.");
    previous = seconds;
  }
}
