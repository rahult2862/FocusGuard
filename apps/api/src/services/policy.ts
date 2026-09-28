import type { Schedule } from "@prisma/client";

function localParts(date: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const parts = Object.fromEntries(values.map((part) => [part.type, part.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday ?? "");
  return { weekday, minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function isScheduleActive(schedule: Pick<Schedule, "startTime" | "endTime" | "daysOfWeek" | "enabled">, timeZone: string, now = new Date()) {
  if (!schedule.enabled || schedule.daysOfWeek.length === 0) return false;
  let current: ReturnType<typeof localParts>;
  try {
    current = localParts(now, timeZone);
  } catch {
    current = localParts(now, "UTC");
  }
  const [startHour = 0, startMinute = 0] = schedule.startTime.split(":").map(Number);
  const [endHour = 0, endMinute = 0] = schedule.endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  if (start === end) return false;

  if (start < end) {
    return schedule.daysOfWeek.includes(current.weekday) && current.minuteOfDay >= start && current.minuteOfDay < end;
  }
  if (current.minuteOfDay >= start) return schedule.daysOfWeek.includes(current.weekday);
  if (current.minuteOfDay < end) {
    const previousDay = (current.weekday + 6) % 7;
    return schedule.daysOfWeek.includes(previousDay);
  }
  return false;
}
