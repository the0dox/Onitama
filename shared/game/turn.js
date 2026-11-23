import { SwapWithNeutral } from "./deck.js";
import { OtherPlayer } from "./board.js";
import { Winner } from "./victory.js";

// applies a move CheckMove has already accepted (turn structure 5 to 8): the current player's piece
// moves from start to target, replacing anything there, the used card swaps with the neutral card,
// the win conditions are checked, and the turn passes to the other player unless the game is over
// (then the winner stays as currentPlayer). Returns a new { board, cardState, winner }, where winner is
// "red", "blue" or null; the inputs are unchanged.
export function ApplyMove(board, cardState, start, target, cardName)
{
  const player = cardState.currentPlayer;
  const swapped = SwapUsedCard(cardState, cardName, "ApplyMove", "CheckMove");
  const piece = board[start.x][start.y];
  const newBoard = board.map((column, x) => column.map((cell, y) => CellAfterMove(cell, x, y, piece, start, target)));
  const winner = Winner(newBoard);
  return {
    board: newBoard,
    cardState: { ...swapped, currentPlayer: winner ?? OtherPlayer(player) },
    winner,
  };
}

// applies a pass CheckPass has already accepted (turn structure 1 straight to 6 and 8): the current player
// has no legal move, so only the chosen card swaps with the neutral card and the turn passes. The board is
// untouched, so no win check is needed. Returns the new cardState; the input is unchanged.
export function ApplyPass(cardState, cardName)
{
  const swapped = SwapUsedCard(cardState, cardName, "ApplyPass", "CheckPass");
  return { ...swapped, currentPlayer: OtherPlayer(cardState.currentPlayer) };
}

// turn structure 6: swaps the current player's used card with the neutral card; throws if the card is not
// in their hand, since the validator named by checker must have rejected that request already
function SwapUsedCard(cardState, cardName, caller, checker)
{
  const player = cardState.currentPlayer;
  const swapped = SwapWithNeutral(cardState, player, cardName);
  if (!swapped)
  {
    throw new Error(`${caller}: ${cardName} is not in ${player}'s hand; ${checker} should have rejected it`);
  }
  return swapped;
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
