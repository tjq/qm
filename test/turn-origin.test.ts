import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateTurnOrigin } from "../scripts/one-off/turn-origin.ts";
import { replayableRequest } from "../src/core/orchestrator/turn-helpers.ts";
import type { OrchestratorInput } from "../src/core/orchestrator/types.ts";

test("one-time turn migration preserves least-interactive provenance and screening data", () => {
  assert.deepEqual(
    migrateTurnOrigin({
      origin: { kind: "human" },
      triggered: true,
      securityScreenData: "payload",
      ownerKeychainUnion: true,
    }),
    {
      origin: { kind: "automation", screenData: "payload", useOwnerKeychain: true },
    },
  );
  assert.deepEqual(migrateTurnOrigin({ unprompted: true, liveActor: true, entryTs: "1" }), {
    origin: { kind: "ambient", live: true, entryTs: "1" },
  });
  const value = { text: "hello", origin: { kind: "human", messageTs: "1" } };
  assert.deepEqual(migrateTurnOrigin(value), value);
});

test("approval replay preserves the typed origin without synthesizing legacy flags", () => {
  const input = {
    actor: { id: "alice", type: "internal" },
    conversation: { kind: "dm", threadRef: "test", audience: [] },
    text: "hello",
    origin: { kind: "automation", screenData: "payload", useOwnerKeychain: true, ownerResourcesRequireOpen: true },
  } as OrchestratorInput;
  const request = replayableRequest(input);
  assert.deepEqual(request.origin, input.origin);
  for (const key of ["triggered", "unprompted", "liveActor", "securityScreenData", "ownerKeychainUnion"])
    assert.equal(key in request, false);
});
