import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { randomUUID, randomBytes } from "node:crypto";
import { CARDS, CardsByName } from "../../shared/game/cards.js";
import { CreateCardState } from "../../shared/game/deck.js";
import { CreateBoard } from "../../shared/game/board.js";
import { CheckMove } from "../../shared/game/moves.js";
import { ApplyMove } from "../../shared/game/turn.js";
import { ResolveDeckSeed } from "./seed.js";
import { EMPTY_SEATS, SeatOf, ClaimSeat, ReleaseSeat, LeaveSeat, ShouldReleaseSeat, SeatsView } from "./seats.js";
import { CreateReleaseTimers } from "./releaseTimers.js";

// resolves card names sent by clients into card definitions
const CARDS_BY_NAME = CardsByName(CARDS);
// how long a disconnected player keeps their seat; longer than the socket.io client's
// reconnect backoff (1 s, 2 s, 4 s, 5 s... with ±50% jitter) so a brief network drop doesn't lose it
const SEAT_GRACE_MS = 15000;

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

// seats survive rematches; everything below them is per-game state set by RestartGame()
let seats = EMPTY_SEATS; // [redToken | null, blueToken | null]; tokens never leave the server
// pending seat releases after a disconnect; expiring frees the seat and tells everyone
const releaseTimers = CreateReleaseTimers(SEAT_GRACE_MS, (token) =>
{
  console.log(`seat ${SeatOf(seats, token)} released: token did not reconnect within ${SEAT_GRACE_MS} ms`);
  seats = ReleaseSeat(seats, token);
  EmitSeats();
});
let currentMove;
let board;
let cardState;
let gamesStarted = 0;

// resets turn, board and cards for a new game; the first game honours DECK_SEED, later ones reshuffle randomly
function RestartGame()
{
  const env = gamesStarted === 0 ? process.env : {};
  const { seed, source } = ResolveDeckSeed(env, () => randomBytes(8).toString("hex"));
  console.log(`game ${gamesStarted + 1} deck seed (${source}): ${seed}`);

  currentMove = 0;
  board = CreateBoard();
  cardState = CreateCardState(CARDS, seed);
  gamesStarted++;
}

// sends the current turn, board and cards to every connected client
function BroadcastState()
{
  io.emit("gameState", cardState, currentMove, board);
}

// sends every connected client its own view of the seats (which are taken, and its own colour)
function EmitSeats()
{
  io.sockets.sockets.forEach((s) => s.emit("seats", SeatsView(seats, s.data.player.token)));
}

// tokens of every socket still connected; inside a "disconnect" handler the leaving socket
// is already removed (socket.io 4 removes it from the namespace before emitting the event)
function ConnectedTokens()
{
  return [...io.sockets.sockets.values()].map((s) => s.data.player.token);
}

RestartGame();

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

// per-connection setup: greet, send current state and seats, wire seat picking and move handling
io.on("connection", (socket) =>
{
  const { id, name, token } = socket.data.player;

  console.log("connected:", socket.id, name, id);
  // reconnected within the grace period -> keep the seat
  if (releaseTimers.Cancel(token))
  {
    console.log(`${name} ${id} reconnected in time, keeping seat ${SeatOf(seats, token)}`);
  }

  socket.emit("welcome", { id, name });
  socket.emit("gameState", cardState, currentMove, board);
  socket.emit("seats", SeatsView(seats, token));

  // seats this player as the requested colour if it is free and they hold no seat yet
  socket.on("pickSeat", (color) =>
  {
    const claim = ClaimSeat(seats, color, token);
    if (!claim.ok)
    {
      console.log(`pickSeat ${String(color)} from ${socket.id}: rejected (${claim.reason})`);
      return;
    }
    seats = claim.seats;
    console.log(`pickSeat: ${name} ${id} is now ${color}`);
    EmitSeats();
  });

  // gives up this player's seat so they become a spectator (and may pick the other side);
  // the game itself carries on unchanged
  socket.on("leaveSeat", () =>
  {
    const color = SeatColor();
    const leave = LeaveSeat(seats, token);
    if (!leave.ok)
    {
      console.log(`leaveSeat from ${socket.id}: rejected (${leave.reason})`);
      return;
    }
    seats = leave.seats;
    console.log(`leaveSeat: ${name} ${id} left ${color}`);
    EmitSeats();
  });

  // validates the requested move, applies it (turn structure 5, 6 and 8) and broadcasts the new state;
  // win checks (turn structure 7) are not done yet
  socket.on("pickMove", (start, cardName, moveIndex) =>
  {
    const color = SeatColor();
    // every value from the client is checked before anything indexes the board with it
    const check = CheckMove(board, cardState, color, start, cardName, moveIndex, CARDS_BY_NAME);
    if (!check.ok)
    {
      console.log(`pickMove from ${color}: rejected (${check.reason}) ${RejectDetail(check.reason)}`);
      return;
    }
    const target = check.target;

    console.log(`pickMove from ${color}: piece (${start.x},${start.y}) card ${cardName}[${moveIndex}] -> (${target.x},${target.y})`);

    ({ board, cardState } = ApplyMove(board, cardState, start, target, cardName));
    currentMove++;
    console.log(`move ${currentMove} done: ${cardState.currentPlayer} to play, neutral card ${cardState.neutral}`);
    BroadcastState();
  });

  // starts a new game; only seated players may restart, spectators are ignored
  socket.on("restartGame", () =>
  {
    if (SeatColor() === null)
    {
      console.log(`rejected restart from spectator ${socket.id}`);
      return;
    }
    RestartGame();
    BroadcastState();
  });

  // a seated player's last socket leaving starts the grace timer; if it runs out the seat is freed
  socket.on("disconnect", () =>
  {
    console.log(`disconnected: ${socket.id}`);
    if (ShouldReleaseSeat(seats, token, ConnectedTokens()))
    {
      console.log(`${name} ${id} left seat ${SeatColor()}; releasing in ${SEAT_GRACE_MS} ms unless they reconnect`);
      releaseTimers.Schedule(token);
    }
  });

  // this player's colour from their seat, or null for a spectator
  function SeatColor()
  {
    return SeatOf(seats, token);
  }

  // human-readable detail for a CheckMove rejection reason, for the server log
  function RejectDetail(reason)
  {
    const details = {
      "not-your-turn": `requesting player is ${SeatColor()} and only ${cardState.currentPlayer} can move now`,
      "no-piece": "start is off the board or not one of the sender's pieces",
      "not-in-hand": `card is not in ${SeatColor()}'s hand (${cardState.hands[SeatColor()]?.join(", ")})`,
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
