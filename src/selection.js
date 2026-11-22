// the player's in-progress choice: a board square holding their piece and a card name, either may be null
export const EMPTY_SELECTION = Object.freeze({ piece: null, card: null });

// true if two squares are the same position (null-safe)
function SamePosition(a, b)
{
  return a !== null && b !== null && a.x === b.x && a.y === b.y;
}

// selects a card, or clears it if it was already selected; the piece selection is untouched
export function ToggleCard(selection, cardName)
{
  return { ...selection, card: selection.card === cardName ? null : cardName };
}

// selects the piece at position, or clears it if it was already selected; the card selection is untouched
export function TogglePiece(selection, position)
{
  return { ...selection, piece: SamePosition(selection.piece, position) ? null : { x: position.x, y: position.y } };
}
