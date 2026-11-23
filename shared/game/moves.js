import { OnBoard, PieceOwner } from "./board.js";
import { MovesForPlayer } from "./deck.js";

// the square reached from start by the card's moveIndex-th move, as seen by player; null for a bad index
export function TargetFor(start, card, player, moveIndex)
{
  const move = MovesForPlayer(card, player)[moveIndex];
  if (!move)
  {
    return null;
  }
  return { x: start.x + move.x, y: start.y + move.y };
}

// every square the piece at start can reach with card: on the board and not occupied by the player's own piece
// moveIndex is the index into card.moves, so the server can re-derive the target from it
export function ValidTargets(board, start, card, player)
{
  return MovesForPlayer(card, player)
    .map((move, moveIndex) => ({ x: start.x + move.x, y: start.y + move.y, moveIndex }))
    .filter(({ x, y }) => ValidTarget(board, player, x, y));
}

// true if player may land on (x, y): on the board and not occupied by one of their own pieces
export function ValidTarget(board, player, x, y)
{
  return OnBoard(x, y) && PieceOwner(board[x][y]) !== player;
}

// validates a pickMove request; returns { ok: true, target } or { ok: false, reason }
// reason is one of "not-your-turn", "no-piece", "not-in-hand", "bad-move", "bad-target"; checks run in that order
// so nothing indexes the board with an unchecked start
// cardState is { hands: { red, blue }, neutral, currentPlayer }: the turn and the sender's hand come from it
export function CheckMove(board, cardState, color, start, cardName, moveIndex, cardsByName)
{
  if (color === null || color !== cardState.currentPlayer)
  {
    return { ok: false, reason: "not-your-turn" };
  }
  if (!OnBoard(start?.x, start?.y) || PieceOwner(board[start.x][start.y]) !== color)
  {
    return { ok: false, reason: "no-piece" };
  }
  if (!InHand(cardState, color, cardName))
  {
    return { ok: false, reason: "not-in-hand" };
  }
  const card = cardsByName.get(cardName);
  const target = card ? TargetFor(start, card, color, moveIndex) : null;
  if (!target)
  {
    return { ok: false, reason: "bad-move" };
  }
  if (!ValidTarget(board, color, target.x, target.y))
  {
    return { ok: false, reason: "bad-target" };
  }
  return { ok: true, target };
}

// turn structure 1: true if some piece of player's can reach a valid target with a card in their hand
export function HasLegalMove(board, cardState, player, cardsByName)
{
  const cards = (cardState.hands?.[player] ?? []).map((name) => cardsByName.get(name)).filter(Boolean);
  return board.some((column, x) => column.some((cell, y) =>
    PieceOwner(cell) === player && cards.some((card) => ValidTargets(board, { x, y }, card, player).length > 0)));
}

// validates a passTurn request (turn structure 1, then straight to 6); returns { ok: true } or { ok: false, reason }
// reason is one of "not-your-turn", "not-in-hand", "has-legal-move"; checks run in that order
export function CheckPass(board, cardState, color, cardName, cardsByName)
{
  if (color === null || color !== cardState.currentPlayer)
  {
    return { ok: false, reason: "not-your-turn" };
  }
  if (!InHand(cardState, color, cardName))
  {
    return { ok: false, reason: "not-in-hand" };
  }
  if (HasLegalMove(board, cardState, color, cardsByName))
  {
    return { ok: false, reason: "has-legal-move" };
  }
  return { ok: true };
}

// true if cardName is a string naming one of the cards in player's hand
function InHand(cardState, player, cardName)
{
  return typeof cardName === "string" && (cardState.hands?.[player] ?? []).includes(cardName);
}
