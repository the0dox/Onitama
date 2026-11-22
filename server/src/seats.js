// Seat bookkeeping as pure functions. Seats are an array indexed by SEAT_COLORS
// holding the seated player's token or null; functions return new arrays, never mutate.

// seat index -> colour
export const SEAT_COLORS = Object.freeze(["red", "blue"]);
// no one seated
export const EMPTY_SEATS = Object.freeze([null, null]);

// the colour this token is seated as, or null for a spectator
export function SeatOf(seats, token)
{
  const index = seats.indexOf(token);
  return index === -1 ? null : SEAT_COLORS[index];
}

// seats token as color; returns { ok: true, seats } or { ok: false, reason }
// with reason "bad-color", "already-seated" or "taken" (checked in that order)
export function ClaimSeat(seats, color, token)
{
  const index = SEAT_COLORS.indexOf(color);
  if (index === -1)
  {
    return { ok: false, reason: "bad-color" };
  }
  if (SeatOf(seats, token) !== null)
  {
    return { ok: false, reason: "already-seated" };
  }
  if (seats[index] !== null)
  {
    return { ok: false, reason: "taken" };
  }
  return { ok: true, seats: seats.map((held, i) => (i === index ? token : held)) };
}

// frees whichever seat token holds; unchanged copy if it holds none
export function ReleaseSeat(seats, token)
{
  return seats.map((held) => (held === token ? null : held));
}

// what one client may see: which seats are taken and its own colour, never any token
export function SeatsView(seats, token)
{
  return {
    red: seats[0] !== null,
    blue: seats[1] !== null,
    mine: SeatOf(seats, token),
  };
}
