---
name: unit-tests
description: Write, extend, or fix Vitest unit tests for this Onitama project — pure game-rule logic (board setup, card moves, blue's flipped moves, captures, gate and elimination wins, seeded deck shuffle, turn/card swap) and React components (Board, Square, card hand). Use this whenever the user asks to add tests, "test this", check coverage, verify a rule works, set up a test runner, or after implementing or changing a game rule or component and wanting it verified — even if they don't say "unit test" explicitly. Also handles making untestable code testable by extracting pure functions into importable modules.
---

# Unit tests for Onitama

Vitest is set up (`npm test`); this skill keeps new tests consistent with the existing ones in `shared/`. The game rules in the project `CLAUDE.md` ("Game play rules", "Game play setup", "Game play turn structure") are the specification. Tests encode that spec — so when a test and the implementation disagree, figure out which one matches `CLAUDE.md` before changing anything.

## Workflow

1. **Identify the target.** Which rule, function, or component? Read the relevant source and the matching `CLAUDE.md` rule(s).
2. **Ensure the runner exists** (first time only) — see *Setup*.
3. **Make it testable** if needed — see *Making code testable*.
4. **Write the tests** — see *Writing rule tests* / *Writing component tests*. Use the rule checklist in `references/rule-checklist.md` to find cases you'd otherwise miss.
5. **Run** `npm test` from the repo root. Also run `npm run lint`.
6. **Report**: what's covered, what was refactored, and any test that fails because the *code* is wrong. Do not weaken or delete a failing test to make it pass when the test reflects `CLAUDE.md`; surface the bug instead. If `CLAUDE.md` itself is ambiguous or self-contradictory for the case, say so and ask rather than guessing.

## Setup (first time only)

Check `package.json` for a `test` script. If missing:

```
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

Add a `test` block to the existing `vite.config.js` (don't create a separate config — one config keeps the React plugin and test settings in sync):

```js
test: {
  environment: "node",
  include: ["src/**/*.test.{js,jsx}", "shared/**/*.test.js", "server/src/**/*.test.js"],
  setupFiles: ["./src/test/setup.js"],
},
```

`src/test/setup.js`:

```js
import "@testing-library/jest-dom/vitest";
```

Scripts in the root `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`.

Node is the default environment because most tests are pure rule logic, which runs faster without a DOM. Component test files opt into a DOM with a docblock on line 1: `/** @vitest-environment jsdom */`.

Then update `CLAUDE.md`: replace "There is no test suite." with the test commands, so future sessions know the suite exists.

## Making code testable

Logic that lives inside socket handlers, React components, or closures over module state can't be unit-tested directly. Extract it — behavior must stay identical, only its location and signature change.

- **Where:** rule logic used by both client and server (move generation, win checks, setup, deck) goes in `shared/game/` (e.g. `shared/game/moves.js`, `shared/game/victory.js`, `shared/game/deck.js`). `cards.json` already lives in `shared/`. Server-only logic goes in `server/src/`. A component that sits inside another file (like `Board` in `App.jsx`) moves to its own file under `src/`.
- **Shape:** pure functions — state and inputs in, new value out. No mutation of arguments, no reading globals, no `socket`, no `Math.random()`. This is what makes a test a three-line arrange/act/assert instead of a mock-heavy setup.
- **Randomness:** the shuffle takes a seed (or an RNG function) as a parameter. The server reads the env var and passes it in; the test passes a fixed seed.
- **Wire it back:** the original call site imports the extracted function. Verify the app still starts (`npm run build` for the client; for the server, check `node server/src/index.js` starts without import errors, then stop it).

## Code style for tests

Tests follow the same rules as production code (from the global `CLAUDE.md`):

- Allman braces, `const`/`let`, `===`, template strings `${a}`.
- Named helpers in PascalCase with a one-line comment above each: `MakeBoard()`, `PlacePiece()`, `MakeCard()`.
- Give each `describe` block a one-line comment naming the `CLAUDE.md` rule it covers (e.g. `// Game play rule 6: moves can't land on friendly pieces`). The `it(...)` string serves as the comment for the test callback itself.
- Functional: each test builds its own fresh state via helpers. No shared mutable `let board` reassigned in `beforeEach` — shared state is how one test's mutation silently breaks another.

```js
import { describe, it, expect } from "vitest";
import { LegalTargets } from "./moves.js";

// builds a 5x5 board containing only the given pieces
function MakeBoard(pieces)
{
  return pieces.reduce(
    (board, p) => PlacePiece(board, p),
    Array.from({ length: 5 }, () => Array(5).fill(null)),
  );
}

// returns a copy of board with piece p placed at (p.x, p.y)
function PlacePiece(board, p)
{
  return board.map((row, y) => row.map((cell, x) => (x === p.x && y === p.y ? { owner: p.owner, kind: p.kind } : cell)));
}

// Game play rule 9: blue reads every card move with x and y negated
describe("blue move flipping", () =>
{
  it("negates both axes of a card move for blue", () =>
  {
    const card = { name: "test", suite: "red", moves: [{ x: 1, y: 2 }] };
    const board = MakeBoard([{ x: 2, y: 4, owner: "blue", kind: "sensei" }]);
    expect(LegalTargets(board, { x: 2, y: 4 }, card, "blue")).toEqual([{ x: 1, y: 2 }]);
  });
});
```

Adapt the board representation, function names and signatures to whatever the code actually uses — read it first rather than assuming the shape above.

## Writing rule tests

Coordinate conventions are the most common source of wrong tests, so pin them down before writing assertions:

- `(x, y)`, origin top-left, **+y points down**. Red starts on row `y = 0`, blue on row `y = 4`. Gates: red `(2,0)`, blue `(2,4)`.
- Card moves are written from **red's** perspective (red moving +y advances toward blue). Blue negates **both** x and y.
- If the code indexes `board[y][x]` vs `board[x][y]`, match it — and use an asymmetric position (e.g. `(1,3)`) in at least one test so a transposed index fails instead of passing by symmetry.

Guidelines:

- **Build minimal boards.** A test about capture needs two pieces, not the full starting setup. Sparse boards make the reason for the expected result obvious. Use the full setup only for setup tests.
- **Hand-craft cards** in tests (`MakeCard([{x:1,y:0}])`) instead of relying on a specific card from `cards.json`, so tests don't break if the deck data is tuned. Test `cards.json` itself separately: 16 cards, each has `name`, `suite` ∈ {red, blue}, non-empty `moves`, unique names.
- **Assert sets, not order** for move lists unless order is part of the contract (`expect(result).toHaveLength(n)` + `toContainEqual`, or sort both sides).
- **Test both colours** for anything directional. A bug that only hits blue is the most likely bug in this game.
- **Check edges and boundaries**: corners, a move landing exactly on row 0/4 vs one past it.
- **Immutability**: for state-transition functions, assert the input board is unchanged after the call (deep-equal it against a structured clone taken before).

## Writing component tests

Components display server state and emit intent; they don't own game logic. Test that contract:

- Start each file with `/** @vitest-environment jsdom */`.
- Use `render` and `screen` from `@testing-library/react`; query by role or text (`getByRole("button")`), not by CSS class or DOM structure, except where the class *is* the behavior (e.g. the `win` highlight on `Square`).
- Pass props directly and assert on callbacks with `vi.fn()` — e.g. clicking a square calls `onSquareClicked`, clicking a highlighted target calls the move callback with the right `(startingLocation, card, move)`.
- Never open a real socket. If a component imports `App.jsx` or `socket.io-client`, prefer extracting the component; if you must test `App`, `vi.mock("socket.io-client")` with a fake that records `emit` calls and lets the test trigger `on` handlers.
- Don't snapshot-test whole boards — snapshots of a 25-cell grid break on every markup change and nobody reads the diff.

## Rule checklist

`references/rule-checklist.md` lists the cases worth covering for each rule in `CLAUDE.md`. Read it when writing tests for a rule, and pick the cases relevant to the code under test — don't write the whole list at once unless asked.
