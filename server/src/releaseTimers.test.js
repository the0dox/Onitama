import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CreateReleaseTimers } from "./releaseTimers.js";

describe("CreateReleaseTimers", () =>
{
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("calls onExpire with the token once the delay elapses", () =>
  {
    const onExpire = vi.fn();
    const timers = CreateReleaseTimers(1000, onExpire);
    timers.Schedule("a");
    vi.advanceTimersByTime(999);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledExactlyOnceWith("a");
    expect(timers.IsPending("a")).toBe(false);
  });

  it("does not fire after Cancel (player reconnected in time)", () =>
  {
    const onExpire = vi.fn();
    const timers = CreateReleaseTimers(1000, onExpire);
    timers.Schedule("a");
    vi.advanceTimersByTime(500);
    expect(timers.Cancel("a")).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("Cancel without a pending timer is a no-op", () =>
  {
    const timers = CreateReleaseTimers(1000, vi.fn());
    expect(timers.Cancel("a")).toBe(false);
  });

  it("rescheduling replaces the pending timer instead of leaking it", () =>
  {
    const onExpire = vi.fn();
    const timers = CreateReleaseTimers(1000, onExpire);
    timers.Schedule("a");
    vi.advanceTimersByTime(800);
    timers.Schedule("a");
    vi.advanceTimersByTime(800);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onExpire).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(5000);
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it("keeps tokens independent", () =>
  {
    const onExpire = vi.fn();
    const timers = CreateReleaseTimers(1000, onExpire);
    timers.Schedule("a");
    timers.Schedule("b");
    timers.Cancel("a");
    vi.advanceTimersByTime(1000);
    expect(onExpire).toHaveBeenCalledExactlyOnceWith("b");
  });
});
