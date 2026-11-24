// Keeps the joined room in the page URL as ?room=<code>, so a refresh or a shared link rejoins it.

// query parameter holding the room code
export const ROOM_PARAM = "room";

// the room code in a location.search string ("?room=K7QX"), or null when there is none
export function ReadRoomFromUrl(search)
{
  const code = new URLSearchParams(search).get(ROOM_PARAM);
  return code ? code.toUpperCase() : null;
}

// href with its room parameter set to roomId, or removed when roomId is null; other parts are kept
export function RoomUrl(href, roomId)
{
  const url = new URL(href);
  if (roomId === null)
  {
    url.searchParams.delete(ROOM_PARAM);
  }
  else
  {
    url.searchParams.set(ROOM_PARAM, roomId);
  }
  return url.toString();
}
