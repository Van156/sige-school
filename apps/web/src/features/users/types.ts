import type { DocumentType } from "@base-template/sige-core";

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

/** `user.get` (sige/03 §3.3, `UserDetail`): a row plus the editable profile. */
export type UserDetail = UserRow & {
  documentType: DocumentType;
  documentNumber: string;
  birthDate: string | null;
  gender: "M" | "F" | "Otro" | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  department: string | null;
  municipality: string | null;
  hasRealEmail: boolean;
  /** Academic profile id; `null` until module 05 (D4). */
  studentId: string | null;
};

/** One entry of `importPreview.errors` and `importJob.get.errors`; `row` 0 is a job-level error. */
export type ImportRowError = { row: number; message: string };

/** A previewed row of `user.importPreview` (sige/03 §3.3). */
export type ImportPreviewRow = {
  row: number;
  nombres: string;
  apellidos: string;
  documento: string;
  rol: string;
  valid: boolean;
  /** The row's error message, or `null` when valid. */
  message: string | null;
};

/** `user.importPreview`: the dry run of an upload (first 50 rows, first 200 errors). */
export type ImportPreview = {
  total: number;
  valid: number;
  invalid: number;
  rows: ImportPreviewRow[];
  errors: ImportRowError[];
};

export type ImportJobStatus = "running" | "done" | "failed";

/** `importJob.get`: the progress of a started import. */
export type ImportJob = {
  status: ImportJobStatus;
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  errors: ImportRowError[];
};
