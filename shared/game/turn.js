import { SwapWithNeutral } from "./deck.js";

// the colour that moves after player
export function OtherPlayer(player)
{
  return player === "red" ? "blue" : "red";
}

// applies a move CheckMove has already accepted (turn structure 5, 6 and 8): the current player's piece
// moves from start to target, replacing anything there, the used card swaps with the neutral card,
// and the turn passes to the other player. Returns a new { board, cardState }; the inputs are unchanged.
// Win checks (turn structure 7) are not done here yet.
export function ApplyMove(board, cardState, start, target, cardName)
{
  const player = cardState.currentPlayer;
  const swapped = SwapWithNeutral(cardState, player, cardName);
  if (!swapped)
  {
    throw new Error(`ApplyMove: ${cardName} is not in ${player}'s hand; CheckMove should have rejected it`);
  }
  const piece = board[start.x][start.y];
  return {
    board: board.map((column, x) => column.map((cell, y) => CellAfterMove(cell, x, y, piece, start, target))),
    cardState: { ...swapped, currentPlayer: OtherPlayer(player) },
  };
}

// what (x, y) holds after piece moves from start to target
function CellAfterMove(cell, x, y, piece, start, target)
{
  if (x === target.x && y === target.y)
  {
    return piece;
  }
  if (x === start.x && y === start.y)
  {
    return null;
  }
  return cell;
}
