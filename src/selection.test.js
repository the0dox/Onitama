import { describe, it, expect } from "vitest";
import { EMPTY_SELECTION, ToggleCard, TogglePiece } from "./selection.js";

// Game play turn structure 2-3: card and piece can be picked in either order and changed freely
describe("selection", () =>
{
  it("selects a card then a piece", () =>
  {
    const selection = TogglePiece(ToggleCard(EMPTY_SELECTION, "horse"), { x: 2, y: 0 });
    expect(selection).toEqual({ card: "horse", piece: { x: 2, y: 0 } });
  });

  it("selects a piece then a card", () =>
  {
    const selection = ToggleCard(TogglePiece(EMPTY_SELECTION, { x: 1, y: 0 }), "horse");
    expect(selection).toEqual({ card: "horse", piece: { x: 1, y: 0 } });
  });

  it("replaces the card but keeps the piece", () =>
  {
    const start = { card: "horse", piece: { x: 2, y: 0 } };
    expect(ToggleCard(start, "card-01")).toEqual({ card: "card-01", piece: { x: 2, y: 0 } });
  });

  it("replaces the piece but keeps the card", () =>
  {
    const start = { card: "horse", piece: { x: 2, y: 0 } };
    expect(TogglePiece(start, { x: 3, y: 0 })).toEqual({ card: "horse", piece: { x: 3, y: 0 } });
  });

  it("clears a card or piece when it is clicked again", () =>
  {
    const start = { card: "horse", piece: { x: 2, y: 0 } };
    expect(ToggleCard(start, "horse")).toEqual({ card: null, piece: { x: 2, y: 0 } });
    expect(TogglePiece(start, { x: 2, y: 0 })).toEqual({ card: "horse", piece: null });
  });

  it("does not mutate the previous selection", () =>
  {
    const start = { card: null, piece: null };
    ToggleCard(start, "horse");
    expect(start).toEqual({ card: null, piece: null });
  });
});
