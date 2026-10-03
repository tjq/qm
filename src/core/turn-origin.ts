import type { TurnOrigin } from "../types.ts";
export type { TurnOrigin } from "../types.ts";

export function isPersonAuthored(kind: TurnOrigin["kind"]): boolean {
  return kind === "human" || kind === "direct";
}

export function turnOriginError(input: { origin?: TurnOrigin }): string | null {
  if (
    [
      "triggerTs",
      "entryTs",
      "triggered",
      "securityScreenData",
      "triggerDestination",
      "ownerKeychainUnion",
      "ownerResourcesRequireOpen",
      "unprompted",
      "liveActor",
    ].some((key) => key in input)
  )
    return "legacy turn provenance is no longer supported; migrate stored requests and send origin instead";
  const origin = input.origin;
  if (origin === undefined) return null;
  if (!origin || !["direct", "human", "ambient", "automation"].includes(origin.kind)) return "invalid turn origin";
  return null;
}
