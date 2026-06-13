import type {
  CronScheduleConfig,
  DailyScheduleConfig,
  IntervalScheduleConfig,
  TriggerScheduleConfig,
  TriggerScheduleType,
  WeeklyScheduleConfig,
} from "@/src/core/triggers/types";

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function padTime(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${padTime(minute)} ${period}`;
}

export function describeSchedule(
  scheduleType: TriggerScheduleType,
  scheduleConfig: TriggerScheduleConfig,
  timezone: string,
): string {
  switch (scheduleType) {
    case "interval": {
      const config = scheduleConfig as IntervalScheduleConfig;
      if (config.minutes === 1) {
        return "Every minute";
      }
      if (config.minutes < 60) {
        return `Every ${config.minutes} minutes`;
      }
      if (config.minutes % 60 === 0) {
        const hours = config.minutes / 60;
        return hours === 1 ? "Every hour" : `Every ${hours} hours`;
      }
      return `Every ${config.minutes} minutes`;
    }
    case "daily": {
      const config = scheduleConfig as DailyScheduleConfig;
      return `Daily at ${formatTime(config.hour, config.minute)} (${timezone})`;
    }
    case "weekly": {
      const config = scheduleConfig as WeeklyScheduleConfig;
      const day = WEEKDAY_LABELS[config.dayOfWeek] ?? "Unknown day";
      return `Every ${day} at ${formatTime(config.hour, config.minute)} (${timezone})`;
    }
    case "cron": {
      const config = scheduleConfig as CronScheduleConfig;
      return `Cron: ${config.expression} (${timezone})`;
    }
    default:
      return "Custom schedule";
  }
}

function getZonedParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((entry) => entry.type === type);
    return part ? Number.parseInt(part.value, 10) : 0;
  };
  const weekdayLabel = parts.find((entry) => entry.type === "weekday")?.value ?? "Sun";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
    hour: lookup("hour") % 24,
    minute: lookup("minute"),
    second: lookup("second"),
    weekday: weekdayMap[weekdayLabel] ?? 0,
  };
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = getZonedParts(guess, timezone);
    const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    const actualUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    const offsetMs = actualUtc - desiredUtc;
    guess = new Date(guess.getTime() - offsetMs);
  }
  return guess;
}

function computeNextIntervalRun(from: Date, config: IntervalScheduleConfig): Date {
  const intervalMs = config.minutes * 60 * 1000;
  return new Date(from.getTime() + intervalMs);
}

function computeNextDailyRun(from: Date, config: DailyScheduleConfig, timezone: string): Date {
  const parts = getZonedParts(from, timezone);
  let candidate = zonedTimeToUtc(parts.year, parts.month, parts.day, config.hour, config.minute, timezone);
  if (candidate.getTime() <= from.getTime()) {
    candidate = zonedTimeToUtc(parts.year, parts.month, parts.day + 1, config.hour, config.minute, timezone);
  }
  return candidate;
}

function computeNextWeeklyRun(from: Date, config: WeeklyScheduleConfig, timezone: string): Date {
  const parts = getZonedParts(from, timezone);
  let daysUntil = (config.dayOfWeek - parts.weekday + 7) % 7;
  let candidateDay = parts.day + daysUntil;
  let candidate = zonedTimeToUtc(parts.year, parts.month, candidateDay, config.hour, config.minute, timezone);
  if (candidate.getTime() <= from.getTime()) {
    candidateDay += 7;
    candidate = zonedTimeToUtc(parts.year, parts.month, candidateDay, config.hour, config.minute, timezone);
  }
  return candidate;
}

function parseCronField(field: string, min: number, max: number): readonly number[] {
  if (field === "*") {
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
  }
  if (field.startsWith("*/")) {
    const step = Number.parseInt(field.slice(2), 10);
    if (Number.isNaN(step) || step <= 0) {
      return [min];
    }
    const values: number[] = [];
    for (let value = min; value <= max; value += step) {
      values.push(value);
    }
    return values;
  }
  if (field.includes(",")) {
    return field.split(",").flatMap((part) => parseCronField(part.trim(), min, max));
  }
  if (field.includes("-")) {
    const [startRaw, endRaw] = field.split("-");
    const start = Number.parseInt(startRaw, 10);
    const end = Number.parseInt(endRaw, 10);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return [min];
    }
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
  const value = Number.parseInt(field, 10);
  return Number.isNaN(value) ? [min] : [value];
}

function computeNextCronRun(from: Date, config: CronScheduleConfig, timezone: string): Date {
  const segments = config.expression.trim().split(/\s+/);
  if (segments.length !== 5) {
    return computeNextIntervalRun(from, { minutes: 60 });
  }
  const [minuteField, hourField, dayField, monthField, weekdayField] = segments;
  const minutes = parseCronField(minuteField, 0, 59);
  const hours = parseCronField(hourField, 0, 23);
  const days = parseCronField(dayField, 1, 31);
  const months = parseCronField(monthField, 1, 12);
  const weekdays = parseCronField(weekdayField, 0, 6);
  const cursor = new Date(from.getTime() + 60_000);
  cursor.setSeconds(0, 0);
  for (let attempt = 0; attempt < 525_600; attempt += 1) {
    const parts = getZonedParts(cursor, timezone);
    const weekdayMatches = weekdayField === "*" || weekdays.includes(parts.weekday);
    const dayMatches = dayField === "*" || days.includes(parts.day);
    const monthMatches = months.includes(parts.month);
    const hourMatches = hours.includes(parts.hour);
    const minuteMatches = minutes.includes(parts.minute);
    if (weekdayMatches && dayMatches && monthMatches && hourMatches && minuteMatches) {
      if (cursor.getTime() > from.getTime()) {
        return cursor;
      }
    }
    cursor.setTime(cursor.getTime() + 60_000);
  }
  return computeNextIntervalRun(from, { minutes: 60 });
}

export function computeNextRunAt(
  scheduleType: TriggerScheduleType,
  scheduleConfig: TriggerScheduleConfig,
  timezone: string,
  from: Date = new Date(),
): Date {
  switch (scheduleType) {
    case "interval":
      return computeNextIntervalRun(from, scheduleConfig as IntervalScheduleConfig);
    case "daily":
      return computeNextDailyRun(from, scheduleConfig as DailyScheduleConfig, timezone);
    case "weekly":
      return computeNextWeeklyRun(from, scheduleConfig as WeeklyScheduleConfig, timezone);
    case "cron":
      return computeNextCronRun(from, scheduleConfig as CronScheduleConfig, timezone);
    default:
      return computeNextIntervalRun(from, { minutes: 60 });
  }
}

export function validateScheduleConfig(
  scheduleType: TriggerScheduleType,
  scheduleConfig: TriggerScheduleConfig,
): string | null {
  switch (scheduleType) {
    case "interval": {
      const config = scheduleConfig as IntervalScheduleConfig;
      if (!Number.isInteger(config.minutes) || config.minutes < 1 || config.minutes > 10_080) {
        return "Interval must be between 1 and 10,080 minutes (1 week).";
      }
      return null;
    }
    case "daily": {
      const config = scheduleConfig as DailyScheduleConfig;
      if (config.hour < 0 || config.hour > 23 || config.minute < 0 || config.minute > 59) {
        return "Daily schedule requires a valid hour (0–23) and minute (0–59).";
      }
      return null;
    }
    case "weekly": {
      const config = scheduleConfig as WeeklyScheduleConfig;
      if (config.dayOfWeek < 0 || config.dayOfWeek > 6) {
        return "Weekly schedule requires a valid day of week (0–6).";
      }
      if (config.hour < 0 || config.hour > 23 || config.minute < 0 || config.minute > 59) {
        return "Weekly schedule requires a valid hour (0–23) and minute (0–59).";
      }
      return null;
    }
    case "cron": {
      const config = scheduleConfig as CronScheduleConfig;
      const segments = config.expression.trim().split(/\s+/);
      if (segments.length !== 5) {
        return "Cron expression must have 5 fields: minute hour day month weekday.";
      }
      return null;
    }
    default:
      return "Unknown schedule type.";
  }
}

export function formatRelativeTime(value: string | null): string {
  if (!value) {
    return "Never";
  }
  const date = new Date(value);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const isFuture = diffMs > 0;
  const absMs = Math.abs(diffMs);
  const minutes = Math.floor(absMs / (1000 * 60));
  if (minutes < 1) {
    return isFuture ? "in less than a minute" : "just now";
  }
  if (minutes < 60) {
    return isFuture ? `in ${minutes}m` : `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return isFuture ? `in ${hours}h` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return isFuture ? `in ${days}d` : `${days}d ago`;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
