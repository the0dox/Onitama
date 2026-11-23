import { describe, it, expect } from "vitest";
import { ValidTargets, TargetFor, HasLegalMove, CheckPass } from "./moves.js";
import { CreateBoard } from "./board.js";
import { MakeBoard } from "./testBoard.js";

// one step forward (+y) and one step right (+x) from red's perspective; blue's are flipped
const FWD = { name: "fwd", suit: "red", moves: [{ x: 0, y: 1 }] };
const RIGHT = { name: "right", suit: "blue", moves: [{ x: 1, y: 0 }] };
const PASS_CARDS = new Map([[FWD.name, FWD], [RIGHT.name, RIGHT]]);

// both players hold fwd and right; n is neutral
function PassCardState(currentPlayer)
{
  return { hands: { red: ["fwd", "right"], blue: ["fwd", "right"] }, neutral: "n", currentPlayer };
}

// Game play turn structure 1: find out whether any piece/card pair has a legal move
describe("HasLegalMove", () =>
{
  it("is true on the starting board for both colours", () =>
  {
    expect(HasLegalMove(CreateBoard(), PassCardState("red"), "red", PASS_CARDS)).toBe(true);
    expect(HasLegalMove(CreateBoard(), PassCardState("blue"), "blue", PASS_CARDS)).toBe(true);
  });

  it("is false for red cornered at (4,4) where every move leaves the board", () =>
  {
    const board = MakeBoard([{ x: 4, y: 4, piece: "r" }, { x: 0, y: 0, piece: "b" }]);
    expect(HasLegalMove(board, PassCardState("red"), "red", PASS_CARDS)).toBe(false);
  });

  it("is false for blue cornered at (0,0), since blue's moves are flipped", () =>
  {
    const board = MakeBoard([{ x: 4, y: 4, piece: "r" }, { x: 0, y: 0, piece: "b" }]);
    expect(HasLegalMove(board, PassCardState("blue"), "blue", PASS_CARDS)).toBe(false);
  });

  it("is false when the only on-board target holds a friendly piece", () =>
  {
    const board = MakeBoard([{ x: 4, y: 3, piece: "r" }, { x: 4, y: 4, piece: "R" }]);
    expect(HasLegalMove(board, PassCardState("red"), "red", PASS_CARDS)).toBe(false);
  });

  it("is true when the only target holds an enemy piece (capture)", () =>
  {
    const board = MakeBoard([{ x: 4, y: 3, piece: "r" }, { x: 4, y: 4, piece: "b" }]);
    expect(HasLegalMove(board, PassCardState("red"), "red", PASS_CARDS)).toBe(true);
  });

  it("is false when the player has no pieces", () =>
  {
    expect(HasLegalMove(MakeBoard([]), PassCardState("red"), "red", PASS_CARDS)).toBe(false);
  });
});

// a pass is accepted only on the sender's turn, with a held card, when no legal move exists
describe("CheckPass", () =>
{
  const stuck = MakeBoard([{ x: 4, y: 4, piece: "r" }, { x: 0, y: 0, piece: "b" }]);

  it("accepts red passing with a held card when red has no legal move", () =>
  {
    expect(CheckPass(stuck, PassCardState("red"), "red", "fwd", PASS_CARDS)).toEqual({ ok: true });
  });

  it("rejects spectators and the player who is not on turn", () =>
  {
    expect(CheckPass(stuck, PassCardState("red"), null, "fwd", PASS_CARDS)).toEqual({ ok: false, reason: "not-your-turn" });
    expect(CheckPass(stuck, PassCardState("red"), "blue", "fwd", PASS_CARDS)).toEqual({ ok: false, reason: "not-your-turn" });
  });

  it("rejects cards that are not in the sender's hand, including non-strings", () =>
  {
    expect(CheckPass(stuck, PassCardState("red"), "red", "n", PASS_CARDS)).toEqual({ ok: false, reason: "not-in-hand" });
    expect(CheckPass(stuck, PassCardState("red"), "red", 0, PASS_CARDS)).toEqual({ ok: false, reason: "not-in-hand" });
  });

  it("rejects a pass while a legal move exists", () =>
  {
    expect(CheckPass(CreateBoard(), PassCardState("red"), "red", "fwd", PASS_CARDS)).toEqual({ ok: false, reason: "has-legal-move" });
  });
});

const HORSE = { name: "horse", suit: "red", moves: [{ x: -2, y: 2 }, { x: 2, y: 2 }] };

// builds an empty 5x5 board indexed board[x][y]
function EmptyBoard()
{
  return Array.from({ length: 5 }, () => Array(5).fill(null));
}

// returns a copy of board with piece placed at (x, y)
function Place(board, x, y, piece)
{
  return board.map((column, cx) => column.map((cell, cy) => (cx === x && cy === y ? piece : cell)));
}

// Game play turn structure 4: targets stay on the board and avoid friendly pieces
describe("ValidTargets", () =>
{
  it("returns red's horse targets from the sensei with their move indices", () =>
  {
    expect(ValidTargets(CreateBoard(), { x: 2, y: 0 }, HORSE, "red")).toEqual([
      { x: 0, y: 2, moveIndex: 0 },
      { x: 4, y: 2, moveIndex: 1 },
    ]);
  });

  it("flips the moves for blue", () =>
  {
    expect(ValidTargets(CreateBoard(), { x: 2, y: 4 }, HORSE, "blue")).toEqual([
      { x: 4, y: 2, moveIndex: 0 },
      { x: 0, y: 2, moveIndex: 1 },
    ]);
  });

  it("drops targets that fall off the board", () =>
  {
    expect(ValidTargets(CreateBoard(), { x: 0, y: 0 }, HORSE, "red")).toEqual([{ x: 2, y: 2, moveIndex: 1 }]);
  });

  it("drops targets occupied by the player's own piece", () =>
  {
    const board = Place(EmptyBoard(), 0, 2, "r");
    expect(ValidTargets(board, { x: 2, y: 0 }, HORSE, "red")).toEqual([{ x: 4, y: 2, moveIndex: 1 }]);
  });

  it("keeps targets occupied by an enemy piece (capture)", () =>
  {
    const board = Place(EmptyBoard(), 0, 2, "B");
    expect(ValidTargets(board, { x: 2, y: 0 }, HORSE, "red")).toContainEqual({ x: 0, y: 2, moveIndex: 0 });
  });
});

describe("TargetFor", () =>
{
  it("resolves a move index to a square from the player's perspective", () =>
  {
    expect(TargetFor({ x: 2, y: 0 }, HORSE, "red", 1)).toEqual({ x: 4, y: 2 });
    expect(TargetFor({ x: 2, y: 4 }, HORSE, "blue", 1)).toEqual({ x: 0, y: 2 });
  });

  it("returns null for an out-of-range index", () =>
  {
    expect(TargetFor({ x: 2, y: 0 }, HORSE, "red", 5)).toBeNull();
  });
});
