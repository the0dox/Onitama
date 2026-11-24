import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { randomUUID, randomBytes } from "node:crypto";
import { CARDS, CardsByName } from "../../shared/game/cards.js";
import { CreateCardState, CardStateFromDeck } from "../../shared/game/deck.js";
import { CheckMove, CheckPass } from "../../shared/game/moves.js";
import { ApplyMove, ApplyPass } from "../../shared/game/turn.js";
import { ResolveDeckSeed } from "./seed.js";
import { LoadServerSettings, ResolveOverrideDeck } from "./settings.js";
import { SeatOf, ClaimSeat, ReleaseSeat, LeaveSeat, ShouldReleaseSeat, SeatsView } from "./seats.js";
import { CreateReleaseTimers } from "./releaseTimers.js";
import {
  CreateRoomCode, CheckRoomName, CreateRoom, RestartRoom, LobbyView, SeatTimerKey, ParseSeatTimerKey,
} from "./rooms.js";

// resolves card names sent by clients into card definitions
const CARDS_BY_NAME = CardsByName(CARDS);
// how long a disconnected player keeps their seat; longer than the socket.io client's
// reconnect backoff (1 s, 2 s, 4 s, 5 s... with ±50% jitter) so a brief network drop doesn't lose it
const SEAT_GRACE_MS = 15000;
// how long a room with no sockets in it survives before it is deleted
const ROOM_GRACE_MS = 60000;
// socket.io room holding every socket that is not in a game room; it receives "rooms" updates
const LOBBY = "lobby";
// test-only preset deck from serverSettings.json; when set, every game deals it instead of shuffling
const OVERRIDE_DECK = ResolveOverrideDeck(LoadServerSettings(), CARDS_BY_NAME);
if (OVERRIDE_DECK !== null)
{
  console.log(`using overrideDeck: ${OVERRIDE_DECK.map((card) => card.name).join(", ")}`);
}

// allow any localhost port (a second Vite dev server lands on 5174, 5175, ...)
const CLIENT = /^http:\/\/localhost:\d+$/;
const app = express();
app.use(cors({ origin: CLIENT }));

// liveness check
app.get("/health", (req, res) =>
{
  res.json({ ok: true });
});

const players = new Map(); // playerId -> { id, name, token }

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: CLIENT } });

// roomId -> room (see rooms.js); seat tokens inside rooms never leave the server
const rooms = new Map();
// games started across all rooms; only the very first one honours DECK_SEED
let gamesStartedTotal = 0;

// pending seat releases after a disconnect, keyed by SeatTimerKey(roomId, token);
// expiring frees the seat if the room still exists
const seatTimers = CreateReleaseTimers(SEAT_GRACE_MS, (key) =>
{
  const { roomId, token } = ParseSeatTimerKey(key);
  const room = rooms.get(roomId);
  if (!room)
  {
    return;
  }
  console.log(`[${roomId}] seat ${SeatOf(room.seats, token)} released: token did not reconnect within ${SEAT_GRACE_MS} ms`);
  const next = SetRoom({ ...room, seats: ReleaseSeat(room.seats, token) });
  EmitSeats(next);
  EmitLobby();
});

// pending deletions of empty rooms, keyed by roomId
const roomTimers = CreateReleaseTimers(ROOM_GRACE_MS, (roomId) =>
{
  if (MemberCount(roomId) > 0)
  {
    return;
  }
  console.log(`[${roomId}] deleted: empty for ${ROOM_GRACE_MS} ms`);
  rooms.delete(roomId);
  EmitLobby();
});

// starting cards for the next game in any room: the override deck if set, otherwise a shuffle
// (the server's first game honours DECK_SEED, later ones reshuffle randomly)
function NextCardState()
{
  gamesStartedTotal++;
  if (OVERRIDE_DECK !== null)
  {
    console.log(`game ${gamesStartedTotal} deck (override)`);
    return CardStateFromDeck(OVERRIDE_DECK, CARDS_BY_NAME);
  }
  const env = gamesStartedTotal === 1 ? process.env : {};
  const { seed, source } = ResolveDeckSeed(env, () => randomBytes(8).toString("hex"));
  console.log(`game ${gamesStartedTotal} deck seed (${source}): ${seed}`);
  return CreateCardState(CARDS, seed);
}

// stores a room (frozen) under its id and returns it
function SetRoom(room)
{
  const frozen = Object.freeze(room);
  rooms.set(frozen.id, frozen);
  return frozen;
}

// sockets currently joined to the socket.io room roomId
function MemberSockets(roomId)
{
  const ids = io.sockets.adapter.rooms.get(roomId) ?? new Set();
  return [...ids].map((id) => io.sockets.sockets.get(id)).filter(Boolean);
}

// number of sockets in roomId
function MemberCount(roomId)
{
  return io.sockets.adapter.rooms.get(roomId)?.size ?? 0;
}

// tokens of every socket still in roomId; inside a "disconnect" handler the leaving socket
// has already left all rooms (socket.io 4 leaves them before emitting the event)
function RoomTokens(roomId)
{
  return MemberSockets(roomId).map((s) => s.data.player.token);
}

// sends a room's turn, board, cards and winner to every socket in it
function BroadcastState(room)
{
  io.to(room.id).emit("gameState", room.cardState, room.currentMove, room.board, room.winner);
}

// sends every socket in the room its own view of the seats (which are taken, and its own colour)
function EmitSeats(room)
{
  MemberSockets(room.id).forEach((s) => s.emit("seats", SeatsView(room.seats, s.data.player.token)));
}

// sends the room list to every socket in the lobby
function EmitLobby()
{
  io.to(LOBBY).emit("rooms", LobbyView(rooms, MemberCount));
}

// logs and returns true if the room's game already has a winner, so the caller drops the request
function RejectIfOver(room, event, color)
{
  if (room.winner === null)
  {
    return false;
  }
  console.log(`[${room.id}] ${event} from ${color}: rejected (game-over) ${room.winner} has already won`);
  return true;
}

// stores a room after an accepted turn (move or pass), logs it and sends the new state to its sockets
function FinishTurn(room, summary)
{
  const next = SetRoom({ ...room, currentMove: room.currentMove + 1 });
  console.log(`[${next.id}] move ${next.currentMove} done: ${summary}`);
  BroadcastState(next);
  if (next.winner !== null)
  {
    EmitLobby();
  }
}

app.use(express.json());

// registers a new player and returns its id, name and secret token
app.post("/players", (req, res) =>
{
  const player = {
    id: randomUUID(),
    name: String(req.body?.name ?? "Guest").slice(0, 20),
    token: randomBytes(32).toString("hex"), // unguessable secret
  };
  players.set(player.id, player);
  res.status(201).json({ id: player.id, token: player.token, name: player.name });
});

// reject sockets whose handshake doesn't match a registered player
io.use((socket, next) =>
{
  const { id, token } = socket.handshake.auth ?? {};
  const player = players.get(id);
  if (!player || player.token !== token)
  {
    return next(new Error("unauthorized"));
  }
  socket.data.player = player;
  next();
});

// per-connection setup: greet and send the lobby, wire room joining, seat picking and move handling
io.on("connection", (socket) =>
{
  const { id, name, token } = socket.data.player;
  socket.data.roomId = null;

  console.log("connected:", socket.id, name, id);
  socket.join(LOBBY);
  socket.emit("rooms", LobbyView(rooms, MemberCount));

  // creates a named room and moves this socket into it
  socket.on("createRoom", (roomName) =>
  {
    const check = CheckRoomName(roomName);
    if (!check.ok)
    {
      console.log(`createRoom from ${socket.id}: rejected (${check.reason})`);
      socket.emit("roomError", check.reason);
      return;
    }
    const room = SetRoom(CreateRoom(CreateRoomCode(Math.random, rooms), check.name, NextCardState()));
    console.log(`[${room.id}] created "${room.name}" by ${name} ${id}`);
    AttachToRoom(room);
  });

  // moves this socket into an existing room (leaving its current one, seat kept for the grace period)
  socket.on("joinRoom", (roomId) =>
  {
    const room = rooms.get(roomId);
    if (!room)
    {
      console.log(`joinRoom ${String(roomId)} from ${socket.id}: rejected (no-room)`);
      socket.emit("roomError", "no-room");
      return;
    }
    AttachToRoom(room);
  });

  // returns this socket to the lobby; an explicit leave frees its seat at once
  socket.on("leaveRoom", () =>
  {
    if (socket.data.roomId === null)
    {
      console.log(`leaveRoom from ${socket.id}: rejected (not-in-room)`);
      return;
    }
    DetachFromRoom(true);
    socket.join(LOBBY);
    EmitLobby();
  });

  // seats this player as the requested colour if it is free and they hold no seat yet
  socket.on("pickSeat", InRoom("pickSeat", (room, color) =>
  {
    const claim = ClaimSeat(room.seats, color, token);
    if (!claim.ok)
    {
      console.log(`[${room.id}] pickSeat ${String(color)} from ${socket.id}: rejected (${claim.reason})`);
      return;
    }
    console.log(`[${room.id}] pickSeat: ${name} ${id} is now ${color}`);
    EmitSeats(SetRoom({ ...room, seats: claim.seats }));
    EmitLobby();
  }));

  // gives up this player's seat so they become a spectator (and may pick the other side);
  // the game itself carries on unchanged
  socket.on("leaveSeat", InRoom("leaveSeat", (room) =>
  {
    const color = SeatOf(room.seats, token);
    const leave = LeaveSeat(room.seats, token);
    if (!leave.ok)
    {
      console.log(`[${room.id}] leaveSeat from ${socket.id}: rejected (${leave.reason})`);
      return;
    }
    console.log(`[${room.id}] leaveSeat: ${name} ${id} left ${color}`);
    EmitSeats(SetRoom({ ...room, seats: leave.seats }));
    EmitLobby();
  }));

  // validates the requested move, applies it (turn structure 5 to 8, including win checks)
  // and broadcasts the new state; no moves are accepted once the game has a winner
  socket.on("pickMove", InRoom("pickMove", (room, start, cardName, moveIndex) =>
  {
    const color = SeatOf(room.seats, token);
    if (RejectIfOver(room, "pickMove", color))
    {
      return;
    }
    // every value from the client is checked before anything indexes the board with it
    const check = CheckMove(room.board, room.cardState, color, start, cardName, moveIndex, CARDS_BY_NAME);
    if (!check.ok)
    {
      console.log(`[${room.id}] pickMove from ${color}: rejected (${check.reason}) ${RejectDetail(room, check.reason)}`);
      return;
    }
    const target = check.target;

    console.log(`[${room.id}] pickMove from ${color}: piece (${start.x},${start.y}) card ${cardName}[${moveIndex}] -> (${target.x},${target.y})`);

    const { board, cardState, winner } = ApplyMove(room.board, room.cardState, start, target, cardName);
    FinishTurn(
      { ...room, board, cardState, winner },
      winner !== null ? `${winner} wins` : `${cardState.currentPlayer} to play, neutral card ${cardState.neutral}`,
    );
  }));

  // turn structure 1: a player with no legal move picks a card to swap with the neutral card, and the turn passes
  socket.on("passTurn", InRoom("passTurn", (room, cardName) =>
  {
    const color = SeatOf(room.seats, token);
    if (RejectIfOver(room, "passTurn", color))
    {
      return;
    }
    const check = CheckPass(room.board, room.cardState, color, cardName, CARDS_BY_NAME);
    if (!check.ok)
    {
      console.log(`[${room.id}] passTurn from ${color}: rejected (${check.reason})`);
      return;
    }
    const cardState = ApplyPass(room.cardState, cardName);
    FinishTurn(
      { ...room, cardState },
      `${color} had no legal move and passed with ${cardName}; ${cardState.currentPlayer} to play`,
    );
  }));

  // starts a new game (rematch) in this room; only seated players may restart, and only once the game is over
  socket.on("restartGame", InRoom("restartGame", (room) =>
  {
    const color = SeatOf(room.seats, token);
    if (color === null)
    {
      console.log(`[${room.id}] rejected restart from spectator ${socket.id}`);
      return;
    }
    if (room.winner === null)
    {
      console.log(`[${room.id}] restartGame from ${color}: rejected (game-not-over)`);
      return;
    }
    BroadcastState(SetRoom(RestartRoom(room, NextCardState())));
    EmitLobby();
  }));

  // a seated player's last socket leaving starts the seat grace timer; an empty room starts its deletion timer
  socket.on("disconnect", () =>
  {
    console.log(`disconnected: ${socket.id}`);
    const roomId = socket.data.roomId;
    if (roomId !== null)
    {
      AfterLeaving(roomId, false);
      EmitLobby();
    }
  });

  // wraps a handler that needs this socket's room: looks the room up and passes it first,
  // or logs and drops the request with not-in-room
  function InRoom(event, handler)
  {
    return (...args) =>
    {
      const room = rooms.get(socket.data.roomId);
      if (!room)
      {
        console.log(`${event} from ${socket.id}: rejected (not-in-room)`);
        return;
      }
      handler(room, ...args);
    };
  }

  // moves this socket from the lobby (or its current room) into room and sends it the room's state
  function AttachToRoom(room)
  {
    if (socket.data.roomId !== room.id)
    {
      DetachFromRoom(false);
      socket.leave(LOBBY);
      socket.join(room.id);
      socket.data.roomId = room.id;
      roomTimers.Cancel(room.id);
      // reconnected within the grace period -> keep the seat
      if (seatTimers.Cancel(SeatTimerKey(room.id, token)))
      {
        console.log(`[${room.id}] ${name} ${id} reconnected in time, keeping seat ${SeatOf(room.seats, token)}`);
      }
      console.log(`[${room.id}] ${name} ${id} joined`);
    }
    socket.emit("roomJoined", { id: room.id, name: room.name });
    socket.emit("gameState", room.cardState, room.currentMove, room.board, room.winner);
    socket.emit("seats", SeatsView(room.seats, token));
    EmitLobby();
  }

  // takes this socket out of its room, if any; releaseNow frees its seat at once instead of after the grace period
  function DetachFromRoom(releaseNow)
  {
    const roomId = socket.data.roomId;
    if (roomId === null)
    {
      return;
    }
    socket.leave(roomId);
    socket.data.roomId = null;
    console.log(`[${roomId}] ${name} ${id} left`);
    AfterLeaving(roomId, releaseNow);
  }

  // seat and room bookkeeping once this socket is no longer in roomId
  function AfterLeaving(roomId, releaseNow)
  {
    const room = rooms.get(roomId);
    if (!room)
    {
      return;
    }
    const seatKey = SeatTimerKey(roomId, token);
    const leave = LeaveSeat(room.seats, token);
    if (releaseNow && leave.ok)
    {
      seatTimers.Cancel(seatKey);
      console.log(`[${roomId}] ${name} ${id} gave up seat ${SeatOf(room.seats, token)}`);
      EmitSeats(SetRoom({ ...room, seats: leave.seats }));
    }
    else if (ShouldReleaseSeat(room.seats, token, RoomTokens(roomId)))
    {
      console.log(`[${roomId}] ${name} ${id} left seat ${SeatOf(room.seats, token)}; releasing in ${SEAT_GRACE_MS} ms unless they return`);
      seatTimers.Schedule(seatKey);
    }
    if (MemberCount(roomId) === 0)
    {
      console.log(`[${roomId}] empty; deleting in ${ROOM_GRACE_MS} ms unless someone joins`);
      roomTimers.Schedule(roomId);
    }
  }

  // human-readable detail for a CheckMove rejection reason, for the server log
  function RejectDetail(room, reason)
  {
    const color = SeatOf(room.seats, token);
    const details = {
      "not-your-turn": `requesting player is ${color} and only ${room.cardState.currentPlayer} can move now`,
      "no-piece": "start is off the board or not one of the sender's pieces",
      "not-in-hand": `card is not in ${color}'s hand (${room.cardState.hands[color]?.join(", ")})`,
      "bad-move": "held card has no definition, or the move index is not on the card",
      "bad-target": "target is off the board or holds the sender's own piece",
    };
    return details[reason] ?? "";
  }
});


// start listening
httpServer.listen(3001, () =>
{
  console.log("Server on :3001");
});
