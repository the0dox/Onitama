import { useState, useEffect } from "react";
//import { walkUpBindingElementsAndPatterns } from "typescript";

import Square from "./Square";


import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

export default function App() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.on("message", (msg) => setMessages((m) => [...m, msg]));
    return () => socket.off("message");
  }, []);

  return (
    <div>
      <button onClick={() => socket.emit("hello", "Player")}>Say hi</button>
      <ul>{messages.map((m, i) => <li key={i}>{m}</li>)}</ul>
    </div>
  );
}


function Game() {
  const dimensions = 3;
  // adding '[X]' in use state means its an array of X's
  // in this case, an array of arrays
  var [history, setHistory] = useState([
    { contents: Array(dimensions).fill(Array(dimensions).fill(null)) },
  ]);
  //var [pieces, setPieces] = useState([[Array()]]);
  const [currentMove, setCurrentMove] = useState(0);
  const [reverse, setReverse] = useState(false);
  var currentSquares = history[currentMove].contents;

  // generally better practice to calculate is next every time rather than having separate
  // x is next is always dependent anyways so its a good canditate for replacing
  const xIsNext = currentMove % 2 === 0;

  let headerMessage;

  let moves = history.map((eachElem, i) => {
    if (i > 0) {
      var description =
        "move #" +
        i +
        "<" +
        eachElem.selection.x +
        "," +
        eachElem.selection.y +
        ">";
    } else {
      description = "game start";
    }

    if (i == currentMove) {
      headerMessage = "You are at " + description;
      return;
    } else {
      description = "Go to " + description;
    }

    return (
      <li key={i}>
        <button onClick={() => setCurrentMove(i)}>{description}</button>
      </li>
    );
  });

  if (reverse) {
    moves = moves.reverse();
  }

  return (
    <>
      <div className="game">
        <div className="game-board">
          <Board
            squares={currentSquares}
            xIsNext={xIsNext}
            onPlay={handlePlay}
          />
        </div>
        <div class="game-info">
          <div>{headerMessage}</div>
          <button onClick={() => setReverse(!reverse)}>
            Move History: {reverse ? "Ascending" : "Descending"}
          </button>
          <ol>{moves}</ol>
        </div>
      </div>
    </>
  );

  function handlePlay(nextSquares, point) {
    // first we slice history from start the current move. so if we are viewing an historical view,
    // we delete the now invalid future by doing a new move
    // '[...array, value]' updates a stateful array by appending value to end of array
    const nextHistory = [
      ...history.slice(0, currentMove + 1),
      { contents: nextSquares, selection: point },
    ];
    setHistory(nextHistory);
    setCurrentMove(nextHistory.length - 1);
  }
}

// board is playing the current state.
// BUT we move the true state outside of this board we can use a history of the game to go back in time
function Board({ squares, xIsNext, onPlay }) {
  let winner = DetermineWinner(squares);
  let status;
  if (winner) {
    status = "winner is " + winner.player;
  } else {
    status = "It's " + (xIsNext ? "X" : "O") + "'s turn";
  }

  return (
    <>
      <div className="status">{status}</div>
      {CreateBoard(winner)}
    </>
  );

  function CreateBoard(args) {
    const columns = [];
    for (let i = 0; i < squares.length; i++) {
      const rows = [];
      for (let j = 0; j < squares[i].length; j++) {
        let winner = args != null && args.containsPoint(i, j);
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

  function OnSquareClicked(X, Y) {
    if (squares[X][Y] != null || DetermineWinner(squares) != null) {
      return;
    }
    const nextSquares = squares.slice();
    nextSquares[X] = squares[X].slice();
    nextSquares[X][Y] = xIsNext ? "X" : "O";
    onPlay(nextSquares, { x: X + 1, y: Y + 1 });
  }
}

function DetermineWinner(squares) {
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

  for (var i = 0; i < winningPatterns.length; i++) {
    const currentLine = winningPatterns[i];
    if (
      squares[currentLine[0].x][currentLine[0].y] != null &&
      squares[currentLine[1].x][currentLine[1].y] ==
        squares[currentLine[0].x][currentLine[0].y] &&
      squares[currentLine[2].x][currentLine[2].y] ==
        squares[currentLine[0].x][currentLine[0].y]
    ) {
      return {
        player: squares[currentLine[0].x][currentLine[0].y],
        rows: currentLine,
        containsPoint: function (X, Y) {
          return this.rows.some((point) => point.x == X && point.y == Y);
        },
      };
    }
  }

  return null;
}
