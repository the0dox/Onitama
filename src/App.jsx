import { useState, useEffect } from "react";

import Square from "./Square";
import { CardHand, CardView } from "./CardHand";
import { CARDS, CardsByName } from "../shared/game/cards.js";

// resolves the card names sent by the server into full card definitions
const BY_NAME = CardsByName(CARDS);

import { io } from "socket.io-client";

const SERVER = "http://localhost:3001";
const STORAGE_KEY = "player";

// don't connect until we have credentials from POST /players
const socket = io(SERVER, { autoConnect: false });

// shared promise so StrictMode's double effect doesn't register twice
let playerPromise = null;

// returns the saved identity from sessionStorage, or registers a new player via POST /players
function GetPlayer()
{
  if (!playerPromise)
  {
    playerPromise = (async () =>
    {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved)
      {
        return saved;
      }

      const res = await fetch(`${SERVER}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "player" }),
      });
      if (!res.ok)
      {
        throw new Error(`register failed: ${res.status}`);
      }
      const me = await res.json();
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(me));
      return me;
    })();
    // failed registration -> clear the cached promise so the next call retries
    playerPromise.catch(() =>
    {
      playerPromise = null;
    });
  }
  return playerPromise;
}

// discards the cached identity so the next GetPlayer() registers again
function ForgetPlayer()
{
  sessionStorage.removeItem(STORAGE_KEY);
  playerPromise = null;
}

// top-level component: owns the connection and the game state received from the server
export default function App()
{
  const [player, setPlayer] = useState(null);
  const [currentMove, setCurrentMove] = useState(0);
  const [currentSquares, setSquares] = useState(null);
  const [cardState, setCardState] = useState(null);
  const status = cardState ? `${cardState.currentPlayer}'s turn` : "";

  const connectionName = player ? `${player.name}:${player.id}` : "connecting...";

  // register (or reuse saved identity), then open the socket
  useEffect(() =>
  {
    let cancelled = false;

    // fetches credentials and connects the socket with them
    async function Connect()
    {
      const me = await GetPlayer();
      if (cancelled)
      {
        return;
      }
      setPlayer(me);
      socket.auth = { id: me.id, token: me.token };
      socket.connect();
    }

    // saved identity rejected (e.g. server restarted) -> register again
    function OnConnectError(err)
    {
      console.log("connect_error:", err.message);
      if (err.message === "unauthorized")
      {
        ForgetPlayer();
        Connect().catch(console.error);
      }
    }

    // merges the identity confirmed by the server into local state
    function OnWelcome(me)
    {
      setPlayer((prev) => ({ ...prev, ...me }));
    }

    socket.on("connect_error", OnConnectError);
    socket.on("welcome", OnWelcome);
    Connect().catch(console.error);

    // unsubscribe and close the socket on unmount
    return () =>
    {
      cancelled = true;
      socket.off("connect_error", OnConnectError);
      socket.off("welcome", OnWelcome);
      socket.disconnect();
    };
  }, []);

  // recieve current move from server
  useEffect(() =>
  {
    // replaces local turn, board and card state with the server's
    function OnGameState(turn, squares, cards)
    {
      setCurrentMove(turn);
      setSquares(squares);
      setCardState(cards);
      console.log("recieved gamestate turn", socket.id);
    }
    socket.on("gameState", OnGameState);
    return () => socket.off("gameState", OnGameState);
  }, []);

  return (
    <>
      {connectionName}
      <div className="game-column">
        {RenderHand("red")}
        <div className="game">
          I am turn on turn: {currentMove}
          <div className="game-board">
            {currentSquares && <Board squares={currentSquares} status={status} />}
          </div>
          {RenderNeutral()}
        </div>
        {RenderHand("blue")}
      </div>
    </>
  );

  // renders a player's hand once the server has sent the card state
  function RenderHand(side)
  {
    if (!cardState)
    {
      return null;
    }
    return (
      <CardHand
        player={side}
        cardNames={cardState.hands[side]}
        byName={BY_NAME}
        active={cardState.currentPlayer === side}
      />
    );
  }

  // renders the neutral card from the perspective of the player about to move
  function RenderNeutral()
  {
    if (!cardState)
    {
      return null;
    }
    return (
      <div className="neutral-zone">
        <div className="card-hand-title">Neutral</div>
        <CardView card={BY_NAME.get(cardState.neutral)} player={cardState.currentPlayer} />
      </div>
    );
  }
}

// the board as sent by the server: squares[x][y] holds a piece letter or null; display only for now
function Board({ squares, status })
{
  const size = squares.length;
  const rows = Array.from({ length: size }, (_, y) => y);
  const columns = Array.from({ length: size }, (_, x) => x);
  return (
    <>
      <div className="status">{status}</div>
      {rows.map((y) => (
        <div className="board-row" key={y}>
          {columns.map((x) => (
            <Square key={x} piece={squares[x][y]} />
          ))}
        </div>
      ))}
    </>
  );
}
