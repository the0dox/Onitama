import { useContext } from "react";
import { ButtonContext, PieceOwner } from "../shared/game/board.js";

// css classes for a square: piece colour plus an optional "target" or "selected" highlight
function SquareClass(piece, highlight)
{
  const owner = PieceOwner(piece);
  const classes = ["square", owner ? `piece-${owner}` : "", highlight ? `square--${highlight}` : ""];
  return classes.filter(Boolean).join(" ");
}

// one board square: displays the piece letter it is given, holds no state
export default function Square({ piece, highlight = null, point })
{
  const onPress = useContext(ButtonContext);
  return (
    <button className={SquareClass(piece, highlight)} onClick={() => onPress(point.x, point.y)}>
      {piece}
    </button>
  );
}
