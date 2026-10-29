const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));

  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function formatISODate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`无法在时区 ${timeZone} 格式化日期`);
  }

  return `${year}-${month}-${day}`;
}

export function isUnlockReached(unlockAt: string | undefined, today: string): boolean {
  if (!unlockAt) {
    return true;
  }

  if (!isISODate(unlockAt) || !isISODate(today)) {
    return false;
  }

  return unlockAt <= today;
}
