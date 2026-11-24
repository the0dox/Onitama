import { describe, it, expect } from "vitest";
import { CreateRng } from "../../shared/game/random.js";
import { CreateBoard } from "../../shared/game/board.js";
import { EMPTY_SEATS } from "./seats.js";
import {
  ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, CreateRoomCode, CheckRoomName, CreateRoom, RestartRoom,
  RoomSummary, LobbyView, SeatTimerKey, ParseSeatTimerKey,
} from "./rooms.js";

const CARDS_A = { hands: { red: ["tiger", "crab"], blue: ["frog", "ox"] }, neutral: "eel", currentPlayer: "red" };
const CARDS_B = { hands: { red: ["dragon", "boar"], blue: ["rabbit", "horse"] }, neutral: "cobra", currentPlayer: "blue" };

// an rng that returns the given values in order (then repeats the last)
function FixedRng(values)
{
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("CreateRoomCode", () =>
{
  it("returns a code of the right length from the alphabet", () =>
  {
    const code = CreateRoomCode(CreateRng(1), new Set());
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    expect([...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch))).toBe(true);
  });

  it("is reproducible for the same rng seed", () =>
  {
    expect(CreateRoomCode(CreateRng(7), new Set())).toBe(CreateRoomCode(CreateRng(7), new Set()));
  });

  it("retries when the code is already taken", () =>
  {
    // first four draws give "AAAA", the next four give "BBBB"
    const b = 1 / ROOM_CODE_ALPHABET.length;
    const rng = FixedRng([0, 0, 0, 0, b, b, b, b]);
    expect(CreateRoomCode(rng, new Set(["AAAA"]))).toBe("BBBB");
  });
});

describe("CheckRoomName", () =>
{
  it("trims and accepts a normal name", () =>
  {
    expect(CheckRoomName("  my room ")).toEqual({ ok: true, name: "my room" });
  });

  it.each([[""], ["   "], ["x".repeat(25)], [null], [42]])("rejects %j", (name) =>
  {
    expect(CheckRoomName(name)).toEqual({ ok: false, reason: "bad-name" });
  });

  it("accepts a name at the length limit", () =>
  {
    expect(CheckRoomName("x".repeat(24)).ok).toBe(true);
  });
});

describe("CreateRoom / RestartRoom", () =>
{
  it("starts with empty seats, a fresh board and no winner", () =>
  {
    const room = CreateRoom("ABCD", "test", CARDS_A);
    expect(room).toEqual({
      id: "ABCD", name: "test", seats: EMPTY_SEATS, board: CreateBoard(),
      cardState: CARDS_A, currentMove: 0, winner: null,
    });
  });

  it("restart keeps id, name and seats but resets the game", () =>
  {
    const played = { ...CreateRoom("ABCD", "test", CARDS_A), seats: ["a", "b"], currentMove: 9, winner: "red", board: [] };
    const next = RestartRoom(played, CARDS_B);
    expect(next).toEqual({
      id: "ABCD", name: "test", seats: ["a", "b"], board: CreateBoard(),
      cardState: CARDS_B, currentMove: 0, winner: null,
    });
    expect(played.winner).toBe("red");
  });
});

describe("RoomSummary / LobbyView", () =>
{
  it("reduces seats to taken flags so tokens never appear", () =>
  {
    const room = { ...CreateRoom("ABCD", "test", CARDS_A), seats: ["secret-token", null] };
    const summary = RoomSummary(room, 3);
    expect(summary).toEqual({ id: "ABCD", name: "test", red: true, blue: false, members: 3, status: "playing" });
    expect(JSON.stringify(summary)).not.toContain("secret-token");
  });

  it("reports a finished game as over", () =>
  {
    expect(RoomSummary({ ...CreateRoom("ABCD", "t", CARDS_A), winner: "blue" }, 0).status).toBe("over");
  });

  it("lists rooms sorted by name with their member counts", () =>
  {
    const rooms = new Map([
      ["ZZZZ", CreateRoom("ZZZZ", "beta", CARDS_A)],
      ["AAAA", CreateRoom("AAAA", "alpha", CARDS_A)],
    ]);
    const counts = { ZZZZ: 2, AAAA: 0 };
    const view = LobbyView(rooms, (id) => counts[id]);
    expect(view.map((r) => [r.name, r.members])).toEqual([["alpha", 0], ["beta", 2]]);
  });
});

describe("SeatTimerKey", () =>
{
  it("round-trips a room id and token", () =>
  {
    expect(ParseSeatTimerKey(SeatTimerKey("K7QX", "abc123"))).toEqual({ roomId: "K7QX", token: "abc123" });
  });
});
