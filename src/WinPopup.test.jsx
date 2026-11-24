/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import WinPopup from "./WinPopup.jsx";

afterEach(cleanup);

describe("WinPopup", () =>
{
  it("renders nothing while there is no winner", () =>
  {
    const { container } = render(<WinPopup winner={null} canRematch={true} onRematch={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("announces the winner", () =>
  {
    render(<WinPopup winner="blue" canRematch={false} onRematch={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Game over" })).toBeTruthy();
    expect(screen.getByText("blue wins")).toBeTruthy();
  });

  it("hides the rematch button from spectators", () =>
  {
    render(<WinPopup winner="red" canRematch={false} onRematch={() => {}} />);
    expect(screen.queryByRole("button", { name: "Rematch" })).toBeNull();
  });

  it("reports a rematch request from a seated player", () =>
  {
    const onRematch = vi.fn();
    render(<WinPopup winner="red" canRematch={true} onRematch={onRematch} />);
    fireEvent.click(screen.getByRole("button", { name: "Rematch" }));
    expect(onRematch).toHaveBeenCalledOnce();
  });
});
