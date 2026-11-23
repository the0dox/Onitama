import { BOARD_SIZE } from "./board.js";

// test helper: builds an empty board indexed board[x][y] holding only the given { x, y, piece } entries
export function MakeBoard(pieces)
{
  return Array.from({ length: BOARD_SIZE }, (_, x) =>
    Array.from({ length: BOARD_SIZE }, (_, y) => pieces.find((p) => p.x === x && p.y === y)?.piece ?? null));
}
