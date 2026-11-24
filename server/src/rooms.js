// Room bookkeeping as pure functions. A room is one independent game: its own seats, board,
// cards and winner. Functions return new rooms, never mutate.

import { CreateBoard } from "../../shared/game/board.js";
import { ROOM_NAME_MAX } from "../../shared/rooms.js";
import { EMPTY_SEATS } from "./seats.js";

// characters a room code is drawn from; 0/O and 1/I are left out so codes are easy to read aloud
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// characters in a room code
export const ROOM_CODE_LENGTH = 4;

// one random code from rng (a () => [0, 1) generator)
function RandomCode(rng)
{
  return Array.from({ length: ROOM_CODE_LENGTH }, () =>
    ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)]).join("");
}

// a fresh room code not in existingIds (any object with has(), e.g. a Map or Set); retries on collision
export function CreateRoomCode(rng, existingIds)
{
  const code = RandomCode(rng);
  return existingIds.has(code) ? CreateRoomCode(rng, existingIds) : code;
}

// validates a room name typed by a player; returns { ok: true, name } (trimmed) or { ok: false, reason: "bad-name" }
export function CheckRoomName(name)
{
  const trimmed = typeof name === "string" ? name.trim() : "";
  return trimmed.length === 0 || trimmed.length > ROOM_NAME_MAX
    ? { ok: false, reason: "bad-name" }
    : { ok: true, name: trimmed };
}

// the same room with a new game (rematch): fresh board, cards and winner; seats are kept
export function RestartRoom(room, cardState)
{
  return {
    ...room,
    board: CreateBoard(),
    cardState,
    currentMove: 0,
    winner: null,
  };
}

// a new room with no one seated and the first game ready to play
export function CreateRoom(id, name, cardState)
{
  return RestartRoom({ id, name, seats: EMPTY_SEATS }, cardState);
}

// what the lobby shows for one room; seats are reduced to "taken" flags so tokens never leave the server
export function RoomSummary(room, memberCount)
{
  return {
    id: room.id,
    name: room.name,
    red: room.seats[0] !== null,
    blue: room.seats[1] !== null,
    members: memberCount,
    status: room.winner === null ? "playing" : "over",
  };
}

// key for one player's seat-release timer in one room; room codes never contain ":"
export function SeatTimerKey(roomId, token)
{
  return `${roomId}:${token}`;
}

// splits a SeatTimerKey back into { roomId, token }
export function ParseSeatTimerKey(key)
{
  const split = key.indexOf(":");
  return { roomId: key.slice(0, split), token: key.slice(split + 1) };
}

// every room's summary sorted by name (then id); MemberCount(roomId) gives the number of sockets in a room
export function LobbyView(rooms, MemberCount)
{
  return [...rooms.values()]
    .map((room) => RoomSummary(room, MemberCount(room.id)))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
