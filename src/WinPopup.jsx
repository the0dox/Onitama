// overlay shown over the game window once the server reports a winner; seated players also get a Rematch button.
// It has no open/closed state of its own: it disappears when the next gameState arrives with winner = null
export default function WinPopup({ winner, canRematch, onRematch })
{
  if (winner === null)
  {
    return null;
  }
  return (
    <div className="win-overlay">
      <div className="win-popup" role="dialog" aria-label="Game over">
        <div className={`win-popup-title piece-${winner}`}>{`${winner} wins`}</div>
        {canRematch && (
          <button className="rematch" onClick={onRematch}>
            Rematch
          </button>
        )}
      </div>
    </div>
  );
}
