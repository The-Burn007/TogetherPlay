import { randomInt } from "crypto";

if (typeof window !== "undefined") {
  throw new Error("Security Violation: Server random utilities cannot be loaded in client browser bundle.");
}

/**
 * Server-Side Cryptographically Secure Randomness Module
 * 
 * ARCHITECTURE PRINCIPLES:
 * 1. THE BROWSER IS UNTRUSTED: Random outcomes (dice, targets, countdowns, card shuffles)
 *    must never originate from or be determined by the client.
 * 2. CRYPTOGRAPHIC INTEGRITY: All authoritative randomness is generated server-side using
 *    rejection-sampled CSPRNG (node:crypto randomInt) with zero modulo bias.
 * 3. NO BIASED SHUFFLES: Array shuffles strictly use the Fisher-Yates (Knuth) algorithm
 *    driven by cryptographic randomness, completely replacing biased sort(() => Math.random()) anti-patterns.
 * 4. TEST INJECTION DISCIPLINE: Deterministic test injection is strictly limited to
 *    server-side test infrastructure via setTestRandomSource(). It is forbidden in production
 *    and cannot be influenced by client action payloads.
 */

export interface ServerRandomSource {
  randomInt(min: number, maxInclusive: number): number;
  randomChoice<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

let activeTestRandomSource: ServerRandomSource | null = null;

/**
 * Generates a cryptographically secure uniform random integer in the range [min, maxInclusive].
 * Uses node:crypto.randomInt with rejection sampling to eliminate modulo bias.
 */
export function secureRandomInt(min: number, maxInclusive: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(maxInclusive)) {
    throw new TypeError(`Arguments to secureRandomInt must be finite numbers. Received min=${min}, maxInclusive=${maxInclusive}`);
  }
  const minInt = Math.floor(min);
  const maxInt = Math.floor(maxInclusive);

  if (minInt > maxInt) {
    throw new RangeError(`min (${minInt}) cannot be greater than maxInclusive (${maxInt})`);
  }

  if (minInt === maxInt) {
    return minInt;
  }

  if (activeTestRandomSource) {
    return activeTestRandomSource.randomInt(minInt, maxInt);
  }

  // node:crypto randomInt is [min, maxExclusive), so maxInt + 1 gives [minInt, maxInt] inclusive.
  return randomInt(minInt, maxInt + 1);
}

/**
 * Selects a random element uniformly from a non-empty array using CSPRNG.
 */
export function secureRandomChoice<T>(items: readonly T[]): T {
  if (!items || items.length === 0) {
    throw new RangeError("Cannot pick random element from an empty array.");
  }
  if (items.length === 1) {
    return items[0];
  }
  if (activeTestRandomSource) {
    return activeTestRandomSource.randomChoice(items);
  }
  const index = secureRandomInt(0, items.length - 1);
  return items[index];
}

/**
 * Fisher-Yates (Knuth) Shuffle driven by cryptographically secure random integers.
 * Guarantees every permutation is equally likely with no modulo or sorting bias.
 */
export function secureFisherYatesShuffle<T>(items: readonly T[]): T[] {
  if (!items || items.length <= 1) {
    return items ? [...items] : [];
  }
  if (activeTestRandomSource) {
    return activeTestRandomSource.shuffle(items);
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
 * Injects a deterministic random source for testing purposes.
 * FORBIDDEN in production environments.
 */
export function setTestRandomSource(source: ServerRandomSource | null): void {
  if (process.env.NODE_ENV === "production" && source !== null) {
    throw new Error("Security Violation: Test random source injection is strictly forbidden in production.");
  }
  activeTestRandomSource = source;
}

/**
 * Returns the currently active test random source, or null.
 */
export function getTestRandomSource(): ServerRandomSource | null {
  return activeTestRandomSource;
}

/**
 * Clears any active test random source, restoring default CSPRNG behavior.
 */
export function resetTestRandomSource(): void {
  activeTestRandomSource = null;
}

/**
 * Executes an asynchronous or synchronous scope with a specified test random source,
 * cleanly restoring the previous random source upon completion.
 */
export async function withTestRandomSource<T>(
  source: ServerRandomSource,
  fn: () => T | Promise<T>
): Promise<T> {
  const previous = activeTestRandomSource;
  setTestRandomSource(source);
  try {
    return await fn();
  } finally {
    setTestRandomSource(previous);
  }
}

/**
 * Test Infrastructure Class: DeterministicTestRandomSource
 * Provides deterministic sequences of dice rolls, integers, or seeded shuffles for reproducible testing.
 */
export class DeterministicTestRandomSource implements ServerRandomSource {
  private diceSequence: number[];
  private diceIndex = 0;
  private integerSequence: number[];
  private integerIndex = 0;
  private seed: number;

  constructor(options?: {
    diceSequence?: number[];
    integerSequence?: number[];
    seed?: number;
  }) {
    this.diceSequence = options?.diceSequence ? [...options.diceSequence] : [];
    this.integerSequence = options?.integerSequence ? [...options.integerSequence] : [];
    this.seed = options?.seed !== undefined ? options.seed : 123456789;
  }

  // Simple, fast deterministic PRNG (Mulberry32) for reproducible tests
  private nextPrngFloat(): number {
    this.seed |= 0;
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  randomInt(min: number, maxInclusive: number): number {
    if (min === 1 && maxInclusive === 6 && this.diceSequence.length > 0) {
      const roll = this.diceSequence[this.diceIndex % this.diceSequence.length];
      this.diceIndex++;
      return roll;
    }

    if (this.integerSequence.length > 0) {
      const val = this.integerSequence[this.integerIndex % this.integerSequence.length];
      this.integerIndex++;
      return Math.min(Math.max(val, min), maxInclusive);
    }

    // Seed-based deterministic integer
    const range = maxInclusive - min + 1;
    return min + Math.floor(this.nextPrngFloat() * range);
  }

  randomChoice<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError("Cannot choose from empty array");
    }
    const idx = this.randomInt(0, items.length - 1);
    return items[idx];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i);
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }
}
