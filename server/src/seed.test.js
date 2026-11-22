import { describe, it, expect, vi } from "vitest";
import { ResolveDeckSeed } from "./seed.js";

describe("ResolveDeckSeed", () =>
{
  it("uses DECK_SEED when it is set", () =>
  {
    const MakeRandom = vi.fn(() => "random");
    expect(ResolveDeckSeed({ DECK_SEED: "abc" }, MakeRandom)).toEqual({ seed: "abc", source: "env" });
    expect(MakeRandom).not.toHaveBeenCalled();
  });

  it("falls back to a random seed when DECK_SEED is missing", () =>
  {
    expect(ResolveDeckSeed({}, () => "f00d")).toEqual({ seed: "f00d", source: "random" });
  });

  it("treats an empty DECK_SEED as missing", () =>
  {
    expect(ResolveDeckSeed({ DECK_SEED: "" }, () => "f00d")).toEqual({ seed: "f00d", source: "random" });
  });
});
