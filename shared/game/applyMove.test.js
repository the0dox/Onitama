import { describe, it, expect } from "vitest";
import { ApplyMove, ApplyPass } from "./turn.js";
import { MakeBoard } from "./testBoard.js";

// card state with currentPlayer to move: red holds a/b, blue holds c/d, n is neutral
function MakeCardState(currentPlayer)
{
  return { hands: { red: ["a", "b"], blue: ["c", "d"] }, neutral: "n", currentPlayer };
}

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
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }, { x: 4, y: 4, piece: "b" }]);
    const result = ApplyMove(board, MakeCardState("red"), { x: 1, y: 3 }, { x: 1, y: 4 }, "b");
    expect(result.cardState).toEqual({ hands: { red: ["a", "n"], blue: ["c", "d"] }, neutral: "b", currentPlayer: "blue" });
    expect(result.winner).toBeNull();
  });

  it("swaps blue's used card with the neutral card and passes the turn to red", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "b" }, { x: 0, y: 0, piece: "r" }]);
    const result = ApplyMove(board, MakeCardState("blue"), { x: 1, y: 3 }, { x: 1, y: 2 }, "c");
    expect(result.cardState).toEqual({ hands: { red: ["a", "b"], blue: ["n", "d"] }, neutral: "c", currentPlayer: "red" });
    expect(result.winner).toBeNull();
  });

  it("throws if the card is not in the mover's hand, since CheckMove should have rejected it", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }]);
    expect(() => ApplyMove(board, MakeCardState("red"), { x: 1, y: 3 }, { x: 1, y: 4 }, "c")).toThrow();
  });
});

// Turn structure 7 and 8: a winning move still swaps the card, but the turn does not pass
describe("ApplyMove: victory", () =>
{
  it("red sensei reaching blue's gate wins and keeps red as currentPlayer", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "R" }, { x: 0, y: 4, piece: "b" }]);
    const result = ApplyMove(board, MakeCardState("red"), { x: 1, y: 3 }, { x: 2, y: 4 }, "a");
    expect(result.winner).toBe("red");
    expect(result.cardState).toEqual({ hands: { red: ["n", "b"], blue: ["c", "d"] }, neutral: "a", currentPlayer: "red" });
  });

  it("blue capturing red's last piece wins and keeps blue as currentPlayer", () =>
  {
    const board = MakeBoard([{ x: 3, y: 2, piece: "b" }, { x: 1, y: 1, piece: "r" }]);
    const result = ApplyMove(board, MakeCardState("blue"), { x: 3, y: 2 }, { x: 1, y: 1 }, "d");
    expect(result.winner).toBe("blue");
    expect(result.cardState).toEqual({ hands: { red: ["a", "b"], blue: ["c", "n"] }, neutral: "d", currentPlayer: "blue" });
  });

  it("capturing the enemy sensei alone does not win while disciples remain", () =>
  {
    const board = MakeBoard([{ x: 1, y: 3, piece: "r" }, { x: 2, y: 2, piece: "B" }, { x: 4, y: 4, piece: "b" }]);
    const result = ApplyMove(board, MakeCardState("red"), { x: 1, y: 3 }, { x: 2, y: 2 }, "a");
    expect(result.winner).toBeNull();
    expect(result.cardState.currentPlayer).toBe("blue");
  });
});

// Turn structure 1 straight to 6 and 8: a pass only swaps the chosen card and hands the turn over
describe("ApplyPass", () =>
{
  it("swaps red's chosen card with the neutral card and passes the turn to blue", () =>
  {
    expect(ApplyPass(MakeCardState("red"), "b")).toEqual({ hands: { red: ["a", "n"], blue: ["c", "d"] }, neutral: "b", currentPlayer: "blue" });
  });

  it("swaps blue's chosen card with the neutral card and passes the turn to red", () =>
  {
    expect(ApplyPass(MakeCardState("blue"), "c")).toEqual({ hands: { red: ["a", "b"], blue: ["n", "d"] }, neutral: "c", currentPlayer: "red" });
  });

  it("leaves the input card state unchanged", () =>
  {
    const cardState = MakeCardState("red");
    const before = structuredClone(cardState);
    ApplyPass(cardState, "a");
    expect(cardState).toEqual(before);
  });

  it("throws if the card is not in the passer's hand, since CheckPass should have rejected it", () =>
  {
    expect(() => ApplyPass(MakeCardState("red"), "c")).toThrow(/CheckPass/);
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
