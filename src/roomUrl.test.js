import { describe, it, expect } from "vitest";
import { ReadRoomFromUrl, RoomUrl } from "./roomUrl.js";

describe("ReadRoomFromUrl", () =>
{
  it("reads the room code, upper-cased", () =>
  {
    expect(ReadRoomFromUrl("?room=k7qx")).toBe("K7QX");
  });

  it("returns null with no or an empty room parameter", () =>
  {
    expect(ReadRoomFromUrl("")).toBeNull();
    expect(ReadRoomFromUrl("?other=1")).toBeNull();
    expect(ReadRoomFromUrl("?room=")).toBeNull();
  });
});

describe("RoomUrl", () =>
{
  it("sets the room and keeps other parameters", () =>
  {
    expect(RoomUrl("http://localhost:5173/?debug=1", "K7QX")).toBe("http://localhost:5173/?debug=1&room=K7QX");
  });

  it("replaces an existing room", () =>
  {
    expect(RoomUrl("http://localhost:5173/?room=AAAA", "BBBB")).toBe("http://localhost:5173/?room=BBBB");
  });

  it("removes the room when given null", () =>
  {
    expect(RoomUrl("http://localhost:5173/?room=AAAA", null)).toBe("http://localhost:5173/");
  });
});
