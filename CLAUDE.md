# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Two-player online tic-tac-toe (the repo is named Onitama; the current game is tic-tac-toe). The React + Vite client lives at the repo root; the Express + Socket.IO server lives in `server/`. Each has its own `package.json` and `node_modules`.

## Commands

Client (repo root):
- `npm run dev` — Vite dev server (default http://localhost:5173)
- `npm run build` / `npm run preview`
- `npm run lint` — ESLint (flat config in `eslint.config.js`)

Server (`server/`):
- `npm run dev` — `node --watch src/index.js`, listens on :3001
- `npm start`

There is no test suite. To play both sides locally, run the server and open the client in two browser tabs (identity is stored in `sessionStorage`, so each tab is a separate player).

## Architecture

**Identity/auth flow** (spans `src/App.jsx` and `server/src/index.js`):
1. The client calls `POST /players`, and the server returns `{id, name, token}` (stored in an in-memory `players` Map).
2. The client caches this in `sessionStorage` and connects the socket with `auth: {id, token}`. The socket is created with `autoConnect: false` so it waits for credentials.
3. The `io.use` middleware rejects mismatched credentials with `"unauthorized"`. On that error the client discards the cached identity and re-registers. This handles server restarts, which wipe all state.
4. `getPlayer()` memoizes a module-level promise so React StrictMode's double-invoked effect doesn't register twice.

**Game state is server-authoritative, global and in-memory**: one `board`, one `currentMove`, and two `playerSlots` (holding player tokens) shared by all connections. There are no rooms. The first two connecting players claim slots 0 (X) and 1 (O); reconnecting players keep their slot. Later connections are spectators.

**Socket events**:
- server → client: `welcome(player)`, `gameState(currentMove, board)` (sent on connect and broadcast after each accepted move)
- client → server: `pickSquare(squares, point)`. The client sends the *entire next board*. The server only checks whose turn it is (`currentMove % 2` against the slot token), then replaces its board with the client's. It does not validate square occupancy, win state, or board shape.

**Client rendering**: `App` holds the state received from the server and renders `Board`, which computes the next board and the winner (`DetermineWinner`) locally. `Board`/`Square` are reused from an earlier local-only version.

## Gotchas
- The server URL `http://localhost:3001` is hardcoded in `App.jsx`. The server's CORS accepts any `http://localhost:<port>` origin.
- Dead code: `src/index.jsx` (unused entry point; `index.html` loads `src/main.jsx`).
