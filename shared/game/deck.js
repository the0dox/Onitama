import { HashSeed, CreateRng } from "./random.js";
import { CardsByName } from "./cards.js";

// TODO(server wiring): read DECK_SEED from the environment; if unset, generate a random seed
// and log it so the game can be reproduced. These functions only ever receive the seed.

// returns a new array with the cards in a seed-determined order (Fisher-Yates)
export function ShuffleDeck(cards, seedString)
{
  const rng = CreateRng(HashSeed(seedString));
  return cards.reduceRight((deck, _card, i) =>
  {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
    return deck;
  }, [...cards]);
}

// deals the top five cards by name: two to red, two to blue, the fifth to the neutral zone
export function DealCards(shuffled)
{
  const [r0, r1, b0, b1, neutral] = shuffled.map((card) => card.name);
  return { hands: { red: [r0, r1], blue: [b0, b1] }, neutral };
}

// the suit of the neutral card decides who moves first
export function FirstPlayer(neutralName, byName)
{
  return byName.get(neutralName).suit;
}

// builds the starting card state for a new game: shuffle, deal, pick first player
export function CreateCardState(cards, seedString)
{
  const { hands, neutral } = DealCards(ShuffleDeck(cards, seedString));
  return { hands, neutral, currentPlayer: FirstPlayer(neutral, CardsByName(cards)) };
}

// swaps the player's used card with the neutral card; returns null if the card isn't in their hand
export function SwapWithNeutral(state, player, cardName)
{
  const hand = state.hands[player];
  if (!hand || !hand.includes(cardName))
  {
    return null;
  }
  return {
    ...state,
    hands: { ...state.hands, [player]: hand.map((name) => (name === cardName ? state.neutral : name)) },
    neutral: cardName,
  };
}

// returns the card's moves as seen by the player: red as written, blue rotated 180 degrees
export function MovesForPlayer(card, player)
{
  if (player !== "blue")
  {
    return card.moves.map((move) => ({ x: move.x, y: move.y }));
  }
  // "|| 0" turns -0 into 0 so flipped zero offsets compare equal to 0
  return card.moves.map((move) => ({ x: -move.x || 0, y: -move.y || 0 }));
}
