/** Jornada values the campus procedures accept (sige/02 §4.1). */
export type CampusJornada = "manana" | "tarde" | "completa";

/** A row of `campus.list` / the result of `campus.get` (sige/02 §3.3). */
export type CampusRow = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  jornada: CampusJornada;
  isMain: boolean;
  active: boolean;
  createdAt: Date | string;
  courseCount: number;
};

/** `institution.get` (sige/02 §3.2). */
export type InstitutionProfile = {
  name: string;
  logo: string | null;
  nit: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  municipality: string | null;
  department: string | null;
  resolution: string | null;
  currentAcademicYear: string;
  timezone: string;
};
