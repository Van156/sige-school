export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type PasswordStrength = { level: PasswordStrengthLevel; label: string };

const LABELS: Record<PasswordStrengthLevel, string> = {
  0: "Ingrese una contraseña",
  1: "Muy débil",
  2: "Débil",
  3: "Regular",
  4: "Fuerte",
  5: "Muy fuerte",
};

/** sige/01 §4.2 five checks: length >= 8, length >= 12, uppercase, digit, symbol. */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length === 0) {
    return { level: 0, label: LABELS[0] };
  }
  const checks = [
    password.length >= 8,
    password.length >= 12,
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const level = Math.max(1, checks.filter(Boolean).length) as PasswordStrengthLevel;
  return { level, label: LABELS[level] };
}
