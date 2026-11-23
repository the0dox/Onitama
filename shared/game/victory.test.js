import { describe, it, expect } from "vitest";
import { Winner, HasSenseiOnEnemyGate, HasPieces } from "./victory.js";
import { CreateBoard } from "./board.js";
import { MakeBoard } from "./testBoard.js";

// Game play rule 4: a sensei on the opponent's gate wins
describe("HasSenseiOnEnemyGate", () =>
{
  it("is true for the red sensei on blue's gate (2,4)", () =>
  {
    expect(HasSenseiOnEnemyGate(MakeBoard([{ x: 2, y: 4, piece: "R" }]), "red")).toBe(true);
  });

  it("is true for the blue sensei on red's gate (2,0)", () =>
  {
    expect(HasSenseiOnEnemyGate(MakeBoard([{ x: 2, y: 0, piece: "B" }]), "blue")).toBe(true);
  });

  it("is false for a disciple on the enemy gate", () =>
  {
    expect(HasSenseiOnEnemyGate(MakeBoard([{ x: 2, y: 4, piece: "r" }]), "red")).toBe(false);
    expect(HasSenseiOnEnemyGate(MakeBoard([{ x: 2, y: 0, piece: "b" }]), "blue")).toBe(false);
  });

  it("is false for a sensei on its own gate", () =>
  {
    expect(HasSenseiOnEnemyGate(MakeBoard([{ x: 2, y: 0, piece: "R" }]), "red")).toBe(false);
    expect(HasSenseiOnEnemyGate(MakeBoard([{ x: 2, y: 4, piece: "B" }]), "blue")).toBe(false);
  });

  it("is false for a sensei next to the gate", () =>
  {
    expect(HasSenseiOnEnemyGate(MakeBoard([{ x: 1, y: 4, piece: "R" }]), "red")).toBe(false);
  });
});

// Game play rule 8: a player with no pieces loses
describe("HasPieces", () =>
{
  it("counts disciples and senseis of the given colour only", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "b" }]);
    expect(HasPieces(board, "blue")).toBe(true);
    expect(HasPieces(board, "red")).toBe(false);
  });

  it("is false on an empty board", () =>
  {
    expect(HasPieces(MakeBoard([]), "red")).toBe(false);
  });
});

// Turn structure 7: either victory condition decides the winner
describe("Winner", () =>
{
  it("is null on the starting board", () =>
  {
    expect(Winner(CreateBoard())).toBeNull();
  });

  it("is red when the red sensei reaches blue's gate while blue still has pieces", () =>
  {
    const board = MakeBoard([{ x: 2, y: 4, piece: "R" }, { x: 0, y: 4, piece: "b" }]);
    expect(Winner(board)).toBe("red");
  });

  it("is blue when the blue sensei reaches red's gate while red still has pieces", () =>
  {
    const board = MakeBoard([{ x: 2, y: 0, piece: "B" }, { x: 4, y: 0, piece: "r" }]);
    expect(Winner(board)).toBe("blue");
  });

  it("is red when blue has no pieces left", () =>
  {
    expect(Winner(MakeBoard([{ x: 1, y: 3, piece: "r" }]))).toBe("red");
  });

  it("is blue when red has no pieces left", () =>
  {
    expect(Winner(MakeBoard([{ x: 3, y: 1, piece: "b" }]))).toBe("blue");
  });

  it("is null when a side lost its sensei but still has disciples", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }, { x: 2, y: 2, piece: "B" }]);
    expect(Winner(board)).toBeNull();
  });

  it("is null for disciples standing on the enemy gates", () =>
  {
    const board = MakeBoard([{ x: 2, y: 4, piece: "r" }, { x: 2, y: 0, piece: "b" }]);
    expect(Winner(board)).toBeNull();
  });
});
