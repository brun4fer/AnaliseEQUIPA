import assert from "node:assert/strict";
import test from "node:test";
import { formatMatchClock, matchClockSeconds, scoreAtTime, validateScoreboardSettings, validateScoreEvent } from "./scoreboard";
import type { MatchScoreEventRecord } from "./domain";

const periods = { firstHalfStartSeconds: 10, firstHalfEndSeconds: 2830, secondHalfStartSeconds: 3000, secondHalfEndSeconds: 5820 };
test("clock accounts for video offsets, halftime, stoppage time and full time", () => {
  assert.equal(matchClockSeconds(periods, 5), 0);
  assert.equal(matchClockSeconds(periods, 70), 60);
  assert.equal(formatMatchClock(matchClockSeconds(periods, 2900)), "47:00");
  assert.equal(formatMatchClock(matchClockSeconds(periods, 3000)), "45:00");
  assert.equal(formatMatchClock(matchClockSeconds(periods, 6000)), "92:00");
  assert.equal(matchClockSeconds({ ...periods, firstHalfStartSeconds: null }, 1000), 0);
});

test("seeking through score and red card history uses event time, and does not mutate history", () => {
  const event = (id: string, timeSeconds: number, homeScore: number, homeRedCards = 0): MatchScoreEventRecord => ({ id, matchId: "match", timeSeconds, homeScore, awayScore: 0, homeRedCards, awayRedCards: 0, createdAt: id, updatedAt: id });
  const events = [event("3", 300, 2, 1), event("1", 100, 1), event("2", 100, 0)];
  assert.equal(scoreAtTime(events, 50).homeScore, 0);
  assert.equal(scoreAtTime(events, 101).homeScore, 0);
  assert.deepEqual(scoreAtTime(events, 301), { homeScore: 2, awayScore: 0, homeRedCards: 1, awayRedCards: 0 });
  assert.equal(scoreAtTime(events, 200).homeRedCards, 0);
  assert.deepEqual(events.map((item) => item.id), ["3", "1", "2"]);
});

test("reject invalid score data and events outside the video", () => {
  const input = { timeSeconds: 100, homeScore: 1, awayScore: 0, homeRedCards: 0, awayRedCards: 0 };
  assert.deepEqual(validateScoreEvent(input, 200), input);
  for (const invalid of [{ timeSeconds: -1 }, { timeSeconds: NaN }, { homeScore: 1.5 }, { awayScore: -1 }, { homeScore: "1" }, { awayRedCards: 12 }]) assert.throws(() => validateScoreEvent({ ...input, ...invalid }, 200));
  assert.throws(() => validateScoreEvent(input, 90));
});

test("scoreboard is opt-in and accepts only bounded settings and raster badges", () => {
  assert.deepEqual(validateScoreboardSettings({}), {});
  assert.deepEqual(validateScoreboardSettings({ scoreboardEnabled: false, homeClubShortName: " ABC " }), { scoreboardEnabled: false, homeClubShortName: "ABC" });
  for (const invalid of [{ scoreboardEnabled: "false" }, { homeTeamColor: "red" }, { homeClubShortName: "ABCDE" }, { homeClubLogoDataUrl: "https://example.org/badge.png" }, { awayClubLogoDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }]) assert.throws(() => validateScoreboardSettings(invalid));
});
