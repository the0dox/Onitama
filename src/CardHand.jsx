import { MovesForPlayer } from "../shared/game/deck.js";

const GRID_SIZE = 5;
const CENTER = 2;
const CELLS = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => ({ col: i % GRID_SIZE, row: Math.floor(i / GRID_SIZE) }));

// true if one of the moves lands on (col, row) of a 5x5 grid centred on the piece
export function IsTarget(moves, col, row)
{
  return moves.some((move) => CENTER + move.x === col && CENTER + move.y === row);
}

// returns the css class for one grid cell: origin, target, or plain
function CellClass(moves, col, row)
{
  if (col === CENTER && row === CENTER)
  {
    return "card-cell card-cell--origin";
  }
  return IsTarget(moves, col, row) ? "card-cell card-cell--target" : "card-cell";
}

// css classes for a card: suit border, plus selected / clickable states
function CardClass(card, selected, clickable)
{
  const extras = [selected ? "card--selected" : "", clickable ? "card--clickable" : ""].filter(Boolean);
  return [`card card-${card.suit}`, ...extras].join(" ");
}

// one card: name, suit colour and a 5x5 move grid drawn from `player`'s perspective (+y down)
// onClick is optional; without it the card is display-only
export function CardView({ card, player, selected = false, onClick })
{
  const moves = MovesForPlayer(card, player);
  return (
    <div
      className={CardClass(card, selected, Boolean(onClick))}
      data-testid={`card-${card.name}`}
      onClick={onClick ? () => onClick(card.name) : undefined}
    >
      <div className="card-name">{card.name}</div>
      <div className="card-grid">
        {CELLS.map(({ col, row }) => (
          <div key={`${col}-${row}`} className={CellClass(moves, col, row)} />
        ))}
      </div>
    </div>
  );
}

// a player's hand: header plus their cards; outlined when it is that player's turn
// selectedCard / onCardClick are only passed for the viewing player's own hand
export function CardHand({ player, cardNames, byName, active, selectedCard = null, onCardClick })
{
  const className = active ? `card-hand card-hand-${player} card-hand--active` : `card-hand card-hand-${player}`;
  return (
    <div className={className} data-testid={`hand-${player}`}>
      <div className="card-hand-title">{player === "red" ? "Red" : "Blue"}</div>
      <div className="card-hand-cards">
        {cardNames.map((name) => (
          <CardView
            key={name}
            card={byName.get(name)}
            player={player}
            selected={name === selectedCard}
            onClick={onCardClick}
          />
        ))}
      </div>
    </div>
  );
}
