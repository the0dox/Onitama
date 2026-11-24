import { describe, it, expect, vi } from "vitest";
import { LoadServerSettings, ResolveOverrideDeck } from "./settings.js";
import { CARDS, CardsByName } from "../../shared/game/cards.js";

const BY_NAME = CardsByName(CARDS);

// reader that fails like readFileSync on a missing file
function MissingFile()
{
  throw Object.assign(new Error("no such file"), { code: "ENOENT" });
}

describe("LoadServerSettings", () =>
{
  it("returns {} quietly when the file is missing", () =>
  {
    const warn = vi.fn();
    expect(LoadServerSettings(MissingFile, warn)).toEqual({});
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns {} with a warning on invalid JSON", () =>
  {
    const warn = vi.fn();
    expect(LoadServerSettings(() => "{ nope", warn)).toEqual({});
    expect(warn).toHaveBeenCalledOnce();
  });

  it("returns the parsed settings", () =>
  {
    expect(LoadServerSettings(() => '{ "overrideDeck": null }')).toEqual({ overrideDeck: null });
  });

  it("loads the committed serverSettings.json with no override", () =>
  {
    expect(LoadServerSettings().overrideDeck).toBeNull();
  });
});

describe("ResolveOverrideDeck", () =>
{
  it("returns null quietly when overrideDeck is unset or null", () =>
  {
    const warn = vi.fn();
    expect(ResolveOverrideDeck({}, BY_NAME, warn)).toBeNull();
    expect(ResolveOverrideDeck({ overrideDeck: null }, BY_NAME, warn)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns null with a warning for an invalid deck", () =>
  {
    const warn = vi.fn();
    expect(ResolveOverrideDeck({ overrideDeck: ["horse", "nope", "ox", "tiger", "crab"] }, BY_NAME, warn)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown-card"));
  });

  it("returns the cards in order for a valid deck", () =>
  {
    const names = ["horse", "ox", "tiger", "crab", "monkey"];
    const deck = ResolveOverrideDeck({ overrideDeck: names }, BY_NAME);
    expect(deck.map((card) => card.name)).toEqual(names);
  });
});
