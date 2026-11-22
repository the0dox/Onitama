// Deterministic seeded randomness, so a DECK_SEED reproduces the same shuffle on any machine.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

// hashes any string to an unsigned 32-bit integer (FNV-1a)
export function HashSeed(seedString)
{
  return Array.from(String(seedString)).reduce(
    (hash, ch) => Math.imul(hash ^ ch.codePointAt(0), FNV_PRIME) >>> 0,
    FNV_OFFSET,
  );
}

// returns a mulberry32 generator: each call yields the next float in [0, 1) for this seed
export function CreateRng(seedNumber)
{
  let state = seedNumber >>> 0;
  return () =>
  {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
