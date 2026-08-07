import { prisma } from "@/lib/prisma";

export async function GET() {
  const [seasons, clubs, competitions, matches, videos, momentTypes, subMomentTypes, moments, subMoments] = await Promise.all([
    prisma.season.findMany(), prisma.club.findMany(), prisma.competition.findMany({ include: { clubs: { select: { id: true } } } }), prisma.match.findMany(), prisma.video.findMany(), prisma.momentType.findMany(), prisma.subMomentType.findMany(), prisma.moment.findMany(), prisma.subMoment.findMany()
  ]);
  const payload = { version: 1, exportedAt: new Date().toISOString(), seasons, clubs, competitions: competitions.map(({ clubs: linked, ...item }) => ({ ...item, clubIds: linked.map((club) => club.id) })), matches, videos, momentTypes, subMomentTypes, moments, subMoments };
  const body = JSON.stringify(payload, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="feirense-analysis-backup-${date}.json"`, "Cache-Control": "no-store" } });
}
