export const PASSWORD_MIN_LENGTH = 8;
export const CODE_LENGTH = 6;

export function isPlausibleEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}
