// the board is BOARD_SIZE x BOARD_SIZE, indexed board[x][y] with (0,0) top-left and +y pointing down
export const BOARD_SIZE = 5;

// single-character piece codes stored on the board; empty squares hold null
export const PIECES = Object.freeze({
  redDisciple: "r",
  redSensei: "R",
  blueDisciple: "b",
  blueSensei: "B",
});

// each side's gate: the sensei's starting square, and the square the enemy sensei must reach to win
export const GATES = Object.freeze({
  red: Object.freeze({ x: 2, y: 0 }),
  blue: Object.freeze({ x: 2, y: 4 }),
});

// the piece that starts on (x, y): red fills row 0, blue fills row 4, senseis sit on their gate
export function StartingPiece(x, y)
{
  if (y === GATES.red.y)
  {
    return x === GATES.red.x ? PIECES.redSensei : PIECES.redDisciple;
  }
  if (y === GATES.blue.y)
  {
    return x === GATES.blue.x ? PIECES.blueSensei : PIECES.blueDisciple;
  }
  return null;
}

// builds a fresh starting board; every column is its own array so later updates can't alias
export function CreateBoard()
{
  return Array.from({ length: BOARD_SIZE }, (_, x) =>
    Array.from({ length: BOARD_SIZE }, (_, y) => StartingPiece(x, y)));
}
