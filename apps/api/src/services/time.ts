export function localDateKey(date: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function localDayStart(dateKey: string, timeZone: string) {
  const [year = 1970, month = 1, day = 1] = dateKey.split("-").map(Number);
  const desiredLocal = Date.UTC(year, month - 1, day);
  let guess = desiredLocal;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const representedLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess += desiredLocal - representedLocal;
  }
  return new Date(guess);
}
