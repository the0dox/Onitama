import { describe, it, expect } from "vitest";
import { ValidTargets, TargetFor } from "./moves.js";
import { CreateBoard } from "./board.js";

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
