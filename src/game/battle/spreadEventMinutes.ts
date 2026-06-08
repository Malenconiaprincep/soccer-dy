interface TimedEvent {
  minute?: number;
}

export function spreadEventMinutes<T extends TimedEvent>(events: T[], startMinute = 1, endMinute = 90): T[] {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  if (sorted.length === 1) {
    return [{ ...sorted[0], minute: Math.min(90, Math.max(85, endMinute - 1)) }];
  }

  const count = sorted.length;
  const minGap = 2;
  const maxGap = 13;
  const targetEnd = endMinute - Math.floor(Math.random() * 4);
  const available = Math.max(minGap * (count - 1), targetEnd - startMinute);

  const weights = Array.from({ length: count - 1 }, () => minGap + Math.random() * (maxGap - minGap));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const scale = available / Math.max(1, weightSum);

  const minutes = [startMinute];
  for (let index = 0; index < count - 1; index += 1) {
    const slotsLeft = count - 1 - index;
    const minRequired = minutes[minutes.length - 1] + minGap;
    const maxAllowed = targetEnd - slotsLeft * minGap;
    const gap = Math.max(minGap, Math.round(weights[index] * scale));
    minutes.push(Math.max(minRequired, Math.min(maxAllowed, minutes[minutes.length - 1] + gap)));
  }

  minutes[minutes.length - 1] = Math.min(90, Math.max(85, targetEnd));
  for (let index = 1; index < minutes.length; index += 1) {
    minutes[index] = Math.max(minutes[index], minutes[index - 1] + minGap);
  }
  minutes[minutes.length - 1] = Math.min(90, Math.max(minutes[minutes.length - 1], 85));

  return sorted.map((event, index) => ({
    ...event,
    minute: minutes[index]
  }));
}
