// colours a spectator can pick, in display order
const COLORS = ["red", "blue"];

// lets a spectator pick a free side, or a seated player leave their seat;
// renders nothing before the server sent seats
// seats: { red: taken, blue: taken, mine: colour | null }
export default function SeatPicker({ seats, onPick, onLeave })
{
  if (!seats)
  {
    return null;
  }
  if (seats.mine)
  {
    return (
      <div className="seat-picker">
        <span className={`seat-button-${seats.mine}`}>{`Playing ${seats.mine}`}</span>
        <button className="seat-button" onClick={onLeave}>Return To Spectating</button>
      </div>
    );
  }
  return (
    <div className="seat-picker">
      <span>Spectating</span>
      {COLORS.map((color) => (
        <button
          key={color}
          className={`seat-button seat-button-${color}`}
          disabled={seats[color]}
          onClick={() => onPick(color)}
        >
          {`Play ${color}`}
        </button>
      ))}
    </div>
  );
}
