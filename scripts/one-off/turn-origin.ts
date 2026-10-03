import type { TurnOrigin, Destination } from "../../src/types.ts";

type LegacyTurnOrigin = {
  triggerTs?: string;
  entryTs?: string;
  triggered?: boolean;
  securityScreenData?: string;
  triggerDestination?: Destination;
  ownerKeychainUnion?: boolean;
  ownerResourcesRequireOpen?: boolean;
  unprompted?: boolean;
  liveActor?: boolean;
};

function resolveTurnOrigin(input: Partial<LegacyTurnOrigin> & { origin?: TurnOrigin }): TurnOrigin {
  const typed = input.origin;
  const hasLegacy = input.triggered === true || input.unprompted === true || input.liveActor === true;
  if (!typed) return normalizeTurnOrigin(input);
  if (!hasLegacy) return typed;
  const legacy = normalizeTurnOrigin(input);
  const rank: Record<TurnOrigin["kind"], number> = { direct: 0, human: 1, ambient: 2, automation: 3 };
  if (rank[typed.kind] !== rank[legacy.kind]) return rank[typed.kind] > rank[legacy.kind] ? typed : legacy;
  if (typed.kind === "automation" && legacy.kind === "automation") {
    let screenData = typed.screenData;
    if (screenData === undefined) screenData = legacy.screenData;
    else if (legacy.screenData !== undefined && screenData !== legacy.screenData) {
      screenData = `Typed automation data:\n${screenData}\n\nLegacy automation data:\n${legacy.screenData}`;
    }
    return {
      kind: "automation",
      ...(screenData !== undefined ? { screenData } : {}),
      ...((typed.destination ?? legacy.destination) ? { destination: typed.destination ?? legacy.destination! } : {}),
      ...(typed.useOwnerKeychain || legacy.useOwnerKeychain ? { useOwnerKeychain: true } : {}),
      ...(typed.ownerResourcesRequireOpen || legacy.ownerResourcesRequireOpen
        ? { ownerResourcesRequireOpen: true }
        : {}),
    };
  }
  if (typed.kind === "human" && legacy.kind === "human") {
    return {
      kind: "human",
      ...((typed.messageTs ?? legacy.messageTs) ? { messageTs: typed.messageTs ?? legacy.messageTs! } : {}),
      ...((typed.entryTs ?? legacy.entryTs) ? { entryTs: typed.entryTs ?? legacy.entryTs! } : {}),
    };
  }
  if (typed.kind === "ambient" && legacy.kind === "ambient") {
    return {
      kind: "ambient",
      ...((typed.entryTs ?? legacy.entryTs) ? { entryTs: typed.entryTs ?? legacy.entryTs! } : {}),
      ...(typed.live === true || legacy.live === true ? { live: true } : {}),
    };
  }
  return typed;
}

function normalizeTurnOrigin(input: LegacyTurnOrigin): TurnOrigin {
  if (input.triggered === true) {
    return {
      kind: "automation",
      ...(input.securityScreenData !== undefined ? { screenData: input.securityScreenData } : {}),
      ...(input.triggerDestination ? { destination: input.triggerDestination } : {}),
      ...(input.ownerKeychainUnion === true ? { useOwnerKeychain: true } : {}),
      ...(input.ownerResourcesRequireOpen === true ? { ownerResourcesRequireOpen: true } : {}),
    };
  }
  if (input.unprompted === true) {
    return {
      kind: "ambient",
      ...(typeof input.entryTs === "string" && input.entryTs ? { entryTs: input.entryTs } : {}),
      ...(input.liveActor === true ? { live: true } : {}),
    };
  }
  if (input.liveActor === true) {
    return {
      kind: "human",
      ...(typeof input.triggerTs === "string" && input.triggerTs ? { messageTs: input.triggerTs } : {}),
      ...(typeof input.entryTs === "string" && input.entryTs ? { entryTs: input.entryTs } : {}),
    };
  }
  return { kind: "direct" };
}

export function migrateTurnOrigin(input: Record<string, unknown>): Record<string, unknown> {
  const origin = resolveTurnOrigin(input);
  const next: Record<string, unknown> = { ...input, origin };
  for (const key of [
    "triggerTs",
    "entryTs",
    "triggered",
    "securityScreenData",
    "triggerDestination",
    "ownerKeychainUnion",
    "ownerResourcesRequireOpen",
    "unprompted",
    "liveActor",
  ])
    delete next[key];
  return next;
}

if (import.meta.main) {
  const { default: pg } = await import("pg");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const apply = process.argv.includes("--apply");
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    options: "-c statement_timeout=30000 -c lock_timeout=1000",
  });
  await client.connect();
  try {
    for (const [table, column, paths] of [
      ["runs", "request", [""]],
      ["approvals", "json", ["request"]],
      ["run_signals", "payload", ["request", "sessionRequest"]],
    ] as const) {
      let cursor = "";
      let changed = 0;
      for (;;) {
        const { rows } = await client.query(
          `SELECT id::text, ${column} AS data FROM ${table} WHERE id::text > $1 ORDER BY id::text LIMIT 100`,
          [cursor],
        );
        if (!rows.length) break;
        for (const row of rows) {
          cursor = row.id;
          const before = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
          if (!before) continue;
          let after = { ...before };
          for (const path of paths) {
            if (path === "") after = migrateTurnOrigin(after);
            else if (after[path]) after[path] = migrateTurnOrigin(after[path]);
          }
          if (JSON.stringify(before) === JSON.stringify(after)) continue;
          changed++;
          if (apply) {
            const result = await client.query(
              `UPDATE ${table} SET ${column} = $1 WHERE id::text = $2 AND ${column}::jsonb = $3::jsonb`,
              [JSON.stringify(after), row.id, JSON.stringify(before)],
            );
            if (result.rowCount !== 1) throw new Error(`${table}/${row.id} changed concurrently; rerun migration`);
          }
        }
      }
      console.log(JSON.stringify({ table, changed, apply }));
      if (!apply && changed) process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}
