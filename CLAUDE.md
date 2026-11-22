# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Two-player online tic-tac-toe but the game rules to be migrated to a board game called Onitama. The React + Vite client lives at the repo root; the Express + Socket.IO server lives in `server/`. Each has its own `package.json` and `node_modules`.

## Commands

Client (repo root):
- `npm run dev` — Vite dev server (default http://localhost:5173)
- `npm run build` / `npm run preview`
- `npm run lint` — ESLint (flat config in `eslint.config.js`)

Server (`server/`):
- `npm run dev` — `node --watch src/index.js`, listens on :3001
- `npm start`

Tests (repo root, Vitest; covers `src/`, `shared/` and `server/src/` `*.test.js(x)` files):
- `npm test` — run once
- `npm run test:watch` — watch mode
- `npx vitest run shared/game/deck.test.js` — single file; add `-t "<name>"` for a single test

To play both sides locally, run the server and open the client in two browser tabs (identity is stored in `sessionStorage`, so each tab is a separate player).

## Architecture

**Identity/auth flow** (spans `src/App.jsx` and `server/src/index.js`):
1. The client calls `POST /players`, and the server returns `{id, name, token}` (stored in an in-memory `players` Map).
2. The client caches this in `sessionStorage` and connects the socket with `auth: {id, token}`. The socket is created with `autoConnect: false` so it waits for credentials.
3. The `io.use` middleware rejects mismatched credentials with `"unauthorized"`. On that error the client discards the cached identity and re-registers. This handles server restarts, which wipe all state.
4. `getPlayer()` memoizes a module-level promise so React StrictMode's double-invoked effect doesn't register twice.

**Game state is server-authoritative, global and in-memory**: one `board`, one `currentMove`, and two `playerSlots` (holding player tokens) shared by all connections. There are no rooms. The first two connecting players claim slots 0 (X) and 1 (O); reconnecting players keep their slot. Later connections are spectators.

**Game play rules**
1. game takes place on a 5x5 grid. the top left corner is (0,0) and +y points downwards by default
2. there are two players red and blue, each with 5 game pieces. Players start on opposite edges of the board. Row #0 for red and row #4 for blue.
3. each side has 4 disciple pieces and a single sensei figure in the center of their pieces. (2,0) for red and (2,4) for blue
4. Players also own gates. Which are not pieces but instead the starting positions of the sensei (2,0) for red and (2,4) for blue. If at the end of any turn, a player's sensei is standing on the opponents gate. That player wins. Losing a sensei prevents its owner from achieving this victory option, but doesn't lose them the game.
5. Only one piece can occupy a given position.
6. pieces cannot move off of the board or onto spaces occupied by pieces owned by the moving player. Moves can't be blocked by a piece being in the way of the path. 
7. pieces can move onto spaces occupied by an enemy piece, doing so removes the piece from play.
8. if at the end of any turn, a player has no pieces on the board they lose.
9. There is a deck of 16 cards (defined as json objects that are loaded from /shared/cards.json), each card has a name, a suit (red or blue) and a number of moves a piece can take. Example: the horse card has the red suit and can make a piece translate relative to its current position on the grid (x: -2, y: +2) or (x: +2, y: +2). Blue pieces are flipped 180 degrees, flipping both the x and y values negative of on all cards when moving. 
10. each player takes turns until the victory conditions defined in rule 4. and 8. are met. At that point the players can choose to rematch.

**Game play setup**
1. initalize 5x5 grid
2. place red players pieces on positions (0,0) through (4,0). Mark (2,0) as a gate and create a sensei there. Every other position is a disciple piece
3. place blue player pieces on positions (0,4) through (4,4), Mark (2,4) as a gate and create a sensei there. Every other position is a disciple piece
4. shuffle the deck based based on an envrionment variable seed. If no seed is given to the server on launch, use a randomized seed
5. red player draws 2 cards from the 16 card deck
6. blue player draws 2 cards from the deck
7. a 5th card is drawn and placed in the netural card zone.
8. check the suit of 5th card, if the suit is red, red player goes first, if it is blue, blue player goes first

**Game play turn structure**
1. the game first determines all possible moves with every piece and card combination and stores them. If no legal moves are possible, the player is prompted to select a card and move directly to step 6. 
2. player selects one of the 2 cards in their hand
3. player selects one of their remaining pieces
4. player is shown each position the selected piece can move to based on the set of moves contained by the selected card. Positions are only valid and selectable if they don't fall off the map, and don't overlap with a piece controlled by the same player.
5. after the player selects the position, the selected piece updates its position, replacing any piece that existed in that space beforehand.
6. the player then swaps the selected card with the card in the neutral zone.
7. then the game victory conditions are checked based on gameplay setup rules 4. (friendly sensei occupies opponent gate) and 8. (all enemy pieces are destroyed) 
8. if the game is not over the turn passes to the next player

**Socket events**:
- server → client: `welcome(player)`, `gameState(currentMove, board)` (sent on connect and broadcast after each accepted move)
- client → server: `pickMove(startingLocation, card, move)`. The client sends the location of the piece it wants to move, the card they selected, and the move within the card they want to use. The server checks if it the players turn (`currentMove % 2` against the slot token), It then applies the move according to game play turn structure rules 5-8 it the server then broadcasts the new gamestate to all players.

**Shared game logic** (`shared/`, importable by client and server; pure functions, no mutation):
- `shared/cards.json` — the 16 cards `{ name, suit, moves: [{x, y}] }`. Moves are written from red's perspective; names are unique (currently placeholders `card-01`… plus `horse`).
- `shared/game/cards.js` — `CARDS` (deep-frozen) and `CardsByName()`.
- `shared/game/random.js` — `HashSeed()` (FNV-1a string → uint32) and `CreateRng()` (mulberry32), so the `DECK_SEED` string reproduces a shuffle.
- `shared/game/deck.js` — `ShuffleDeck`, `DealCards`, `FirstPlayer`, `CreateCardState`, `SwapWithNeutral`, `MovesForPlayer` (blue negates x and y). Game state holds cards **by name**: `{ hands: { red: [a, b], blue: [c, d] }, neutral, currentPlayer }`; undealt cards are discarded.
- Not yet wired into the server: reading `DECK_SEED` (with a logged random fallback) is still to do.

**Client rendering**: `App` holds the state received from the server and renders `Board`, which computes the next board and the winner (`DetermineWinner`) locally. `Board`/`Square` are reused from an earlier local-only version.

## Gotchas
- The server URL `http://localhost:3001` is hardcoded in `App.jsx`. The server's CORS accepts any `http://localhost:<port>` origin.
- Dead code: `src/index.jsx` (unused entry point; `index.html` loads `src/main.jsx`).
