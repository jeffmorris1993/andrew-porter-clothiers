import type { Mode } from "@/lib/schemas";

/* Pure Decision Desk logic — unit tested. */

export const MAX_COMPARE = 3;

export type SavedKind = "brief" | "discovery";

export interface SavedItem {
  id: string;
  kind: SavedKind;
  refId: string;
  mode: Mode;
  savedAt: string;
  status: "active" | "dismissed";
}

export interface DecisionRecord {
  id: string;
  mode: Mode;
  subjectName: string;
  briefId?: string;
  actionId?: string;
  actionTitle?: string;
  choice: string;
  note?: string;
  at: string;
}

/** Adds or removes an id. Refuses (returns the same list) when already at the maximum. */
export function toggleCompare(ids: string[], id: string, max = MAX_COMPARE): { ids: string[]; refused: boolean } {
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), refused: false };
  if (ids.length >= max) return { ids, refused: true };
  return { ids: [...ids, id], refused: false };
}

export function upsertSaved(items: SavedItem[], next: Omit<SavedItem, "id" | "savedAt" | "status">, now: string): SavedItem[] {
  const existing = items.find((i) => i.kind === next.kind && i.refId === next.refId);
  if (existing) return items.map((i) => (i === existing ? { ...i, status: "active" as const } : i));
  return [{ ...next, id: `${next.kind}:${next.refId}`, savedAt: now, status: "active" }, ...items];
}

export function setSavedStatus(items: SavedItem[], id: string, status: SavedItem["status"]): SavedItem[] {
  return items.map((i) => (i.id === id ? { ...i, status } : i));
}

export function visibleSaved(items: SavedItem[], mode: Mode, status: SavedItem["status"] | "all" = "active"): SavedItem[] {
  return items.filter((i) => i.mode === mode && (status === "all" || i.status === status));
}

/** A dismissed or removed item can't stay in the comparison. */
export function pruneCompare(ids: string[], items: SavedItem[]): string[] {
  return ids.filter((id) => items.some((i) => i.id === id && i.status === "active"));
}

export function recordDecision(list: DecisionRecord[], rec: Omit<DecisionRecord, "id" | "at">, now: string): DecisionRecord[] {
  return [{ ...rec, id: `${now}-${list.length + 1}`, at: now }, ...list].slice(0, 200);
}
