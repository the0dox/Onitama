/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import Lobby from "./Lobby.jsx";

afterEach(cleanup);

const ROOMS = [
  { id: "AAAA", name: "alpha", red: true, blue: false, members: 1, status: "playing" },
  { id: "BBBB", name: "beta", red: true, blue: true, members: 3, status: "over" },
];

describe("Lobby", () =>
{
  it("lists each room with its seats and a Join button", () =>
  {
    const onJoin = vi.fn();
    render(<Lobby rooms={ROOMS} onJoin={onJoin} onCreate={() => {}} />);
    expect(screen.getByText("red taken, blue free · 1 here · playing")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Join" })[1]);
    expect(onJoin).toHaveBeenCalledWith("BBBB");
  });

  it("shows an empty message with no rooms", () =>
  {
    render(<Lobby rooms={[]} onJoin={() => {}} onCreate={() => {}} />);
    expect(screen.getByText("No rooms yet")).toBeTruthy();
  });

  it("creates a room with the trimmed name and disables Create while blank", () =>
  {
    const onCreate = vi.fn();
    render(<Lobby rooms={[]} onJoin={() => {}} onCreate={onCreate} />);
    const create = screen.getByRole("button", { name: "Create room" });
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Room name"), { target: { value: "  my game " } });
    fireEvent.click(create);
    expect(onCreate).toHaveBeenCalledWith("my game");
  });
});
