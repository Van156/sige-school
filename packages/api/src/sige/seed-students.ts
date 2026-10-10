import { provisionUser } from "@base-template/auth/provision-user";
import type { ProvisionDeps, ProvisionInput } from "@base-template/auth/provision-user";
import * as schema from "@base-template/db/schema";
import type { GuardianRelationship, StudentStatus } from "@base-template/sige-core";
import { and, asc, eq, inArray } from "drizzle-orm";

import { enrollInCourse, lockEnrollmentCourse } from "./enrollment-service";
import { DEMO_ACADEMIC_YEAR } from "./seed-structure";

/**
 * SIGE P4 demo students (sige/00 §9 R4.2, inventory §5.7, D4): 40 active students plus one
 * `retirado` and one `graduado`, 26 guardians and the bulk enrollment of every active student in
 * the offerings of their course (SCH-R5). Ported from the prototype (`-mock/people.ts`):
 *
 * - Prototype groups map onto the six demo courses: 1-01 → 3-01, 11-01 → 10-01, the rest by name;
 *   the graduado stays in 10-01 and the retirado in 6-02.
 * - The P0 demo student Julián López (`DEMO_PEOPLE`) takes the prototype slot of Emmanuel Cortés
 *   Bernal (6-01), so the group sizes stay those of the prototype and his login is reused.
 * - Guardians follow the prototype naming (mother/father by the student's prototype index,
 *   student surnames, shared guardian for three sibling pairs, a second guardian for eight
 *   students) but only for the 26 guardians of R4.2: the storyline students, the siblings and one
 *   more student per course. The P0 demo parent Patricia Gómez is Isabella Gómez Herrera's mother.
 * - Birth dates are derived from the index (the prototype draws them from its PRNG); the health
 *   and neighbourhood fields use the prototype formulas.
 *
 * Idempotent: people are found by document number, profiles by person (unique), links by
 * (guardian, student) and enrollments by (student, offering, year); existing rows are never
 * rewritten and a student is only enrolled in the course it currently has.
 */

type DemoGender = "M" | "F";

export type DemoStudent = {
  firstName: string;
  lastName: string;
  documentType: "TI" | "RC" | "CC";
  documentNumber: string;
  gender: DemoGender;
  birthDate: string;
  /** Demo course name (`DEMO_COURSES`). */
  course: string;
  status: StudentStatus;
  neighborhood: string;
  stratum: number;
  bloodType: string;
  eps: string;
};

export type DemoGuardian = {
  firstName: string;
  lastName: string;
  documentNumber: string;
  gender: DemoGender;
  /** Absent for the P0 demo parent, whose person already exists. */
  phone?: string;
  /** Student document numbers with the relationship of this guardian. */
  children: readonly { student: string; relationship: GuardianRelationship }[];
};

type StudentSeed = {
  firstName: string;
  lastName: string;
  /** Prototype group (`-mock/people.ts`). */
  group: string;
  gender: DemoGender;
  status?: StudentStatus;
  documentType?: "CC";
  documentNumber?: string;
};

const seed = (
  firstName: string,
  lastName: string,
  group: string,
  gender: DemoGender,
  extra: Partial<StudentSeed> = {},
): StudentSeed => ({ firstName, lastName, group, gender, ...extra });

/** The prototype's `STUDENT_SEEDS`, in its order (the index drives the derived fields). */
const STUDENT_SEEDS: readonly StudentSeed[] = [
  // 6-01 (8)
  seed("Mariana", "López Sánchez", "6-01", "F"),
  seed("Juan David", "Pérez Ortiz", "6-01", "M"),
  seed("Daniela", "Moreno Cardona", "6-01", "F"),
  seed("Sebastián", "Vargas León", "6-01", "M"),
  seed("Laura Sofía", "Mejía Arango", "6-01", "F"),
  seed("Nicolás", "Acosta Peña", "6-01", "M"),
  seed("Valeria", "Jiménez Ríos", "6-01", "F"),
  // D4: the P0 demo student replaces the prototype's Emmanuel Cortés Bernal.
  seed("Julián", "López", "6-01", "M", { documentNumber: "1000000005" }),
  // 6-02 (7)
  seed("Samuel", "Torres Quintero", "6-02", "M"),
  seed("Gabriela", "Herrera Molina", "6-02", "F"),
  seed("Alejandro", "Ramos Giraldo", "6-02", "M"),
  seed("Sara Valentina", "Ospina Cruz", "6-02", "F"),
  seed("Miguel Ángel", "Rincón Salas", "6-02", "M"),
  seed("Luciana", "Zapata Marín", "6-02", "F"),
  seed("Thiago", "Bermúdez Orozco", "6-02", "M"),
  // 7-01 (7)
  seed("Santiago", "Duarte Mejía", "7-01", "M"),
  seed("Camila Fernanda", "Ruiz Mora", "7-01", "F"),
  seed("Juliana", "Patiño Restrepo", "7-01", "F"),
  seed("Andrés Felipe", "Gaviria Soto", "7-01", "M"),
  seed("Isabela", "Naranjo Cardona", "7-01", "F"),
  seed("Daniel", "Escobar Londoño", "7-01", "M"),
  seed("Mariángel", "Beltrán Aguirre", "7-01", "F"),
  // 11-01 (7)
  seed("Valentina", "Rojas Pineda", "11-01", "F"),
  seed("Mateo", "Ramírez Cruz", "11-01", "M"),
  seed("Carlos Eduardo", "Medina Suárez", "11-01", "M"),
  seed("Natalia Andrea", "Cano Vélez", "11-01", "F"),
  seed("Julián David", "Arias Parra", "11-01", "M"),
  seed("Paula Andrea", "Guerrero Díaz", "11-01", "F"),
  seed("Kevin Stiven", "Ortega Lozano", "11-01", "M", { documentType: "CC" }),
  // 1-01 (6)
  seed("Sofía", "Castro Vega", "1-01", "F"),
  seed("Tomás", "Ruiz Mora", "1-01", "M"),
  seed("Emma Lucía", "Salgado Rey", "1-01", "F"),
  seed("Joaquín", "Montoya Gil", "1-01", "M"),
  seed("Antonella", "Cuesta Bravo", "1-01", "F"),
  seed("Dylan Mauricio", "Herrera Molina", "1-01", "M"),
  // 5-01 (5)
  seed("Isabella", "Gómez Herrera", "5-01", "F"),
  seed("Martín", "Ávila Correa", "5-01", "M"),
  seed("Salomé", "Acosta Peña", "5-01", "F"),
  seed("Emilio", "Santamaría Pardo", "5-01", "M"),
  seed("Mía Alejandra", "Bustos Cano", "5-01", "F"),
  // Extra records for the status filters
  seed("Esteban", "Vélez Arias", "6-02", "M", { status: "retirado" }),
  seed("Camilo Andrés", "Ibáñez Torres", "11-01", "M", { status: "graduado", documentType: "CC" }),
];

/** D4: prototype groups that are not demo courses. */
const COURSE_BY_GROUP: Record<string, string> = { "1-01": "3-01", "11-01": "10-01" };

const BIRTH_YEARS_BY_GROUP: Record<string, readonly [number, number]> = {
  "1-01": [2019, 2020],
  "5-01": [2015, 2016],
  "6-01": [2014, 2015],
  "6-02": [2014, 2015],
  "7-01": [2013, 2014],
  "11-01": [2009, 2010],
};

const NEIGHBORHOODS = [
  "Chapinero",
  "Usaquén",
  "Suba",
  "Engativá",
  "Kennedy",
  "Teusaquillo",
  "Fontibón",
];
const STRATA = [2, 3, 4, 5, 3, 2, 4];
const BLOOD_TYPES = ["O+", "A+", "B+", "O-", "AB+", "A-"];
const EPS_LIST = ["Sanitas", "Compensar", "Nueva EPS", "Sura", "Salud Total"];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Student document numbers: 1000000200 + prototype index (Julián keeps his P0 document). */
const studentDocument = (index: number) => `10000002${pad2(index)}`;

function birthDate(studentSeed: StudentSeed, index: number): string {
  const [min, max] = BIRTH_YEARS_BY_GROUP[studentSeed.group] ?? [2014, 2015];
  // The prototype makes CC students adults (2008); the others alternate within the group range.
  const year = studentSeed.documentType === "CC" ? 2008 : index % 2 === 0 ? min : max;
  return `${year}-${pad2(((index * 5) % 12) + 1)}-${pad2(((index * 7) % 28) + 1)}`;
}

export const DEMO_STUDENTS: readonly DemoStudent[] = STUDENT_SEEDS.map((s, index) => ({
  firstName: s.firstName,
  lastName: s.lastName,
  documentType: s.documentType ?? (s.group === "1-01" ? "RC" : "TI"),
  documentNumber: s.documentNumber ?? studentDocument(index),
  gender: s.gender,
  birthDate: birthDate(s, index),
  course: COURSE_BY_GROUP[s.group] ?? s.group,
  status: s.status ?? "activo",
  neighborhood: NEIGHBORHOODS[index % NEIGHBORHOODS.length]!,
  stratum: STRATA[index % STRATA.length]!,
  bloodType: BLOOD_TYPES[(index * 3) % BLOOD_TYPES.length]!,
  eps: EPS_LIST[(index * 2) % EPS_LIST.length]!,
}));

const child = (index: number, relationship: GuardianRelationship) => ({
  student: STUDENT_SEEDS[index]?.documentNumber ?? studentDocument(index),
  relationship,
});

let guardianCount = 0;
/** Guardian document numbers 1000000301…, phones 3104000001… (the P0 parent keeps hers). */
function guardian(
  firstName: string,
  lastName: string,
  gender: DemoGender,
  children: DemoGuardian["children"],
): DemoGuardian {
  guardianCount += 1;
  return {
    firstName,
    lastName,
    gender,
    documentNumber: `1000000${300 + guardianCount}`,
    phone: `310${4_000_000 + guardianCount}`,
    children,
  };
}

/**
 * 26 guardians (R4.2). The names are what the prototype generator yields for each student index;
 * the three sibling pairs share one guardian (prototype `SHARED_GUARDIAN`).
 */
export const DEMO_GUARDIANS: readonly DemoGuardian[] = [
  guardian("Luz Marina", "López Sánchez", "F", [child(0, "Madre")]),
  guardian("Wilson", "López Sánchez", "M", [child(0, "Tío/a")]),
  guardian("Jorge Enrique", "Pérez Ortiz", "M", [child(1, "Padre")]),
  guardian("Paola Andrea", "Pérez Ortiz", "F", [child(1, "Madre")]),
  guardian("Claudia Patricia", "Moreno Cardona", "F", [child(2, "Madre")]),
  guardian("Wilson", "Acosta Peña", "M", [child(5, "Padre"), child(37, "Padre")]),
  guardian("Gustavo", "López", "M", [child(7, "Padre")]),
  guardian("Paola Andrea", "Torres Quintero", "F", [child(8, "Madre")]),
  guardian("Orlando", "Torres Quintero", "M", [child(8, "Padre")]),
  guardian("Álvaro", "Herrera Molina", "M", [child(9, "Padre"), child(34, "Padre")]),
  guardian("Yolanda", "Ramos Giraldo", "F", [child(10, "Madre")]),
  guardian("Freddy", "Duarte Mejía", "M", [child(15, "Padre")]),
  guardian("Claudia Patricia", "Duarte Mejía", "F", [child(15, "Madre")]),
  guardian("Marisol", "Ruiz Mora", "F", [child(16, "Madre"), child(30, "Madre")]),
  guardian("Jorge Enrique", "Patiño Restrepo", "M", [child(17, "Padre")]),
  guardian("Claudia Patricia", "Rojas Pineda", "F", [child(22, "Madre")]),
  guardian("Hernando", "Rojas Pineda", "M", [child(22, "Padre")]),
  guardian("Gustavo", "Ramírez Cruz", "M", [child(23, "Padre")]),
  guardian("Yolanda", "Ramírez Cruz", "F", [child(23, "Madre")]),
  guardian("Diana Carolina", "Medina Suárez", "F", [child(24, "Madre")]),
  guardian("Orlando", "Castro Vega", "M", [child(29, "Padre")]),
  guardian("Marisol", "Castro Vega", "F", [child(29, "Madre")]),
  guardian("Freddy", "Salgado Rey", "M", [child(31, "Padre")]),
  // D4: the P0 demo parent (DEMO_PEOPLE) is Isabella Gómez Herrera's mother.
  {
    firstName: "Patricia",
    lastName: "Gómez",
    gender: "F",
    documentNumber: "1000000006",
    children: [child(35, "Madre")],
  },
  guardian("Édgar", "Gómez Herrera", "M", [child(35, "Padre")]),
  guardian("Marisol", "Ávila Correa", "F", [child(36, "Madre")]),
];

export type SeededLogin = {
  kind: "student" | "parent";
  fullName: string;
  username: string;
  password: string;
};

type PersonSpec = Omit<ProvisionInput, "organizationId" | "actor" | "mustChangePassword">;

/** Finds a person by document number or provisions it (R4.3: password = document number). */
async function ensurePerson(
  deps: ProvisionDeps,
  organizationId: string,
  spec: PersonSpec,
): Promise<{ personId: string; username: string }> {
  const [row] = await deps.database
    .select({ personId: schema.person.id, username: schema.user.username })
    .from(schema.person)
    .innerJoin(schema.user, eq(schema.user.id, schema.person.userId))
    .where(
      and(
        eq(schema.person.organizationId, organizationId),
        eq(schema.person.documentNumber, spec.documentNumber),
      ),
    )
    .limit(1);
  if (row) return { personId: row.personId, username: row.username ?? "" };
  const provisioned = await provisionUser(deps, {
    ...spec,
    organizationId,
    mustChangePassword: false,
    actor: "system",
  });
  return { personId: provisioned.personId, username: provisioned.username };
}

export async function seedStudents(
  deps: ProvisionDeps,
  organizationId: string,
): Promise<SeededLogin[]> {
  const { database } = deps;
  const studentLogins: SeededLogin[] = [];
  const guardianLogins: SeededLogin[] = [];
  const login = (
    kind: SeededLogin["kind"],
    person: { firstName: string; lastName: string; documentNumber: string },
    username: string,
  ) =>
    (kind === "student" ? studentLogins : guardianLogins).push({
      kind,
      fullName: `${person.firstName} ${person.lastName}`,
      username,
      password: person.documentNumber,
    });

  // 1. Guardian people first: the student's guardian text fields name the primary guardian.
  const guardianPersonIds = new Map<string, string>();
  for (const g of DEMO_GUARDIANS) {
    const { personId, username } = await ensurePerson(deps, organizationId, {
      role: "parent",
      firstName: g.firstName,
      lastName: g.lastName,
      documentType: "CC",
      documentNumber: g.documentNumber,
      gender: g.gender,
      phone: g.phone,
    });
    guardianPersonIds.set(g.documentNumber, personId);
    login("parent", g, username);
  }
  const primaryGuardian = new Map<string, DemoGuardian>();
  for (const g of DEMO_GUARDIANS) {
    for (const c of g.children)
      if (!primaryGuardian.has(c.student)) primaryGuardian.set(c.student, g);
  }

  // 2. Student people and profiles (course and its campus; the retirado/graduado keep theirs).
  const courses = await database
    .select({ id: schema.course.id, name: schema.course.name, campusId: schema.course.campusId })
    .from(schema.course)
    .where(
      and(
        eq(schema.course.organizationId, organizationId),
        eq(schema.course.academicYear, DEMO_ACADEMIC_YEAR),
      ),
    );
  const courseByName = new Map(courses.map((course) => [course.name, course]));
  const studentPersonIds = new Map<string, string>();
  const profiles: (typeof schema.student.$inferInsert)[] = [];
  for (const s of DEMO_STUDENTS) {
    const course = courseByName.get(s.course);
    if (!course) throw new Error(`Demo course ${s.course} is missing.`);
    const { personId, username } = await ensurePerson(deps, organizationId, {
      role: "student",
      firstName: s.firstName,
      lastName: s.lastName,
      documentType: s.documentType,
      documentNumber: s.documentNumber,
      gender: s.gender,
      birthDate: s.birthDate,
    });
    studentPersonIds.set(s.documentNumber, personId);
    login("student", s, username);
    const primary = primaryGuardian.get(s.documentNumber);
    profiles.push({
      organizationId,
      personId,
      campusId: course.campusId,
      courseId: course.id,
      neighborhood: s.neighborhood,
      stratum: s.stratum,
      bloodType: s.bloodType,
      eps: s.eps,
      guardianName: primary ? `${primary.firstName} ${primary.lastName}` : null,
      guardianPhone: primary?.phone ?? null,
      enrolledYear: DEMO_ACADEMIC_YEAR,
      status: s.status,
    });
  }
  await database.insert(schema.student).values(profiles).onConflictDoNothing();
  const students = await database
    .select({
      id: schema.student.id,
      personId: schema.student.personId,
      courseId: schema.student.courseId,
      status: schema.student.status,
    })
    .from(schema.student)
    .where(
      and(
        eq(schema.student.organizationId, organizationId),
        inArray(schema.student.personId, [...studentPersonIds.values()]),
      ),
    )
    .orderBy(asc(schema.student.id));
  const studentIdByPerson = new Map(students.map((s) => [s.personId, s.id]));

  // 3. Guardian links.
  const links = DEMO_GUARDIANS.flatMap((g) =>
    g.children.map((c) => {
      const studentId = studentIdByPerson.get(studentPersonIds.get(c.student) ?? "");
      if (!studentId) throw new Error(`Demo student ${c.student} has no profile.`);
      return {
        organizationId,
        studentId,
        guardianPersonId: guardianPersonIds.get(g.documentNumber)!,
        relationship: c.relationship,
      };
    }),
  );
  await database.insert(schema.studentGuardian).values(links).onConflictDoNothing();

  // 4. Bulk enrollment per course (SCH-R5): the shared routine skips existing rows.
  for (const course of courses) {
    const members = students
      .filter((s) => s.courseId === course.id && s.status === "activo")
      .map((s) => s.id);
    if (members.length === 0) continue;
    await database.transaction(async (tx) => {
      const locked = await lockEnrollmentCourse(tx, organizationId, course.id);
      await enrollInCourse(tx, {
        organizationId,
        course: locked,
        studentIds: members,
        allowOverCapacity: true,
        admission: true,
      });
    });
  }

  return [...studentLogins, ...guardianLogins];
}
