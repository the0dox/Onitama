import { HashSeed, CreateRng } from "./random.js";
import { CardsByName } from "./cards.js";

// these functions only ever receive the seed; server/src/seed.js resolves it from DECK_SEED

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

// cards dealt at the start of a game: two per hand plus the neutral card
export const DEAL_SIZE = 5;

// builds the starting card state from an already ordered deck: deal, then pick the first player
export function CardStateFromDeck(deck, byName)
{
  const { hands, neutral } = DealCards(deck);
  return { hands, neutral, currentPlayer: FirstPlayer(neutral, byName) };
}

// builds the starting card state for a new game: shuffle, deal, pick first player
export function CreateCardState(cards, seedString)
{
  return CardStateFromDeck(ShuffleDeck(cards, seedString), CardsByName(cards));
}

// validates an injected deck of card names (deal order); returns { ok: true, deck } with the
// card objects, or { ok: false, reason } with not-array, too-few, unknown-card or duplicate
export function CheckDeckOverride(names, byName)
{
  if (!Array.isArray(names))
  {
    return { ok: false, reason: "not-array" };
  }
  if (names.length < DEAL_SIZE)
  {
    return { ok: false, reason: "too-few" };
  }
  if (!names.every((name) => typeof name === "string" && byName.has(name)))
  {
    return { ok: false, reason: "unknown-card" };
  }
  return { ok: true, deck: names.map((name) => byName.get(name)) };
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
