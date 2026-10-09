/** A row of `user.list` (sige/03 §3.3, `UserRow`). */
export type UserRow = {
  personId: string;
  userId: string;
  username: string;
  /** `null` for placeholder addresses (the user has no real email, OD-1). */
  email: string | null;
  firstName: string;
  lastName: string;
  name: string;
  /** First role name of the member: a built-in SIGE kind or a custom role name. */
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** The row is the caller's own person. */
  isSelf: boolean;
};

/** `user.stats`: the KPI tiles of USR-01. */
export type UserStats = {
  total: number;
  teachers: number;
  students: number;
  active: number;
};

/** A `user.list` row as the data table keys it (`id` is the person id). */
export type UserTableRow = UserRow & { id: string };
