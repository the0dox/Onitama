import { useState, useEffect, useRef } from "react";

import Square from "./Square";
import { CardHand, CardView } from "./CardHand";
import { CARDS, CardsByName } from "../shared/game/cards.js";
import { PieceOwner } from "../shared/game/board.js";
import { ButtonContext } from "./BoardContext.jsx";
import { ValidTargets, HasLegalMove } from "../shared/game/moves.js";
import { EMPTY_SELECTION, ToggleCard, TogglePiece } from "./selection.js";
import SeatPicker from "./SeatPicker.jsx";
import WinPopup from "./WinPopup.jsx";
import Lobby from "./Lobby.jsx";
import { ReadRoomFromUrl, RoomUrl } from "./roomUrl.js";

// resolves the card names sent by the server into full card definitions
const BY_NAME = CardsByName(CARDS);

import { io } from "socket.io-client";

const SERVER = "http://localhost:3001";
const STORAGE_KEY = "player";

// don't connect until we have credentials from POST /players
const socket = io(SERVER, { autoConnect: false });

// asks the server to join the room named in the URL; returns false when the URL names none
function JoinRoomFromUrl()
{
  const code = ReadRoomFromUrl(window.location.search);
  if (code !== null)
  {
    socket.emit("joinRoom", code);
  }
  return code !== null;
}

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
  const [currentSquares, setSquares] = useState(null);
  const [cardState, setCardState] = useState(null);
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  // { red: taken, blue: taken, mine: colour | null } as sent by the server
  const [seats, setSeats] = useState(null);
  // "red" | "blue" once the server reports a win, otherwise null
  const [winner, setWinner] = useState(null);
  // the joined room { id, name }, or null while in the lobby
  const [room, setRoom] = useState(null);
  // lobby list [{ id, name, red, blue, members, status }] as sent by the server
  const [rooms, setRooms] = useState([]);
  // id of the joined room, readable from socket handlers registered once
  const roomIdRef = useRef(null);
  // only the seated player whose turn it is may select anything, and nobody once the game is won
  const myColor = seats?.mine ?? null;
  const canAct = winner === null && myColor !== null && cardState?.currentPlayer === myColor;
  // turn structure 1: with no legal move the player only picks a card to swap, then confirms the pass
  const mustPass = canAct && currentSquares !== null && !HasLegalMove(currentSquares, cardState, myColor, BY_NAME);
  const status = StatusText(cardState, winner, mustPass);
  // green squares appear only once both a piece and a card are chosen
  const targets = canAct && selection.piece && selection.card
    ? ValidTargets(currentSquares, selection.piece, BY_NAME.get(selection.card), myColor)
    : [];


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

    socket.on("connect_error", OnConnectError);
    // a (re)connected socket starts in the lobby on the server, so rejoin the room named in the URL
    socket.on("connect", JoinRoomFromUrl);
    Connect().catch(console.error);

    // unsubscribe and close the socket on unmount
    return () =>
    {
      cancelled = true;
      socket.off("connect_error", OnConnectError);
      socket.off("connect", JoinRoomFromUrl);
      socket.disconnect();
    };
  }, []);

  // recieve current move from server
  useEffect(() =>
  {
    // replaces local card state, turn, board and winner with the server's; any in-progress selection is stale
    function OnGameState(cards, _turn, squares, winnerColor)
    {
      setCardState(cards);
      setSquares(squares);
      setWinner(winnerColor ?? null);
      setSelection(EMPTY_SELECTION);
      console.log("recieved gamestate turn", socket.id);
    }
    // the server moved this socket into a room; put its code in the URL so a refresh rejoins it
    function OnRoomJoined(joined)
    {
      roomIdRef.current = joined.id;
      setRoom(joined);
      if (ReadRoomFromUrl(window.location.search) !== joined.id)
      {
        window.history.pushState(null, "", RoomUrl(window.location.href, joined.id));
      }
    }

    // a join or create was refused; an unknown room in the URL falls back to the lobby
    function OnRoomError(reason)
    {
      console.log("roomError:", reason);
      if (reason === "no-room")
      {
        ToLobby();
      }
    }

    // browser back/forward: join the room now in the URL, or go back to the lobby when there is none
    function OnPopState()
    {
      if (!JoinRoomFromUrl())
      {
        ToLobby();
      }
    }

    socket.on("gameState", OnGameState);
    socket.on("seats", setSeats);
    socket.on("rooms", setRooms);
    socket.on("roomJoined", OnRoomJoined);
    socket.on("roomError", OnRoomError);
    window.addEventListener("popstate", OnPopState);
    return () =>
    {
      socket.off("gameState", OnGameState);
      socket.off("seats", setSeats);
      socket.off("rooms", setRooms);
      socket.off("roomJoined", OnRoomJoined);
      socket.off("roomError", OnRoomError);
      window.removeEventListener("popstate", OnPopState);
    };
  }, []);

  if (room === null)
  {
    return (
      <div className="flex-container">
        <div className="side-window">
          <h1>Play Onitama</h1>
          <Lobby
            rooms={rooms}
            onJoin={(roomId) => socket.emit("joinRoom", roomId)}
            onCreate={(roomName) => socket.emit("createRoom", roomName)}
          />
        </div>
      </div>
    );
  }

  return (
    <ButtonContext value={OnSquareClick}>
    <div className="flex-container">
      <div className="game-window">
        <div className="game-column">
          {RenderHand("red")}
          <div className="game">
            <div className="game-board">
              {currentSquares && (
                <Board
                  squares={currentSquares}
                  targets={targets}
                  selectedPiece={selection.piece}
                />
              )}
            </div>
            {RenderPass()}
            {RenderNeutral()}
          </div>
          {RenderHand("blue")}
        </div>
        <WinPopup
          winner={winner}
          canRematch={myColor !== null}
          onRematch={() => socket.emit("restartGame")}
        />
      </div>
      <div className="side-window">
        <h1>Play Onitama</h1>
        <div className="room-header">{`Room: ${room.name} (${room.id})`}</div>
        <div className="button-container">
          <SeatPicker
            seats={seats}
            onPick={(color) => socket.emit("pickSeat", color)}
            onLeave={() => socket.emit("leaveSeat")}
          />
          <button onClick={ToLobby}>Back to lobby</button>
        </div>
      </div>
    </div>
    </ButtonContext>
  );

  // returns to the lobby: tells the server to leave the joined room, if any (its seat is freed at once),
  // clears the room from the URL and drops the room's game state
  function ToLobby()
  {
    if (roomIdRef.current !== null)
    {
      socket.emit("leaveRoom");
    }
    if (ReadRoomFromUrl(window.location.search) !== null)
    {
      window.history.pushState(null, "", RoomUrl(window.location.href, null));
    }
    roomIdRef.current = null;
    setRoom(null);
    setCardState(null);
    setSquares(null);
    setSeats(null);
    setWinner(null);
    setSelection(EMPTY_SELECTION);
  }

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
        active={cardState.currentPlayer === side && cardState.currentPlayer === seats.mine}
        selectedCard={side === myColor ? selection.card : null}
        onCardClick={side === myColor ? OnCardClick : undefined}
      />
    );
  }

  // a target square sends the move; one of my pieces toggles the piece selection; anything else is ignored.
  // While the player must pass, pieces can't be selected, since no piece has a target
  function OnSquareClick(x, y)
  {
    console.log("on square clicked");
    if (!canAct || mustPass)
    {
      console.log("cant act yet");
      return;
    }
    const target = targets.find((t) => t.x === x && t.y === y);
    if (target)
    {
      socket.emit("pickMove", selection.piece, selection.card, target.moveIndex);
      setSelection(EMPTY_SELECTION);
      return;
    }
    if (PieceOwner(currentSquares[x][y]) === myColor)
    {
      setSelection((prev) => TogglePiece(prev, { x, y }));
    }
  }

  // toggles the card selection in my own hand
  function OnCardClick(cardName)
  {
    if (!canAct)
    {
      return;
    }
    setSelection((prev) => ToggleCard(prev, cardName));
  }

  // with no legal move and a card selected, a button confirms passing with that card
  function RenderPass()
  {
    if (!mustPass || selection.card === null)
    {
      return null;
    }
    return (
      <button className="pass" onClick={OnPassClick}>
        Pass with {selection.card}
      </button>
    );
  }

  // sends the pass to the server; the selection is stale once the turn is gone
  function OnPassClick()
  {
    socket.emit("passTurn", selection.card);
    setSelection(EMPTY_SELECTION);
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
        <div className="card-hand-title">{status}</div>
        <CardView card={BY_NAME.get(cardState.neutral)} player={cardState.currentPlayer} />
      </div>
    );
  }
}

// the status line: empty once the game is over (WinPopup announces the winner), a pass prompt when the
// viewer has no legal move, otherwise whose turn it is
function StatusText(cardState, winner, mustPass)
{
  if (winner !== null)
  {
    return "";
  }
  if (mustPass)
  {
    return "No legal moves: pick a card to swap with the neutral card";
  }
  return cardState ? `${cardState.currentPlayer}'s turn` : "";
}

// the highlight for (x, y): green target, selected piece, or none
function HighlightAt(x, y, targets, selectedPiece)
{
  if (targets.some((t) => t.x === x && t.y === y))
  {
    return "target";
  }
  if (selectedPiece && selectedPiece.x === x && selectedPiece.y === y)
  {
    return "selected";
  }
  return null;
}

// the board as sent by the server: squares[x][y] holds a piece letter or null
function Board({ squares, targets, selectedPiece})
{
  const size = squares.length;
  const rows = Array.from({ length: size }, (_, y) => y);
  const columns = Array.from({ length: size }, (_, x) => x);
  return (
    <>
      {rows.map((y) => (
        <div className="board-row" key={y}>
          {columns.map((x) => (
            <Square
              key={x}
              piece={squares[x][y]}
              highlight={HighlightAt(x, y, targets, selectedPiece)}
              point={{x: x, y: y}}
            />
          ))}
        </div>
      ))}
    </>
  );
}
