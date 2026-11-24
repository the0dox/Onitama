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

**Game state is server-authoritative, global and in-memory**: one `board`, one `cardState`, one `currentMove`, and `seats` (`[redToken | null, blueToken | null]`) shared by all connections. There are no rooms. Every connection starts as a spectator and picks a free side with `pickSeat`. Seat rules are pure functions in `server/src/seats.js` (`SeatOf`, `ClaimSeat`, `ReleaseSeat`, `LeaveSeat`, `ShouldReleaseSeat`, `SeatsView`). When a seated player's last socket disconnects (`ShouldReleaseSeat`), the seat is freed after `SEAT_GRACE_MS` (15 s, longer than the socket.io client's reconnect backoff) unless the same token reconnects first, so a refresh or brief network drop keeps the seat. The per-token timers live in `server/src/releaseTimers.js` (`CreateReleaseTimers` → `Schedule`/`Cancel`/`IsPending`; rescheduling replaces a pending timer). Tokens never leave the server: each client only gets its own `SeatsView`. Whose turn it is comes from `cardState.currentPlayer`; `currentMove` only counts accepted turns, moves and passes alike (blue can move first, so `currentMove % 2` does not give the colour).

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
- server → client: `welcome({id, name})`, `gameState(cardState, currentMove, board, winner)` (`winner` is `"red"`, `"blue"` or null; sent on connect and broadcast after each accepted move and each restart), `seats({red, blue, mine})` (`red`/`blue` are booleans for "taken" and `mine` is the receiver's colour or null; sent on connect and to every socket whenever a seat is claimed or released)
- client → server: `pickSeat(color)` claims the free `"red"`/`"blue"` seat; it is rejected (logged) with `bad-color`, `already-seated` or `taken`. `leaveSeat()` gives up the sender's seat (rejected with `not-seated` for spectators); the game is not reset, and the player may then pick either free side.
- client → server: `pickMove(start, cardName, moveIndex)`. The client sends the location of the piece it wants to move, the name of the card it selected, and the index of the move within that card. The server validates it with `CheckMove` (the sender's seat colour must equal `cardState.currentPlayer`, then start square, card in the sender's hand, move index, target) and logs and ignores rejected moves. Once a game has a winner, every move is rejected with `game-over` before `CheckMove` runs. An accepted move goes through `ApplyMove` (turn structure 5 to 8, including the win check), `currentMove` is incremented, the server's `winner` is set from the result, and the new state is broadcast to all players.
- client → server: `passTurn(cardName)` is turn structure 1: a player with no legal move swaps a held card with the neutral card and the turn passes (board unchanged, `currentMove` incremented). It is rejected with `game-over` once there is a winner, then by `CheckPass`. The client detects the stuck state with `HasLegalMove`, shows a prompt in the status line, and once a card is selected shows a "Pass with <card>" button that emits the event.
- client → server: `restartGame()` starts a rematch (new board and deck, seats kept). It is ignored for spectators and rejected with `game-not-over` while `winner` is null. The client shows a Rematch button to seated players once there is a winner.

**Shared game logic** (`shared/`, importable by client and server; pure functions, no mutation):
- `shared/cards.json` — the 16 cards `{ name, suit, moves: [{x, y}] }`. Moves are written from red's perspective (+y = forward toward blue, +x = right); names are the 16 lowercase base-game names (`tiger`, `dragon`, … `cobra`). Mirrored pairs (frog/rabbit, goose/rooster, horse/ox, eel/cobra) are x-flips of each other.
- `shared/game/board.js` — `BOARD_SIZE`, `PIECES` (`r`/`R` red disciple/sensei, `b`/`B` blue), `GATES`, `OtherPlayer`, `PieceOwner`, `OnBoard` (integers only), `StartingPiece`, `CreateBoard`. Boards are indexed `board[x][y]`. It also exports the React `ButtonContext`, so it imports `react`.
- `shared/game/cards.js` — `CARDS` (deep-frozen) and `CardsByName()`.
- `shared/game/random.js` — `HashSeed()` (FNV-1a string → uint32) and `CreateRng()` (mulberry32), so the `DECK_SEED` string reproduces a shuffle.
- `shared/game/deck.js` — `ShuffleDeck`, `DealCards`, `FirstPlayer`, `CreateCardState`, `SwapWithNeutral`, `MovesForPlayer` (blue negates x and y). Game state holds cards **by name**: `{ hands: { red: [a, b], blue: [c, d] }, neutral, currentPlayer }`; undealt cards are discarded.
- `shared/game/moves.js` — `TargetFor`, `ValidTargets`, `ValidTarget`, and `CheckMove(board, cardState, color, start, cardName, moveIndex, cardsByName)`, which returns `{ ok: true, target }` or `{ ok: false, reason }` with reason `not-your-turn`, `no-piece`, `not-in-hand`, `bad-move` or `bad-target` (checked in that order). `HasLegalMove(board, cardState, player, cardsByName)` is true if any of the player's pieces can reach a valid target with a held card. `CheckPass(board, cardState, color, cardName, cardsByName)` returns `{ ok: true }` or `{ ok: false, reason }` with `not-your-turn`, `not-in-hand` or `has-legal-move`.
- `shared/game/turn.js` — `ApplyMove(board, cardState, start, target, cardName)`, which returns a new `{ board, cardState, winner }`: piece moved (capturing), used card swapped with the neutral card, win checked with `Winner`, and `currentPlayer` flipped unless there is a winner (then the winner stays as `currentPlayer`). It throws if the card is not in the mover's hand, since `CheckMove` must run first. `ApplyPass(cardState, cardName)` returns the new cardState after a pass (card swapped, turn flipped); it throws the same way if `CheckPass` was skipped.
- `shared/game/victory.js` — `HasSenseiOnEnemyGate(board, color)` (rule 4), `HasPieces(board, color)` (rule 8) and `Winner(board)`, which returns `"red"`, `"blue"` or null. It doesn't import `turn.js`, since `turn.js` imports it.
- `shared/game/testBoard.js` — test-only `MakeBoard(pieces)`, which builds a board holding only the given `{ x, y, piece }` entries.
- The server resolves `DECK_SEED` in `server/src/seed.js` (`ResolveDeckSeed`, with a logged random fallback); only the first game uses it, rematches reshuffle randomly.
- Test settings live in the committed `server/src/serverSettings.json`, loaded by `server/src/settings.js` (`LoadServerSettings`, `ResolveOverrideDeck`). `overrideDeck` is `null` or an array of at least 5 unique card names in deal order (red, red, blue, blue, neutral; extras ignored). When valid it takes precedence over `DECK_SEED` and is dealt for every game, rematches included (`CardStateFromDeck`). An invalid list (`CheckDeckOverride` reasons `not-array`, `too-few`, `unknown-card`, `duplicate`) logs a warning and the deck is shuffled as normal.

**Client rendering**: `App` (`src/App.jsx`) holds the state received from the server (`cardState`, `currentMove`, board, `winner`) and the local selection (`src/selection.js`). It renders both hands (`CardHand`), the neutral card (`CardView`, shown from the current player's perspective) and `Board`, a component defined in `App.jsx` that only draws the squares and highlights. The client never computes the winner: it shows the server's `winner` in the status line and blocks selection once it is set. Target squares come from `ValidTargets` once a piece and a card are selected, and clicking one emits `pickMove`. Squares receive the click handler through `ButtonContext`.

## Gotchas
- The server URL `http://localhost:3001` is hardcoded in `App.jsx`. The server's CORS accepts any `http://localhost:<port>` origin.
- Dead code: `src/index.jsx` (unused entry point; `index.html` loads `src/main.jsx`).
