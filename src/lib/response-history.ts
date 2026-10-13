export type SavedResponse = {
  id: string;
  productId: string;
  query: string;
  response: string;
  component: string;
  mode: "standard" | "direct";
  kind: "answer" | "document";
  createdAt: number;
};

const STORAGE_PREFIX = "orca-response-history:v1:";
const MAX_HISTORY = 5;

function storageKey(subject: string, productId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(subject)}:${encodeURIComponent(productId)}`;
}

export function readResponseHistory(subject: string, productId: string): SavedResponse[] {
  if (typeof window === "undefined") return [];

  try {
    const serialized = window.sessionStorage.getItem(storageKey(subject, productId));
    if (!serialized) return [];

    const entries: unknown = JSON.parse(serialized);
    return Array.isArray(entries) ? entries.filter(isSavedResponse).slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export function saveResponseHistoryEntry(subject: string, entry: SavedResponse): SavedResponse[] {
  if (typeof window === "undefined") return [];

  const key = storageKey(subject, entry.productId);
  const entries = [entry, ...readResponseHistory(subject, entry.productId)].slice(0, MAX_HISTORY);

  try {
    window.sessionStorage.setItem(key, JSON.stringify(entries));
  } catch {
    return readResponseHistory(subject, entry.productId);
  }

  return entries;
}

export function clearResponseHistory(): void {
  if (typeof window === "undefined") return;

  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    return;
  }
}

function isSavedResponse(value: unknown): value is SavedResponse {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<SavedResponse>;
  return (
    typeof entry.id === "string" &&
    typeof entry.productId === "string" &&
    typeof entry.query === "string" &&
    typeof entry.response === "string" &&
    typeof entry.component === "string" &&
    (entry.mode === "standard" || entry.mode === "direct") &&
    (entry.kind === "answer" || entry.kind === "document") &&
    typeof entry.createdAt === "number"
  );
}
