import assert from "node:assert/strict";
import test from "node:test";

import { decodeSsoFlow, encodeSsoFlow, safeNextPath, validCentralIdentity } from "@/lib/sso";

test("round-trips a valid SSO browser flow", () => {
  const flow = { state: "s".repeat(32), verifier: "v".repeat(43), next: "/reports" };
  assert.deepEqual(decodeSsoFlow(encodeSsoFlow(flow)), flow);
});

test("rejects unsafe post-login paths", () => {
  assert.equal(safeNextPath("/reports"), "/reports");
  assert.equal(safeNextPath("https://attacker.example"), "/");
  assert.equal(safeNextPath("//attacker.example"), "/");
  assert.equal(safeNextPath("/\\attacker.example"), "/");
});

test("validates identities returned by the portal", () => {
  assert.equal(validCentralIdentity({
    sub: "5b0fcf6e-9c56-4a2a-bbdd-dfd16473df3d",
    username: "paulo",
    workspaceId: 1,
    workspaceName: "AP",
    workspaceSlug: "ap"
  }), true);
  assert.equal(validCentralIdentity({ sub: "not-a-uuid", username: "paulo" }), false);
});
