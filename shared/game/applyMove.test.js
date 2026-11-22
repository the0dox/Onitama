import { describe, it, expect } from "vitest";
import { ApplyMove, OtherPlayer } from "./turn.js";

// builds a 5x5 board indexed board[x][y] holding only the given pieces
function MakeBoard(pieces)
{
  return Array.from({ length: 5 }, (_, x) =>
    Array.from({ length: 5 }, (_, y) => pieces.find((p) => p.x === x && p.y === y)?.piece ?? null));
}

// card state with currentPlayer to move: red holds a/b, blue holds c/d, n is neutral
function MakeCardState(currentPlayer)
{
  return { hands: { red: ["a", "b"], blue: ["c", "d"] }, neutral: "n", currentPlayer };
}

// Turn structure 8: the turn passes to the other player
describe("OtherPlayer", () =>
{
  it("swaps red and blue", () =>
  {
    expect(OtherPlayer("red")).toBe("blue");
    expect(OtherPlayer("blue")).toBe("red");
  });
});

// Turn structure 5 / game play rule 7: the piece moves, replacing anything on the target
describe("ApplyMove: board", () =>
{
  it("moves the piece and empties its start square", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    const result = ApplyMove(board, MakeCardState("red"), { x: 1, y: 3 }, { x: 2, y: 4 }, "a");
    expect(result.board).toEqual(MakeBoard([{ x: 2, y: 4, piece: "r" }]));
  });

  it("replaces a captured enemy piece", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "R" }, { x: 3, y: 1, piece: "B" }]);
    const result = ApplyMove(board, MakeCardState("red"), { x: 1, y: 3 }, { x: 3, y: 1 }, "a");
    expect(result.board).toEqual(MakeBoard([{ x: 3, y: 1, piece: "R" }]));
  });

  it("moves a blue piece on blue's turn", () =>
  {
    const board = MakeBoard([{ x: 0, y: 4, piece: "b" }, { x: 4, y: 0, piece: "r" }]);
    const result = ApplyMove(board, MakeCardState("blue"), { x: 0, y: 4 }, { x: 1, y: 2 }, "c");
    expect(result.board).toEqual(MakeBoard([{ x: 1, y: 2, piece: "b" }, { x: 4, y: 0, piece: "r" }]));
  });

  it("leaves every other square alone", () =>
  {
    const others = [{ x: 0, y: 0, piece: "r" }, { x: 2, y: 0, piece: "R" }, { x: 2, y: 4, piece: "B" }, { x: 4, y: 4, piece: "b" }];
    const board = MakeBoard([...others, { x: 1, y: 3, piece: "r" }]);
    const result = ApplyMove(board, MakeCardState("red"), { x: 1, y: 3 }, { x: 1, y: 4 }, "a");
    expect(result.board).toEqual(MakeBoard([...others, { x: 1, y: 4, piece: "r" }]));
  });
});

// Turn structure 6 and 8: the used card swaps with the neutral card, then the turn passes
describe("ApplyMove: cards and turn", () =>
{
  it("swaps red's used card with the neutral card and passes the turn to blue", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    const result = ApplyMove(board, MakeCardState("red"), { x: 1, y: 3 }, { x: 1, y: 4 }, "b");
    expect(result.cardState).toEqual({ hands: { red: ["a", "n"], blue: ["c", "d"] }, neutral: "b", currentPlayer: "blue" });
  });

  it("swaps blue's used card with the neutral card and passes the turn to red", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "b" }]);
    const result = ApplyMove(board, MakeCardState("blue"), { x: 1, y: 3 }, { x: 1, y: 2 }, "c");
    expect(result.cardState).toEqual({ hands: { red: ["a", "b"], blue: ["n", "d"] }, neutral: "c", currentPlayer: "red" });
  });

  it("throws if the card is not in the mover's hand, since CheckMove should have rejected it", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    expect(() => ApplyMove(board, MakeCardState("red"), { x: 1, y: 3 }, { x: 1, y: 4 }, "c")).toThrow();
  });
});

// shared/ functions are pure: inputs stay unchanged and the result shares no arrays with them
describe("ApplyMove: purity", () =>
{
  it("does not modify the board or the card state", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }, { x: 2, y: 4, piece: "B" }]);
    const cardState = MakeCardState("red");
    const before = structuredClone({ board, cardState });
    ApplyMove(board, cardState, { x: 1, y: 3 }, { x: 2, y: 4 }, "a");
    expect({ board, cardState }).toEqual(before);
  });

  it("returns a board whose columns are new arrays", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    const result = ApplyMove(board, MakeCardState("red"), { x: 1, y: 3 }, { x: 1, y: 4 }, "a");
    result.board.forEach((column, x) =>
    {
      expect(column).not.toBe(board[x]);
    });
  });
});
