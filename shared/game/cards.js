import cardData from "../cards.json" with { type: "json" };

// the full 16-card deck, deep-frozen so no caller can alter card definitions at runtime
export const CARDS = Object.freeze(
  cardData.map((card) => Object.freeze({
    ...card,
    moves: Object.freeze(card.moves.map((move) => Object.freeze({ ...move }))),
  })),
);

// indexes cards by their unique name, for resolving the names stored in game state
export function CardsByName(cards)
{
  return new Map(cards.map((card) => [card.name, card]));
}
