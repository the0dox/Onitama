import { describe, it, expect } from "vitest";
import { CheckMove } from "./moves.js";

// one step right (+x) or one step forward (+y), written from red's perspective
const STEP = { name: "step", suit: "red", moves: [{ x: 1, y: 0 }, { x: 0, y: 1 }] };
// one step in each of the four directions, for hitting every board edge
const CROSS = { name: "cross", suit: "blue", moves: [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }] };
// never dealt to anyone in the default hands; used as the neutral card
const SPARE = { name: "spare", suit: "red", moves: [{ x: 0, y: 1 }] };
const CARDS_BY_NAME = new Map([[STEP.name, STEP], [CROSS.name, CROSS], [SPARE.name, SPARE]]);
// both players hold both test cards unless a test says otherwise
const HANDS = { red: [STEP.name, CROSS.name], blue: [STEP.name, CROSS.name] };

// builds a 5x5 board indexed board[x][y] holding only the given pieces
function MakeBoard(pieces)
{
  return Array.from({ length: 5 }, (_, x) =>
    Array.from({ length: 5 }, (_, y) => pieces.find((p) => p.x === x && p.y === y)?.piece ?? null));
}

// card state with currentPlayer to move; hands default to HANDS, the neutral card is SPARE
function MakeCardState(currentPlayer, hands = HANDS)
{
  return { hands, neutral: SPARE.name, currentPlayer };
}

// runs CheckMove as red on red's turn, which most tests need
function RedMove(board, start, cardName, moveIndex)
{
  return CheckMove(board, MakeCardState("red"), "red", start, cardName, moveIndex, CARDS_BY_NAME);
}

// Turn structure / server validation: only the player whose turn it is may move
describe("CheckMove: turn", () =>
{
  it("rejects the player whose turn it is not", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "b" }]);
    expect(CheckMove(board, MakeCardState("red"), "blue", { x: 1, y: 3 }, "step", 0, CARDS_BY_NAME))
      .toEqual({ ok: false, reason: "not-your-turn" });
  });

  it("rejects a spectator (no colour)", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    expect(CheckMove(board, MakeCardState("red"), null, { x: 1, y: 3 }, "step", 0, CARDS_BY_NAME))
      .toEqual({ ok: false, reason: "not-your-turn" });
  });

  it("checks the turn before the start square", () =>
  {
    expect(CheckMove(MakeBoard([]), MakeCardState("red"), "blue", { x: 9, y: 9 }, "step", 0, CARDS_BY_NAME).reason)
      .toBe("not-your-turn");
  });
});

// Game play rule 6 / server validation: the moving piece must be the sender's own, on the board
describe("CheckMove: start square", () =>
{
  it("rejects a start off any edge of the board without throwing", () =>
  {
    const board = MakeBoard([]);
    [{ x: 5, y: 0 }, { x: -1, y: 2 }, { x: 0, y: 5 }, { x: 2, y: -1 }].forEach((start) =>
    {
      expect(RedMove(board, start, "step", 0)).toEqual({ ok: false, reason: "no-piece" });
    });
  });

  it("rejects a missing or malformed start without throwing", () =>
  {
    const board = MakeBoard([{ x: 0, y: 0, piece: "r" }]);
    [null, undefined, {}, { x: "0", y: "0" }, "0,0"].forEach((start) =>
    {
      expect(RedMove(board, start, "step", 0)).toEqual({ ok: false, reason: "no-piece" });
    });
  });

  it("rejects an empty start square", () =>
  {
    expect(RedMove(MakeBoard([]), { x: 1, y: 3 }, "step", 0)).toEqual({ ok: false, reason: "no-piece" });
  });

  it("rejects moving an enemy disciple or sensei", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "b" }, { x: 2, y: 4, piece: "B" }]);
    expect(RedMove(board, { x: 1, y: 3 }, "step", 0)).toEqual({ ok: false, reason: "no-piece" });
    expect(RedMove(board, { x: 2, y: 4 }, "step", 0)).toEqual({ ok: false, reason: "no-piece" });
  });
});

// Turn structure 2: the player selects one of the two cards in their own hand
describe("CheckMove: card in hand", () =>
{
  it("rejects a card only the opponent holds", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    // five distinct cards: red cross/other, blue step/another, SPARE neutral
    const state = MakeCardState("red", { red: [CROSS.name, "other"], blue: [STEP.name, "another"] });
    expect(CheckMove(board, state, "red", { x: 1, y: 3 }, "step", 0, CARDS_BY_NAME))
      .toEqual({ ok: false, reason: "not-in-hand" });
  });

  it("rejects the neutral card", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    expect(RedMove(board, { x: 1, y: 3 }, SPARE.name, 0)).toEqual({ ok: false, reason: "not-in-hand" });
  });

  it("rejects a card name that is not in the deck", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    expect(RedMove(board, { x: 1, y: 3 }, "no-such-card", 0)).toEqual({ ok: false, reason: "not-in-hand" });
  });

  it("rejects a missing or non-string card name without throwing", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    [null, undefined, 0, {}, ["step"]].forEach((cardName) =>
    {
      expect(RedMove(board, { x: 1, y: 3 }, cardName, 0)).toEqual({ ok: false, reason: "not-in-hand" });
    });
  });

  it("checks the hand for blue too", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "b" }]);
    const state = MakeCardState("blue", { red: [STEP.name, "other"], blue: [CROSS.name, "another"] });
    expect(CheckMove(board, state, "blue", { x: 1, y: 3 }, "step", 1, CARDS_BY_NAME))
      .toEqual({ ok: false, reason: "not-in-hand" });
  });

  it("checks the hand before the move index", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    expect(RedMove(board, { x: 1, y: 3 }, SPARE.name, 99).reason).toBe("not-in-hand");
  });

  it("checks the start square before the hand", () =>
  {
    expect(RedMove(MakeBoard([]), { x: 1, y: 3 }, SPARE.name, 0).reason).toBe("no-piece");
  });
});

// Game play rule 9: the move must be a real move on a known card
describe("CheckMove: card and move index", () =>
{
  it("rejects a held card that has no definition", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    const state = MakeCardState("red", { red: ["mystery", STEP.name], blue: HANDS.blue });
    expect(CheckMove(board, state, "red", { x: 1, y: 3 }, "mystery", 0, CARDS_BY_NAME))
      .toEqual({ ok: false, reason: "bad-move" });
  });

  it("rejects a move index past either end of the card", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    [2, -1, 99, null].forEach((moveIndex) =>
    {
      expect(RedMove(board, { x: 1, y: 3 }, "step", moveIndex)).toEqual({ ok: false, reason: "bad-move" });
    });
  });
});

// Game play rule 6 / turn structure 4: targets must be on the board and not hold a friendly piece
describe("CheckMove: target square", () =>
{
  it("rejects a target off each of the four edges without throwing", () =>
  {
    // corner pieces pushed outward: (4,0) right, (0,0) left, (0,4) down, (4,0) up
    const board = MakeBoard([{ x: 0, y: 0, piece: "r" }, { x: 4, y: 0, piece: "r" }, { x: 0, y: 4, piece: "r" }]);
    const cases = [
      { start: { x: 4, y: 0 }, moveIndex: 0 },
      { start: { x: 0, y: 0 }, moveIndex: 1 },
      { start: { x: 0, y: 4 }, moveIndex: 2 },
      { start: { x: 4, y: 0 }, moveIndex: 3 },
    ];
    cases.forEach(({ start, moveIndex }) =>
    {
      expect(RedMove(board, start, "cross", moveIndex)).toEqual({ ok: false, reason: "bad-target" });
    });
  });

  it("rejects a target holding the player's own piece", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }, { x: 2, y: 3, piece: "R" }]);
    expect(RedMove(board, { x: 1, y: 3 }, "step", 0)).toEqual({ ok: false, reason: "bad-target" });
  });

  it("rejects blue landing on its own piece using the flipped move", () =>
  {
    // STEP[0] is +1 x for red, so -1 x for blue: (1,3) -> (0,3)
    const board = MakeBoard([{ x: 1, y: 3, piece: "b" }, { x: 0, y: 3, piece: "b" }]);
    expect(CheckMove(board, MakeCardState("blue"), "blue", { x: 1, y: 3 }, "step", 0, CARDS_BY_NAME))
      .toEqual({ ok: false, reason: "bad-target" });
  });
});

// Game play rule 7 and the happy path: legal moves, including captures, are accepted
describe("CheckMove: legal moves", () =>
{
  it("accepts a move to an empty square and returns the target", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    expect(RedMove(board, { x: 1, y: 3 }, "step", 1)).toEqual({ ok: true, target: { x: 1, y: 4 } });
  });

  it("accepts a capture of an enemy piece", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }, { x: 2, y: 3, piece: "B" }]);
    expect(RedMove(board, { x: 1, y: 3 }, "step", 0)).toEqual({ ok: true, target: { x: 2, y: 3 } });
  });

  it("flips the move for blue", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "b" }]);
    expect(CheckMove(board, MakeCardState("blue"), "blue", { x: 1, y: 3 }, "step", 1, CARDS_BY_NAME))
      .toEqual({ ok: true, target: { x: 1, y: 2 } });
  });

  it("accepts either card in the hand", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    expect(RedMove(board, { x: 1, y: 3 }, "step", 0).ok).toBe(true);
    expect(RedMove(board, { x: 1, y: 3 }, "cross", 1).ok).toBe(true);
  });

  it("does not modify the board or the card state", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }, { x: 2, y: 3, piece: "B" }]);
    const state = MakeCardState("red");
    const before = structuredClone({ board, state });
    CheckMove(board, state, "red", { x: 1, y: 3 }, "step", 0, CARDS_BY_NAME);
    expect({ board, state }).toEqual(before);
  });
});
