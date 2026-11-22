import { describe, it, expect } from "vitest";
import { HashSeed, CreateRng } from "./random.js";

// draws the first n values from a fresh generator for the given numeric seed
function Draw(seedNumber, n)
{
  const rng = CreateRng(seedNumber);
  return Array.from({ length: n }, () => rng());
}

// Game play setup 4: the shuffle is driven by a reproducible seed
describe("HashSeed", () =>
{
  it("hashes the same string to the same unsigned 32-bit value", () =>
  {
    const hash = HashSeed("onitama");
    expect(HashSeed("onitama")).toBe(hash);
    expect(Number.isInteger(hash) && hash >= 0 && hash <= 0xffffffff).toBe(true);
  });

  it("hashes different strings to different values", () =>
  {
    expect(HashSeed("alpha")).not.toBe(HashSeed("beta"));
  });

  it("accepts numeric-looking seeds as strings", () =>
  {
    expect(HashSeed("42")).toBe(HashSeed(42));
  });
});

// Game play setup 4: same seed -> same random sequence
describe("CreateRng", () =>
{
  it("produces the same sequence for the same seed", () =>
  {
    expect(Draw(1234, 10)).toEqual(Draw(1234, 10));
  });

  it("produces different sequences for different seeds", () =>
  {
    expect(Draw(1, 10)).not.toEqual(Draw(2, 10));
  });

  it("stays within [0, 1)", () =>
  {
    Draw(99, 1000).forEach((value) =>
    {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });
});
