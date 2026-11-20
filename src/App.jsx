import { useState, useEffect } from "react";

import Square from "./Square";


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
  const [currentSquares, setSquares] = useState(Array(3).fill(Array(3).fill(null)));
  const xIsNext = currentMove % 2 === 0;

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
    // replaces local turn and board with the server's
    function OnGameState(turn, squares)
    {
      setCurrentMove(turn);
      setSquares(squares);
      console.log("recieved gamestate turn", socket.id);
    }
    socket.on("gameState", OnGameState);
    return () => socket.off("gameState", OnGameState);
  }, []);

  return (
    <>
      {connectionName}
      <div className="game">
        <div>
        </div>
        I am turn on turn: {currentMove}
        <div className="game-board">
          <Board
            squares={currentSquares}
            xIsNext={xIsNext}
            onPlay={HandlePlay}
          />
        </div>
        </div>
    </>
  );


  // sends the proposed next board to the server; the server decides whether it is accepted
  function HandlePlay(nextSquares, point)
  {
    socket.emit("pickSquare", nextSquares, point);
  }
}

// board is playing the current state.
// BUT we move the true state outside of this board we can use a history of the game to go back in time
function Board({ squares, xIsNext, onPlay })
{
  const winner = DetermineWinner(squares);
  let status;
  if (winner)
  {
    status = `winner is ${winner.player}`;
  }
  else
  {
    status = `It's ${xIsNext ? "X" : "O"}'s turn`;
  }

  return (
    <>
      <div className="status">{status}</div>
      {CreateBoard(winner)}
    </>
  );

  // builds the grid of Square rows, highlighting squares on the winning line
  function CreateBoard(args)
  {
    const columns = [];
    for (let i = 0; i < squares.length; i++)
    {
      const rows = [];
      for (let j = 0; j < squares[i].length; j++)
      {
        const winner = args !== null && args.containsPoint(i, j);
        rows.push(
          <Square
            number={squares[i][j]}
            onSquareClicked={() => OnSquareClicked(i, j)}
            winning={winner}
          />
        );
      }
      columns.push(<div className="board-row">{rows}</div>);
    }
    return columns;
  }

  // places the current player's mark on an empty square and passes the new board up
  function OnSquareClicked(X, Y)
  {
    if (squares[X][Y] !== null || DetermineWinner(squares) !== null)
    {
      return;
    }
    const nextSquares = squares.slice();
    nextSquares[X] = squares[X].slice();
    nextSquares[X][Y] = xIsNext ? "X" : "O";
    onPlay(nextSquares, { x: X + 1, y: Y + 1 });
  }
}

// returns { player, rows, containsPoint } for the first completed line, or null
function DetermineWinner(squares)
{
  const winningPatterns = [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
    [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ],
    [
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
    ],
  ];

  for (let i = 0; i < winningPatterns.length; i++)
  {
    const currentLine = winningPatterns[i];
    if (
      squares[currentLine[0].x][currentLine[0].y] !== null &&
      squares[currentLine[1].x][currentLine[1].y] ===
        squares[currentLine[0].x][currentLine[0].y] &&
      squares[currentLine[2].x][currentLine[2].y] ===
        squares[currentLine[0].x][currentLine[0].y]
    )
    {
      return {
        player: squares[currentLine[0].x][currentLine[0].y],
        rows: currentLine,
        // true if (X, Y) lies on this winning line
        containsPoint: function (X, Y)
        {
          return this.rows.some((point) => point.x === X && point.y === Y);
        },
      };
    }
  }

  return null;
}
