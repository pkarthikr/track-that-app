import type { DateString } from "@trackthat/shared";

export function todayLocal(now: Date = new Date()): DateString {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
