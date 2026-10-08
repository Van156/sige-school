import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Demo institution structure (sige/00 §9 R4.2, sige/02): profile, 2 active + 1 inactive campus,
 * 5 levels, 6 courses, 10 subjects, 4 periods (P4 active) and criteria 20/20/30/30. Idempotent:
 * every row has a natural key (campus code, level name per campus, course name/year/shift, subject
 * code, period short name per year, criterion name) and existing rows are never rewritten.
 */

export const DEMO_ACADEMIC_YEAR = "2026";

export const DEMO_PROFILE = {
  nit: "900123456-7",
  address: "Carrera 15 # 45-20",
  phone: "6012345678",
  email: "contacto@colegiosanjose.edu.co",
  municipality: "Bogotá",
  department: "Cundinamarca",
  resolution: "Resolución 4567 de 2015",
} as const;

export const DEMO_CAMPUSES = [
  {
    code: "SP",
    name: "Sede Principal",
    address: "Carrera 15 # 45-20",
    jornada: "completa",
    isMain: true,
    active: true,
  },
  {
    code: "SN",
    name: "Sede Norte",
    address: "Calle 170 # 20-35",
    jornada: "tarde",
    isMain: false,
    active: true,
  },
  {
    code: "SR",
    name: "Sede Rural La Esperanza",
    address: "Vereda La Esperanza",
    jornada: "manana",
    isMain: false,
    active: false,
  },
] as const;

export const DEMO_LEVELS = [
  { campus: "SP", name: "Primaria", orderNum: 1 },
  { campus: "SP", name: "Básica Secundaria", orderNum: 2 },
  { campus: "SP", name: "Media Académica", orderNum: 3 },
  { campus: "SN", name: "Primaria", orderNum: 1 },
  { campus: "SN", name: "Básica Secundaria", orderNum: 2 },
] as const;

export const DEMO_COURSES = [
  { campus: "SP", level: "Primaria", name: "5-01", shift: "Mañana" },
  { campus: "SP", level: "Básica Secundaria", name: "6-01", shift: "Mañana" },
  { campus: "SP", level: "Básica Secundaria", name: "6-02", shift: "Mañana" },
  { campus: "SP", level: "Media Académica", name: "10-01", shift: "Mañana" },
  { campus: "SN", level: "Primaria", name: "3-01", shift: "Tarde" },
  { campus: "SN", level: "Básica Secundaria", name: "7-01", shift: "Tarde" },
] as const;

export const DEMO_SUBJECTS = [
  { code: "MAT", name: "Matemáticas" },
  { code: "ESP", name: "Lengua Castellana" },
  { code: "ING", name: "Inglés" },
  { code: "CNA", name: "Ciencias Naturales" },
  { code: "SOC", name: "Ciencias Sociales" },
  { code: "EDF", name: "Educación Física" },
  { code: "ART", name: "Educación Artística" },
  { code: "ETI", name: "Ética y Valores" },
  { code: "TEC", name: "Tecnología e Informática" },
  { code: "REL", name: "Educación Religiosa" },
] as const;

export const DEMO_PERIODS = [
  {
    orderNum: 1,
    name: "Primer periodo",
    shortName: "P1",
    startDate: "2026-01-19",
    endDate: "2026-03-27",
    isActive: false,
  },
  {
    orderNum: 2,
    name: "Segundo periodo",
    shortName: "P2",
    startDate: "2026-03-30",
    endDate: "2026-06-12",
    isActive: false,
  },
  {
    orderNum: 3,
    name: "Tercer periodo",
    shortName: "P3",
    startDate: "2026-06-15",
    endDate: "2026-09-11",
    isActive: false,
  },
  {
    orderNum: 4,
    name: "Cuarto periodo",
    shortName: "P4",
    startDate: "2026-09-14",
    endDate: "2026-11-27",
    isActive: true,
  },
] as const;

export const DEMO_CRITERIA = [
  {
    orderNum: 1,
    name: "Cognitivo",
    weight: "20.00",
    description: "Evaluaciones y pruebas escritas",
  },
  {
    orderNum: 2,
    name: "Procedimental",
    weight: "20.00",
    description: "Talleres y trabajo en clase",
  },
  { orderNum: 3, name: "Actitudinal", weight: "30.00", description: "Participación y convivencia" },
  {
    orderNum: 4,
    name: "Autoevaluación",
    weight: "30.00",
    description: "Autoevaluación y coevaluación",
  },
] as const;

export async function seedInstitutionStructure(
  database: Database,
  organizationId: string,
): Promise<void> {
  const year = DEMO_ACADEMIC_YEAR;

  await database.transaction(async (tx) => {
    await tx
      .insert(schema.institutionProfile)
      .values({ organizationId, ...DEMO_PROFILE, currentAcademicYear: year })
      .onConflictDoNothing();

    await tx
      .insert(schema.campus)
      .values(DEMO_CAMPUSES.map((c) => ({ organizationId, ...c })))
      .onConflictDoNothing();
    const campuses = await tx
      .select({ id: schema.campus.id, code: schema.campus.code })
      .from(schema.campus)
      .where(eq(schema.campus.organizationId, organizationId));
    const campusByCode = new Map(campuses.map((c) => [c.code, c.id]));
    const campusId = (code: string) => {
      const found = campusByCode.get(code);
      if (!found) throw new Error(`Demo campus ${code} is missing.`);
      return found;
    };

    await tx
      .insert(schema.gradeLevel)
      .values(
        DEMO_LEVELS.map((l) => ({
          organizationId,
          campusId: campusId(l.campus),
          name: l.name,
          orderNum: l.orderNum,
        })),
      )
      .onConflictDoNothing();
    const levels = await tx
      .select({
        id: schema.gradeLevel.id,
        campusId: schema.gradeLevel.campusId,
        name: schema.gradeLevel.name,
      })
      .from(schema.gradeLevel)
      .where(eq(schema.gradeLevel.organizationId, organizationId));
    const levelId = (campus: string, name: string) => {
      const found = levels.find((l) => l.campusId === campusId(campus) && l.name === name);
      if (!found) throw new Error(`Demo level ${name} (${campus}) is missing.`);
      return found.id;
    };

    await tx
      .insert(schema.course)
      .values(
        DEMO_COURSES.map((c) => ({
          organizationId,
          campusId: campusId(c.campus),
          levelId: levelId(c.campus, c.level),
          name: c.name,
          academicYear: year,
          shift: c.shift,
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(schema.subject)
      .values(DEMO_SUBJECTS.map((s) => ({ organizationId, ...s })))
      .onConflictDoNothing();

    // The partial unique index keeps one active period; skip the active flag if another exists.
    const [alreadyActive] = await tx
      .select({ id: schema.academicPeriod.id })
      .from(schema.academicPeriod)
      .where(
        and(
          eq(schema.academicPeriod.organizationId, organizationId),
          eq(schema.academicPeriod.isActive, true),
        ),
      )
      .limit(1);
    await tx
      .insert(schema.academicPeriod)
      .values(
        DEMO_PERIODS.map((p) => ({
          organizationId,
          academicYear: year,
          ...p,
          isActive: p.isActive && !alreadyActive,
        })),
      )
      .onConflictDoNothing();

    // Criteria have no natural unique key (foundation §5.5): insert only the missing names.
    const existing = await tx
      .select({ name: schema.gradeCriterion.name })
      .from(schema.gradeCriterion)
      .where(eq(schema.gradeCriterion.organizationId, organizationId));
    const have = new Set(existing.map((c) => c.name));
    const missing = DEMO_CRITERIA.filter((c) => !have.has(c.name));
    if (missing.length > 0) {
      await tx.insert(schema.gradeCriterion).values(missing.map((c) => ({ organizationId, ...c })));
    }
  });
}
