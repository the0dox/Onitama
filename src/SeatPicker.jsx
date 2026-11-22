// colours a spectator can pick, in display order
const COLORS = ["red", "blue"];

// lets a spectator pick a free side; renders nothing once seated or before the server sent seats
// seats: { red: taken, blue: taken, mine: colour | null }
export default function SeatPicker({ seats, onPick })
{
  if (!seats || seats.mine)
  {
    return null;
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
