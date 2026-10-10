import type { DocumentType } from "@base-template/sige-core";

import type { ImportPreviewRowBase } from "@/features/imports";

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

/** A previewed row of `user.importPreview` (sige/03 §3.3). */
export type UserImportPreviewRow = ImportPreviewRowBase & {
  nombres: string;
  apellidos: string;
  documento: string;
  rol: string;
};
