import { describe, it, expect } from "vitest";
import { ShuffleDeck, DealCards, FirstPlayer, CreateCardState, SwapWithNeutral, MovesForPlayer } from "./deck.js";
import { CardsByName } from "./cards.js";

// builds a test card; suit defaults to red, moves to a single forward step
function MakeCard(name, suit = "red", moves = [{ x: 0, y: 1 }])
{
  return { name, suit, moves };
}

// builds n distinct test cards with alternating suits
function MakeDeck(n)
{
  return Array.from({ length: n }, (_, i) => MakeCard(`c${i}`, i % 2 === 0 ? "red" : "blue"));
}

// returns the card names in order, for comparing deck orderings
function Names(cards)
{
  return cards.map((card) => card.name);
}

// builds a card state with known hands and neutral card
function MakeState()
{
  return { hands: { red: ["a", "b"], blue: ["c", "d"] }, neutral: "e", currentPlayer: "red" };
}

// Game play setup 4: shuffle the deck from a seed
describe("ShuffleDeck", () =>
{
  it("gives the same order for the same seed", () =>
  {
    const deck = MakeDeck(16);
    expect(Names(ShuffleDeck(deck, "seed-1"))).toEqual(Names(ShuffleDeck(deck, "seed-1")));
  });

  it("gives different orders for different seeds", () =>
  {
    const deck = MakeDeck(16);
    expect(Names(ShuffleDeck(deck, "seed-1"))).not.toEqual(Names(ShuffleDeck(deck, "seed-2")));
  });

  it("returns a permutation of the input", () =>
  {
    const deck = MakeDeck(16);
    expect([...Names(ShuffleDeck(deck, "x"))].sort()).toEqual([...Names(deck)].sort());
  });

  it("does not mutate the input deck", () =>
  {
    const deck = MakeDeck(16);
    const before = structuredClone(deck);
    ShuffleDeck(deck, "x");
    expect(deck).toEqual(before);
  });
});

// Game play setup 5-7: two cards each, the fifth to the neutral zone
describe("DealCards", () =>
{
  it("deals cards 0-1 to red, 2-3 to blue and 4 to neutral by name", () =>
  {
    expect(DealCards(MakeDeck(16))).toEqual({
      hands: { red: ["c0", "c1"], blue: ["c2", "c3"] },
      neutral: "c4",
    });
  });

  it("deals five distinct cards", () =>
  {
    const { hands, neutral } = DealCards(ShuffleDeck(MakeDeck(16), "deal"));
    expect(new Set([...hands.red, ...hands.blue, neutral]).size).toBe(5);
  });
});

// Game play setup 8: the neutral card's suit decides who goes first
describe("FirstPlayer", () =>
{
  const byName = CardsByName([MakeCard("r", "red"), MakeCard("b", "blue")]);

  it("picks red when the neutral card is red", () =>
  {
    expect(FirstPlayer("r", byName)).toBe("red");
  });

  it("picks blue when the neutral card is blue", () =>
  {
    expect(FirstPlayer("b", byName)).toBe("blue");
  });
});

// Game play setup 4-8 combined
describe("CreateCardState", () =>
{
  it("sets the current player from the dealt neutral card", () =>
  {
    const deck = MakeDeck(16);
    const state = CreateCardState(deck, "game");
    expect(state.currentPlayer).toBe(CardsByName(deck).get(state.neutral).suit);
  });

  it("is reproducible for the same seed", () =>
  {
    const deck = MakeDeck(16);
    expect(CreateCardState(deck, "game")).toEqual(CreateCardState(deck, "game"));
  });
});

// Turn structure step 6: swap the used card with the neutral card
describe("SwapWithNeutral", () =>
{
  it("puts the used card in neutral and the old neutral card in its hand slot", () =>
  {
    const next = SwapWithNeutral(MakeState(), "red", "b");
    expect(next.hands.red).toEqual(["a", "e"]);
    expect(next.neutral).toBe("b");
  });

  it("leaves the other hand untouched", () =>
  {
    expect(SwapWithNeutral(MakeState(), "blue", "c").hands.red).toEqual(["a", "b"]);
  });

  it("returns null for a card that isn't in the player's hand", () =>
  {
    expect(SwapWithNeutral(MakeState(), "red", "c")).toBeNull();
    expect(SwapWithNeutral(MakeState(), "red", "e")).toBeNull();
  });

  it("returns null for an unknown player", () =>
  {
    expect(SwapWithNeutral(MakeState(), "green", "a")).toBeNull();
  });

  it("does not mutate the input state", () =>
  {
    const state = MakeState();
    const before = structuredClone(state);
    SwapWithNeutral(state, "red", "a");
    expect(state).toEqual(before);
  });
});

// Game play rule 9: blue pieces are rotated 180 degrees, negating x and y
describe("MovesForPlayer", () =>
{
  const card = MakeCard("t", "red", [{ x: -2, y: 1 }, { x: 0, y: 2 }]);

  it("returns red's moves as written", () =>
  {
    expect(MovesForPlayer(card, "red")).toEqual([{ x: -2, y: 1 }, { x: 0, y: 2 }]);
  });

  it("negates both axes for blue", () =>
  {
    expect(MovesForPlayer(card, "blue")).toEqual([{ x: 2, y: -1 }, { x: 0, y: -2 }]);
  });

  it("never produces -0 for blue", () =>
  {
    const [flipped] = MovesForPlayer(MakeCard("z", "red", [{ x: 0, y: 1 }]), "blue");
    expect(Object.is(flipped.x, 0)).toBe(true);
  });

  it("returns copies, not the card's own move objects", () =>
  {
    expect(MovesForPlayer(card, "red")[0]).not.toBe(card.moves[0]);
  });
});
