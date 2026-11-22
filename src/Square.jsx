// css class for a piece letter: lowercase/uppercase r is red, b is blue, anything else is empty
function PieceClass(piece)
{
  if (piece === "r" || piece === "R")
  {
    return "square piece-red";
  }
  if (piece === "b" || piece === "B")
  {
    return "square piece-blue";
  }
  return "square";
}

// one board square: displays the piece letter it is given, holds no state
export default function Square({ piece })
{
  return (
    <button className={PieceClass(piece)}>
      {piece}
    </button>
  );
}
