import assert from "node:assert/strict";
import test from "node:test";
import { compareGames } from "./compare-games";
import type { MatchDetail, MomentRecord } from "./domain";

function moment(id: string, momentTypeId: string, outcome: string | null, types: string[], period: string | null = "first_half"): MomentRecord {
  return { id, momentTypeId, outcome, period, startTimeSeconds: 10, endTimeSeconds: 20, subMoments: types.map((subMomentTypeId) => ({ subMomentTypeId })) } as MomentRecord;
}
function match(id: string, date: string | null, moments: MomentRecord[]): MatchDetail { return { id, title: id, matchDate: date, moments } as MatchDetail; }
const first = match("first", "2026-01-01", [moment("a", "attack", "positive", ["shot", "shot", "goal"]), moment("b", "defend", "negative", []), moment("c", "attack", null, [])]);

test("comparison orders games chronologically, with undated games last, without mutating input", () => {
  const input = [match("undated", null, []), match("second", "2026-01-02", []), first];
  assert.deepEqual(compareGames(input).map((row) => row.id), ["first", "second", "undated"]);
  assert.equal(input[0].id, "undated");
});
test("each clip counts once while repeated submoment occurrences are retained", () => {
  const [row] = compareGames([first], { momentTypeId: "attack", submomentTypeId: "shot" });
  assert.equal(row.moments, 1); assert.equal(row.submoments, 2); assert.equal(row.duration, 10); assert.equal(row.positiveRate, 100);
  assert.equal(compareGames([first], { momentTypeId: "defend", submomentTypeId: "shot" })[0].moments, 0);
});
test("positive percentages exclude unclassified moments and no classification is not zero percent", () => {
  const [row] = compareGames([first]);
  assert.equal(row.moments, 3); assert.equal(row.unclassified, 1); assert.equal(row.positiveRate, 50); assert.equal(row.duration, 30);
  const [empty] = compareGames([match("empty", null, [])]);
  assert.equal(empty.moments, 0); assert.equal(empty.positiveRate, null);
  assert.deepEqual(compareGames([]), []);
});
test("period filters follow the Maps selection and hide unassigned moments in both-halves mode", () => {
  const sample = match("periods", "2026-01-03", [
    moment("first", "attack", null, [], "first_half"),
    moment("second", "attack", null, [], "second_half"),
    moment("unassigned", "attack", null, [], null),
  ]);
  assert.equal(compareGames([sample], { period: "both" })[0].moments, 2);
  assert.equal(compareGames([sample], { period: "first_half" })[0].moments, 1);
});
