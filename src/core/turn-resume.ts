import type { SessionEntry } from "../types.ts";
import { entryDeliveryKey, isOverheardEntry } from "../sessions/session-store.ts";

interface PartialTurn {
  userSeq: number;
  workEntries: number;
}

function entryText(e: SessionEntry): string {
  return String((e.payload as { text?: string } | null)?.text ?? "").trim();
}

export interface RecordedTurn extends PartialTurn {
  answer?: { seq: number; text: string };
}

function isSteerEntry(e: SessionEntry): boolean {
  return (e.payload as { steered?: unknown } | null)?.steered === true;
}

export function turnAtSeq(entries: readonly SessionEntry[], userSeq: number): RecordedTurn | null {
  const start = entries.findIndex((e) => e.seq === userSeq);
  if (start < 0) return null;
  let workEntries = 0;
  let answer: RecordedTurn["answer"];
  for (let i = start + 1; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.type === "assistant") {
      if (!entryDeliveryKey(e)) answer = { seq: e.seq, text: entryText(e) };
      continue;
    }
    if (e.type === "tool_call" || e.type === "tool_result") {
      workEntries += 1;
      continue;
    }
    if (e.type !== "user") continue;
    if (isSteerEntry(e)) {
      workEntries += 1;
      continue;
    }
    if (
      isOverheardEntry(e) ||
      ((e.payload as { runId?: string } | null)?.runId ===
        (entries[start]!.payload as { runId?: string } | null)?.runId &&
        !!(e.payload as { runId?: string } | null)?.runId)
    )
      continue;
    break;
  }
  return { userSeq, workEntries, ...(answer ? { answer } : {}) };
}
