// Pending seat releases, one timer per player token. Scheduling a token that already has a
// pending timer replaces it, so a stale timer can never fire later and release a seat twice.

// creates the timer store; onExpire(token) runs when a token's timer elapses without Cancel
export function CreateReleaseTimers(delayMs, onExpire)
{
  const timers = new Map(); // token -> timeout handle

  // stops token's pending timer, if any; returns whether one was pending
  function Cancel(token)
  {
    const pending = timers.has(token);
    clearTimeout(timers.get(token));
    timers.delete(token);
    return pending;
  }

  // (re)starts token's timer, replacing any pending one
  function Schedule(token)
  {
    Cancel(token);
    timers.set(token, setTimeout(() =>
    {
      timers.delete(token);
      onExpire(token);
    }, delayMs));
  }

  // whether token has a timer that has not fired or been cancelled
  function IsPending(token)
  {
    return timers.has(token);
  }

  return Object.freeze({ Schedule, Cancel, IsPending });
}
