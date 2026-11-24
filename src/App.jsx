import { useState, useEffect} from "react";

import Square from "./Square";
import { CardHand, CardView } from "./CardHand";
import { CARDS, CardsByName } from "../shared/game/cards.js";
import { PieceOwner } from "../shared/game/board.js";
import { ButtonContext } from "./BoardContext.jsx";
import { ValidTargets, HasLegalMove } from "../shared/game/moves.js";
import { EMPTY_SELECTION, ToggleCard, TogglePiece } from "./selection.js";
import SeatPicker from "./SeatPicker.jsx";

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
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  // { red: taken, blue: taken, mine: colour | null } as sent by the server
  const [seats, setSeats] = useState(null);
  // "red" | "blue" once the server reports a win, otherwise null
  const [winner, setWinner] = useState(null);
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
    // replaces local card state, turn, board and winner with the server's; any in-progress selection is stale
    function OnGameState(cards, turn, squares, winnerColor)
    {
      setCardState(cards);
      setCurrentMove(turn);
      setSquares(squares);
      setWinner(winnerColor ?? null);
      setSelection(EMPTY_SELECTION);
      console.log("recieved gamestate turn", socket.id);
    }
    socket.on("gameState", OnGameState);
    socket.on("seats", setSeats);
    return () =>
    {
      socket.off("gameState", OnGameState);
      socket.off("seats", setSeats);
    };
  }, []);

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
            {RenderRematch()}
            {RenderPass()}
            {RenderNeutral()}
          </div>
          {RenderHand("blue")}
        </div>
      </div>
      <div className="side-window">
        <h1>Play Onitama</h1>
        <SeatPicker
          seats={seats}
          onPick={(color) => socket.emit("pickSeat", color)}
          onLeave={() => socket.emit("leaveSeat")}
        />
      </div>
    </div>
    </ButtonContext>
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

  // once the game is won, seated players get a button that asks the server for a new game
  function RenderRematch()
  {
    if (winner === null || myColor === null)
    {
      return null;
    }
    return (
      <button className="rematch" onClick={() => socket.emit("restartGame")}>
        Rematch
      </button>
    );
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

// the status line: the winner once the game is over, a pass prompt when the viewer has no legal move,
// otherwise whose turn it is
function StatusText(cardState, winner, mustPass)
{
  if (winner !== null)
  {
    return `${winner} wins`;
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



function RenderHeader({player, myColor})
{
  const connectionName = player ? `${player.name}:${player.id}` : "connecting...";
  let displayClass = ({ red: "p1", blue: "p2" })[myColor];
  return(
  <div className={displayClass}>
    {connectionName}
  </div>
  );
}  
