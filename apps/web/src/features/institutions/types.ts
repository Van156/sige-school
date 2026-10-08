/** A row of `institutionAdmin.list` (sige/02 §3.1, INS-01). */
export type InstitutionRow = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  email: string | null;
  nit: string | null;
  municipality: string | null;
  department: string | null;
  academicYear: string;
  createdAt: Date | string;
  counts: { campuses: number; students: number; admins: number };
  /** The oldest `owner` member; `null` when the institution has none. */
  rector: { userId: string; name: string; username: string | null } | null;
};

/** `institutionAdmin.get` / `update`: the row plus the contact fields only the detail needs. */
export type InstitutionDetail = InstitutionRow & {
  phone: string | null;
  address: string | null;
  resolution: string | null;
};

/** `institutionAdmin.stats`: the KPI tiles of INS-01. */
export type InstitutionStats = {
  institutions: number;
  campuses: number;
  students: number;
  admins: number;
};

/** The part of `institutionAdmin.create`'s result the confirmation shows. */
export type CreatedInstitution = {
  institution: { id: string; name: string; slug: string };
  rector: { username: string };
};
