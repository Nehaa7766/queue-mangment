// One idempotency key per join attempt, kept in sessionStorage so a retry
// or a double tap reuses it and the server never creates two tokens.

const memoryFallback = new Map<string, string>();

function storageKey(queueId: string): string {
  return `queuecare:join-key:${queueId}`;
}

// crypto.randomUUID() only exists on HTTPS and localhost; getRandomValues
// works everywhere, including the plain-HTTP Docker E2E host.
function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function getOrCreateJoinKey(queueId: string): string {
  const name = storageKey(queueId);
  try {
    const existing = window.sessionStorage.getItem(name);
    if (existing) {
      return existing;
    }
    const key = randomKey();
    window.sessionStorage.setItem(name, key);
    return key;
  } catch {
    // Private browsing can block storage; keep the key for this page instead.
    const existing = memoryFallback.get(name);
    if (existing) {
      return existing;
    }
    const key = randomKey();
    memoryFallback.set(name, key);
    return key;
  }
}

// Call once the outcome is known, so the next join is a new attempt.
export function clearJoinKey(queueId: string): void {
  const name = storageKey(queueId);
  memoryFallback.delete(name);
  try {
    window.sessionStorage.removeItem(name);
  } catch {
    // Storage unavailable; nothing to clear.
  }
}
