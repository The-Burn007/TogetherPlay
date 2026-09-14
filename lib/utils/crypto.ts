/**
 * Cryptographic utilities for secure invitation pairing.
 * Generates pairing tokens and computes SHA-256 digests
 * so that plaintext secrets are never stored in the database.
 */

export async function sha256(message: string): Promise<string> {
  const normalized = message.trim().toUpperCase();
  const msgBuffer = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates an emotionally pleasant, memorable yet cryptographically secure
 * pairing code formatted like: SANCT-7K9M-3W2P
 */
export function generatePairingCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // removed ambiguous 0/O, 1/I
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 4; i++) {
    part1 += chars[randomBytes[i] % chars.length];
    part2 += chars[randomBytes[i + 4] % chars.length];
  }
  return `SANCT-${part1}-${part2}`;
}
