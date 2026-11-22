import { describe, it, expect } from "vitest";
import { EMPTY_SEATS, SeatOf, ClaimSeat, ReleaseSeat, LeaveSeat, ShouldReleaseSeat, SeatsView } from "./seats.js";

describe("LeaveSeat", () =>
{
  it("frees the leaving player's seat", () =>
  {
    expect(LeaveSeat(["a", "b"], "a")).toEqual({ ok: true, seats: [null, "b"] });
  });

  it("rejects a spectator", () =>
  {
    expect(LeaveSeat(["a", null], "c")).toEqual({ ok: false, reason: "not-seated" });
  });

  it("lets the player claim the other side afterwards", () =>
  {
    const left = LeaveSeat(["a", null], "a");
    expect(ClaimSeat(left.seats, "blue", "a")).toEqual({ ok: true, seats: [null, "a"] });
  });
});

describe("ShouldReleaseSeat", () =>
{
  it("releases a seated token with no sockets left", () =>
  {
    expect(ShouldReleaseSeat(["a", null], "a", ["c"])).toBe(true);
  });

  it("keeps the seat while another socket (e.g. a duplicated tab) is still connected", () =>
  {
    expect(ShouldReleaseSeat(["a", null], "a", ["a", "c"])).toBe(false);
  });

  it("ignores spectators", () =>
  {
    expect(ShouldReleaseSeat(["a", null], "c", [])).toBe(false);
  });
});

describe("SeatOf", () =>
{
  it("returns the colour of the seat the token holds", () =>
  {
    expect(SeatOf(["a", "b"], "a")).toBe("red");
    expect(SeatOf(["a", "b"], "b")).toBe("blue");
  });

  it("returns null for a spectator", () =>
  {
    expect(SeatOf(["a", null], "c")).toBeNull();
  });
});

describe("ClaimSeat", () =>
{
  it("seats the token on an empty seat", () =>
  {
    expect(ClaimSeat(EMPTY_SEATS, "blue", "a")).toEqual({ ok: true, seats: [null, "a"] });
  });

  it("rejects a taken seat", () =>
  {
    expect(ClaimSeat(["a", null], "red", "b")).toEqual({ ok: false, reason: "taken" });
  });

  it("rejects a token that is already seated, even for the free seat", () =>
  {
    expect(ClaimSeat(["a", null], "blue", "a")).toEqual({ ok: false, reason: "already-seated" });
  });

  it.each([["green"], [undefined], [{}], [0]])("rejects bad colour %j", (color) =>
  {
    expect(ClaimSeat(EMPTY_SEATS, color, "a")).toEqual({ ok: false, reason: "bad-color" });
  });

  it("does not mutate its input", () =>
  {
    const seats = [null, null];
    ClaimSeat(seats, "red", "a");
    expect(seats).toEqual([null, null]);
  });
});

describe("ReleaseSeat", () =>
{
  it("frees the token's seat", () =>
  {
    expect(ReleaseSeat(["a", "b"], "b")).toEqual(["a", null]);
  });

  it("leaves seats unchanged for an unseated token", () =>
  {
    expect(ReleaseSeat(["a", "b"], "c")).toEqual(["a", "b"]);
  });

  it("does not mutate its input", () =>
  {
    const seats = ["a", "b"];
    ReleaseSeat(seats, "a");
    expect(seats).toEqual(["a", "b"]);
  });
});

describe("SeatsView", () =>
{
  it("reports taken seats and the viewer's own colour", () =>
  {
    expect(SeatsView(["a", null], "a")).toEqual({ red: true, blue: false, mine: "red" });
    expect(SeatsView(["a", null], "c")).toEqual({ red: true, blue: false, mine: null });
  });

  it("never exposes tokens", () =>
  {
    const view = JSON.stringify(SeatsView(["secret-a", "secret-b"], "x"));
    expect(view).not.toContain("secret");
  });
});
