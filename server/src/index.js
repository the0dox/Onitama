import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { randomUUID, randomBytes } from "node:crypto";

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

const dimensions = 3;

const playerSlots = Array(2).fill(null);
let currentMove = 0;

let board = Array.from({ length: dimensions }, () => new Array(dimensions).fill(null));;

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

// per-connection setup: greet, send current state, claim a player slot, wire move handling
io.on("connection", (socket) =>
{
  const { id, name } = socket.data.player;

  console.log("connected:", socket.id, name, id);
  socket.emit("welcome", { id, name });
  socket.emit("gameState", currentMove, board);

  ClaimFirstSlot();

  // accepts the submitted board if it is this player's turn
  socket.on("pickSquare", (squares, point) =>
  {
    if (ValidateMove())
    {
      board = squares;
      currentMove++;
      TurnUpdated();
    }
    else
    {
      console.log("unable to validate request");
    }
  });

  // log disconnects
  socket.on("disconnect", () =>
  {
    console.log(`disconnected: ${socket.id}`);
  });

  // gives this player the first free slot, unless it already holds one
  function ClaimFirstSlot()
  {
    // reconnecting player already owns a slot -> keep it, don't take another
    if (playerSlots.includes(socket.data.player.token))
    {
      return;
    }
    for (let i = 0; i < playerSlots.length; i++)
    {
      if (TryClaimSlot(i))
      {
        return;
      }
    }
  }

  // claims slotIndex for this player if it is empty; returns whether it succeeded
  function TryClaimSlot(slotIndex)
  {
    if (playerSlots[slotIndex] !== null)
    {
      return false;
    }
    playerSlots[slotIndex] = socket.data.player.token;
    return true;
  }

  // true if this player owns the slot whose turn it is
  function ValidateMove()
  {
    const nextPlayer = currentMove % 2;
    if (playerSlots[nextPlayer] !== socket.data.player.token)
    {
      console.log(`rejected move, reason: requesting player is ${socket.data.player.token} and only ${playerSlots[nextPlayer]} can move now`);
      return false;
    }
    return true;
  }

  // broadcasts the new turn and board to every client
  function TurnUpdated()
  {
    io.emit("gameState", currentMove, board);
    console.log("updated turn", socket.id);
  }
});


// start listening
httpServer.listen(3001, () =>
{
  console.log("Server on :3001");
});
