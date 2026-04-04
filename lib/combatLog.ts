export type CombatLogLine = { id: string; text: string };

let logSerial = 0;

function nextLogId(): string {
  logSerial += 1;
  return `clog-${logSerial}`;
}

export function initialCombatLogLines(texts: string[]): CombatLogLine[] {
  return texts.map((text) => ({ id: nextLogId(), text }));
}

export function appendCombatLogLines(
  prev: CombatLogLine[],
  texts: string[],
): CombatLogLine[] {
  if (texts.length === 0) return prev;
  return [...prev, ...texts.map((text) => ({ id: nextLogId(), text }))];
}
