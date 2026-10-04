export interface PasswordStrength {
  /** 0 (empty) to 5. */
  level: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
}

const LABELS: Record<PasswordStrength["level"], string> = {
  0: "Ingrese una contraseña",
  1: "Muy débil",
  2: "Débil",
  3: "Regular",
  4: "Fuerte",
  5: "Muy fuerte",
};

/** Five checks: length >= 6, >= 8, uppercase, digit, symbol (inventory AUTH-03). */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length === 0) return { level: 0, label: LABELS[0] };
  const checks = [
    password.length >= 6,
    password.length >= 8,
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const level = Math.max(1, checks.filter(Boolean).length) as PasswordStrength["level"];
  return { level, label: LABELS[level] };
}
