const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

const HABIT_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** True for a well-formed habit id (a 26-character ULID). */
export function isHabitId(value: unknown): value is string {
  return typeof value === "string" && HABIT_ID_PATTERN.test(value);
}

/** A ULID: 10 characters of millisecond time then 16 random, so later ids sort later. */
export function newHabitId(now: Date, random: () => number = Math.random): string {
  let time = now.getTime();
  let timePart = "";
  for (let i = 0; i < TIME_LENGTH; i++) {
    timePart = ALPHABET.charAt(time % 32) + timePart;
    time = Math.floor(time / 32);
  }
  let randomPart = "";
  for (let i = 0; i < RANDOM_LENGTH; i++) {
    randomPart += ALPHABET.charAt(Math.floor(random() * 32));
  }
  return timePart + randomPart;
}
