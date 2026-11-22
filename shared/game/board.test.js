import { describe, it, expect } from "vitest";
import { BOARD_SIZE, CreateBoard, StartingPiece } from "./board.js";

// returns the pieces along row y, reading x from left to right
function Row(board, y)
{
  return board.map((column) => column[y]);
}

// Game play setup 1-3: 5x5 grid, red on row 0, blue on row 4, senseis on their gates
describe("CreateBoard", () =>
{
  it("is a 5x5 grid indexed board[x][y]", () =>
  {
    const board = CreateBoard();
    expect(board).toHaveLength(BOARD_SIZE);
    board.forEach((column) => expect(column).toHaveLength(BOARD_SIZE));
  });

  it("places red disciples on row 0 with the red sensei on (2,0)", () =>
  {
    const board = CreateBoard();
    expect(Row(board, 0)).toEqual(["r", "r", "R", "r", "r"]);
    expect(board[2][0]).toBe("R");
  });

  it("places blue disciples on row 4 with the blue sensei on (2,4)", () =>
  {
    const board = CreateBoard();
    expect(Row(board, 4)).toEqual(["b", "b", "B", "b", "b"]);
    expect(board[2][4]).toBe("B");
  });

  it("leaves rows 1-3 empty", () =>
  {
    const board = CreateBoard();
    [1, 2, 3].forEach((y) => expect(Row(board, y)).toEqual([null, null, null, null, null]));
  });

  it("returns independent boards and columns on every call", () =>
  {
    const a = CreateBoard();
    const b = CreateBoard();
    a[0][0] = null;
    expect(b[0][0]).toBe("r");
    expect(a[1][0]).toBe("r");
  });
});

describe("StartingPiece", () =>
{
  it("returns null for the middle of the board", () =>
  {
    expect(StartingPiece(2, 2)).toBeNull();
  });
});
