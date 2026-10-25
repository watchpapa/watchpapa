export function computeStreaks(dates, today) {
  if (dates.length === 0) {
    return { current: 0, longest: 0, lastWatchedOn: null };
  }
  return { current: 1, longest: 1, lastWatchedOn: dates[0] };
}
