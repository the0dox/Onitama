/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import SeatPicker from "./SeatPicker.jsx";

afterEach(cleanup);

describe("SeatPicker", () =>
{
  it("enables both sides when both seats are free", () =>
  {
    render(<SeatPicker seats={{ red: false, blue: false, mine: null }} onPick={() => {}} />);
    expect(screen.getByRole("button", { name: "Play red" }).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Play blue" }).disabled).toBe(false);
  });

  it("disables a taken side", () =>
  {
    render(<SeatPicker seats={{ red: true, blue: false, mine: null }} onPick={() => {}} />);
    expect(screen.getByRole("button", { name: "Play red" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Play blue" }).disabled).toBe(false);
  });

  it("reports the picked colour", () =>
  {
    const onPick = vi.fn();
    render(<SeatPicker seats={{ red: false, blue: false, mine: null }} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "Play blue" }));
    expect(onPick).toHaveBeenCalledWith("blue");
  });

  it("renders nothing once seated", () =>
  {
    const { container } = render(<SeatPicker seats={{ red: true, blue: false, mine: "red" }} onPick={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing before the server sent seats", () =>
  {
    const { container } = render(<SeatPicker seats={null} onPick={() => {}} />);
    expect(container.innerHTML).toBe("");
  });
});
