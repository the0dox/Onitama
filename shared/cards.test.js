import { describe, it, expect } from "vitest";
import { CARDS, CardsByName } from "./game/cards.js";

// Game play rule 9: the deck is 16 cards, each with a name, a suit and a set of moves
describe("cards.json", () =>
{
  it("has 16 cards with unique names", () =>
  {
    expect(CARDS).toHaveLength(16);
    expect(new Set(CARDS.map((card) => card.name)).size).toBe(16);
  });

  it("splits evenly into 8 red and 8 blue suits", () =>
  {
    expect(CARDS.filter((card) => card.suit === "red")).toHaveLength(8);
    expect(CARDS.filter((card) => card.suit === "blue")).toHaveLength(8);
  });

  it("gives every card at least one integer move within [-2, 2] that isn't (0,0)", () =>
  {
    CARDS.forEach((card) =>
    {
      expect(card.moves.length, card.name).toBeGreaterThan(0);
      card.moves.forEach((move) =>
      {
        expect(Number.isInteger(move.x) && Number.isInteger(move.y), card.name).toBe(true);
        expect(Math.abs(move.x) <= 2 && Math.abs(move.y) <= 2, card.name).toBe(true);
        expect(move.x === 0 && move.y === 0, card.name).toBe(false);
      });
    });
  });

  it("defines horse as forward, back or left", () =>
  {
    const horse = CardsByName(CARDS).get("horse");
    expect(horse.suit).toBe("red");
    expect(horse.moves).toHaveLength(3);
    expect(horse.moves).toContainEqual({ x: 0, y: 1 });
    expect(horse.moves).toContainEqual({ x: 0, y: -1 });
    expect(horse.moves).toContainEqual({ x: -1, y: 0 });
  });

  it("makes each mirrored pair the x-flip of the other", () =>
  {
    const byName = CardsByName(CARDS);
    const pairs = [["frog", "rabbit"], ["goose", "rooster"], ["horse", "ox"], ["eel", "cobra"]];
    pairs.forEach(([left, right]) =>
    {
      const mirrored = byName.get(left).moves.map((move) => ({ x: 0 - move.x, y: move.y }));
      expect(byName.get(right).moves, `${left}/${right}`).toHaveLength(mirrored.length);
      mirrored.forEach((move) => expect(byName.get(right).moves, `${left}/${right}`).toContainEqual(move));
    });
  });

  it("is frozen against runtime modification", () =>
  {
    expect(Object.isFrozen(CARDS)).toBe(true);
    expect(Object.isFrozen(CARDS[0].moves[0])).toBe(true);
  });
});
