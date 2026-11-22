/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { IsTarget, CardHand } from "./CardHand.jsx";
import { MovesForPlayer } from "../shared/game/deck.js";

const HORSE = { name: "horse", suit: "red", moves: [{ x: -2, y: 2 }, { x: 2, y: 2 }] };
const STEP = { name: "step", suit: "blue", moves: [{ x: 0, y: 1 }] };
const BY_NAME = new Map([[HORSE.name, HORSE], [STEP.name, STEP]]);

afterEach(cleanup);

describe("IsTarget", () =>
{
  it("marks red's horse targets below the piece", () =>
  {
    const moves = MovesForPlayer(HORSE, "red");
    expect(IsTarget(moves, 0, 4)).toBe(true);
    expect(IsTarget(moves, 4, 4)).toBe(true);
    expect(IsTarget(moves, 0, 0)).toBe(false);
  });

  it("marks blue's flipped horse targets above the piece", () =>
  {
    const moves = MovesForPlayer(HORSE, "blue");
    expect(IsTarget(moves, 0, 0)).toBe(true);
    expect(IsTarget(moves, 4, 0)).toBe(true);
    expect(IsTarget(moves, 0, 4)).toBe(false);
  });
});

describe("CardHand", () =>
{
  it("renders every card in the hand", () =>
  {
    render(<CardHand player="red" cardNames={["horse", "step"]} byName={BY_NAME} active={false} />);
    expect(screen.getByText("horse")).toBeInTheDocument();
    expect(screen.getByText("step")).toBeInTheDocument();
  });

  it("highlights the hand only when active", () =>
  {
    render(<CardHand player="blue" cardNames={["horse"]} byName={BY_NAME} active={true} />);
    expect(screen.getByTestId("hand-blue")).toHaveClass("card-hand--active");
    cleanup();
    render(<CardHand player="blue" cardNames={["horse"]} byName={BY_NAME} active={false} />);
    expect(screen.getByTestId("hand-blue")).not.toHaveClass("card-hand--active");
  });

  it("draws one target cell per move", () =>
  {
    const { container } = render(<CardHand player="red" cardNames={["horse"]} byName={BY_NAME} active={false} />);
    expect(container.querySelectorAll(".card-cell--target")).toHaveLength(2);
    expect(container.querySelectorAll(".card-cell--origin")).toHaveLength(1);
  });
});
