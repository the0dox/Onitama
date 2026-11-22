# Onitama rule test checklist

Cases worth covering, grouped by the `CLAUDE.md` section they come from. Pick what's relevant to the code under test.

## Setup

- Board is 5x5 and every cell outside rows 0 and 4 is empty.
- Red: pieces at (0,0)–(4,0); sensei at (2,0); the other four are disciples.
- Blue: pieces at (0,4)–(4,4); sensei at (2,4); the other four are disciples.
- Gates are recorded at (2,0) for red and (2,4) for blue, and stay there after the sensei moves away.
- Dealing: red gets 2 cards, blue gets 2, neutral gets the 5th; all 5 are distinct.
- First player = suite of the neutral card (test one red-suite and one blue-suite neutral card).

## Deck

- `cards.json` has 16 cards, unique names, valid `suite`, non-empty `moves` with integer `x`/`y`.
- Same seed → identical order (call twice).
- Different seeds → different order (pick two seeds known to differ; don't assert this probabilistically).
- Shuffle output is a permutation: same 16 cards, none lost or duplicated.
- Shuffle does not mutate the input deck.

## Move generation (rules 5, 6, 7, 9)

- Red applies card moves as written; blue negates both x and y.
- Target off the board (x or y < 0 or > 4) is excluded. Test each of the four edges.
- Target occupied by a friendly piece is excluded.
- Target occupied by an enemy piece is included.
- Jumps are not blocked: a piece between start and target doesn't matter.
- A card with several moves yields all valid ones.
- All moves for a player = every (piece, card in hand, move) combination; an empty result triggers the no-legal-moves path.

## Applying a move (turn steps 5, 6)

- Piece ends at the target, start cell becomes empty.
- Capturing removes the enemy piece (piece counts drop by one).
- The used card goes to the neutral zone and the old neutral card joins the player's hand; the other hand card is untouched.
- No-legal-moves turn: only the card swap happens, the board is unchanged.
- The input state is not mutated.

## Victory (rules 4, 8; turn step 7)

- Red sensei on (2,4) → red wins; blue sensei on (2,0) → blue wins.
- A disciple on the enemy gate does **not** win.
- A sensei on its *own* gate does not win.
- Capturing the enemy's last piece wins.
- Losing your sensei alone does not lose the game; disciples can still play on.
- Ordinary mid-game positions → no winner.

## Turn order and validation (server-side, still pure if extracted)

- Only the player whose turn it is may move; the other player's request is rejected and state is unchanged.
- A move not in the legal set is rejected (a forged target, a card not in hand, a piece belonging to the opponent, an empty starting square).
- After a valid move the turn passes to the other player, unless the game is over.
