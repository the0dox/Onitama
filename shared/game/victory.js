import { PIECES, GATES, PieceOwner, OtherPlayer } from "./board.js";

// each colour's sensei letter
const SENSEI = Object.freeze({ red: PIECES.redSensei, blue: PIECES.blueSensei });

// game play rule 4: true if color's sensei stands on the opponent's gate
export function HasSenseiOnEnemyGate(board, color)
{
  const gate = GATES[OtherPlayer(color)];
  return board[gate.x][gate.y] === SENSEI[color];
}

// true if color still has at least one piece on the board
export function HasPieces(board, color)
{
  return board.some((column) => column.some((cell) => PieceOwner(cell) === color));
}

// turn structure 7: the colour that has won on this board (rule 4: sensei on the enemy gate,
// rule 8: the opponent has no pieces left), or null if the game goes on
export function Winner(board)
{
  return ["red", "blue"].find((color) => IsWinning(board, color)) ?? null;
}

// true if color meets either victory condition on board
function IsWinning(board, color)
{
  return HasSenseiOnEnemyGate(board, color) || !HasPieces(board, OtherPlayer(color));
}
