import { useState } from "react";
import { ROOM_NAME_MAX } from "../shared/rooms.js";

// text for one room's seats, e.g. "red taken, blue free"
function SeatText(room)
{
  const side = (color) => `${color} ${room[color] ? "taken" : "free"}`;
  return `${side("red")}, ${side("blue")}`;
}

// the room list and a form to create a named room; a full room can still be joined as a spectator
// rooms: [{ id, name, red, blue, members, status }] as sent by the server
export default function Lobby({ rooms, onJoin, onCreate })
{
  const [name, setName] = useState("");
  const trimmed = name.trim();

  // creates the room on submit, then clears the input
  function OnSubmit(event)
  {
    event.preventDefault();
    if (trimmed.length === 0)
    {
      return;
    }
    onCreate(trimmed);
    setName("");
  }

  return (
    <div className="lobby">
      <form className="lobby-create" onSubmit={OnSubmit}>
        <input
          aria-label="Room name"
          placeholder="Room name"
          maxLength={ROOM_NAME_MAX}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" disabled={trimmed.length === 0}>Create room</button>
      </form>
      {rooms.length === 0
        ? <p>No rooms yet</p>
        : (
          <ul className="lobby-rooms">
            {rooms.map((room) => (
              <li key={room.id} className="lobby-room">
                <span className="lobby-room-name">{room.name}</span>
                <span>{`${SeatText(room)} · ${room.members} here · ${room.status}`}</span>
                <button onClick={() => onJoin(room.id)}>Join</button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
