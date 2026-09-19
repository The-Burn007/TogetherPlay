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

/**
 * Universal cryptographically secure random integer generator using WebCrypto.
 * Employs rejection sampling to strictly eliminate modulo bias.
 * Safe for execution in browser and server environments.
 */
export function secureRandomInt(min: number, maxInclusive: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(maxInclusive)) {
    throw new TypeError(`Arguments must be finite numbers. Received min=${min}, maxInclusive=${maxInclusive}`);
  }
  const minInt = Math.floor(min);
  const maxInt = Math.floor(maxInclusive);

  if (minInt > maxInt) {
    throw new RangeError(`min (${minInt}) cannot be greater than maxInclusive (${maxInt})`);
  }
  if (minInt === maxInt) {
    return minInt;
  }

  const range = maxInt - minInt + 1;
  const maxValid = Math.floor(0xffffffff / range) * range;
  const buffer = new Uint32Array(1);
  let randomVal: number;
  do {
    crypto.getRandomValues(buffer);
    randomVal = buffer[0];
  } while (randomVal >= maxValid);

  return minInt + (randomVal % range);
}

/**
 * Universal Fisher-Yates (Knuth) Shuffle driven by cryptographically secure randomness.
 * Guarantees every permutation has equal probability with zero sorting bias.
 */
export function secureFisherYatesShuffle<T>(items: readonly T[]): T[] {
  if (!items || items.length <= 1) {
    return items ? [...items] : [];
  }
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(0, i);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Universal secure random item selector from a non-empty array.
 */
export function secureRandomChoice<T>(items: readonly T[]): T {
  if (!items || items.length === 0) {
    throw new RangeError("Cannot choose from empty array");
  }
  const idx = secureRandomInt(0, items.length - 1);
  return items[idx];
}

/**
 * Universal cryptographically secure random hexadecimal string generator.
 */
export function secureRandomHex(byteCount = 8): string {
  const buffer = new Uint8Array(byteCount);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

