import { INSTITUTION_ID, TEACHER_ID, USER_ID, grades, type TeacherKey } from "./base";
import { ACADEMIC_YEAR, REFERENCE_DATE, addDays } from "./dates";
import { createRng } from "./prng";
import type { AcademicStudent, DocType, ParentStudent, Role, StudentStatus, User } from "./types";

/** Users, students and guardians (inventory 5.5 and 5.7). Deterministic: seeded PRNG only. */

const rng = createRng(20261005);

const EMAIL_DOMAIN = "colegiosanjose.edu.co";

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function slug(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function digits(length: number): string {
  return Array.from({ length }, () => rng.int(0, 9)).join("");
}

const usedUsernames = new Set<string>();

/** Initial of the first name + first surname + last 4 digits of the document. */
function makeUsername(firstName: string, lastName: string, documentNumber: string): string {
  const base = `${slug(firstName).charAt(0)}${slug(lastName.split(" ")[0] ?? lastName)}`;
  let suffix = documentNumber.slice(-4);
  let username = `${base}${suffix}`;
  let bump = 0;
  while (usedUsernames.has(username)) {
    bump += 1;
    suffix = String((Number(documentNumber.slice(-4)) + bump) % 10000).padStart(4, "0");
    username = `${base}${suffix}`;
  }
  usedUsernames.add(username);
  return username;
}

interface UserSeed {
  id: number;
  firstName: string;
  lastName: string;
  role: Role;
  documentType?: DocType;
  birthYear?: number;
  gender?: User["gender"];
  institutionId?: number;
  emailDomain?: string;
  createdAt?: string;
}

function makeUser(seed: UserSeed): User {
  const documentNumber =
    seed.documentType === "RC" ? digits(10) : String(rng.int(10, 99)) + digits(8);
  const username =
    seed.role === "root" ? "root" : makeUsername(seed.firstName, seed.lastName, documentNumber);
  const loginAge = rng.int(0, 9);
  return {
    id: seed.id,
    username,
    email: `${username}@${seed.emailDomain ?? EMAIL_DOMAIN}`,
    firstName: seed.firstName,
    lastName: seed.lastName,
    documentType: seed.documentType ?? "CC",
    documentNumber,
    birthDate: seed.birthYear
      ? `${seed.birthYear}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`
      : undefined,
    gender: seed.gender,
    phone: `3${digits(9)}`,
    address: `Calle ${rng.int(20, 170)} # ${rng.int(5, 80)}-${rng.int(1, 60)}`,
    country: "Colombia",
    department: "Cundinamarca",
    municipality: "Bogotá D.C.",
    role: seed.role,
    institutionId: seed.role === "root" ? undefined : (seed.institutionId ?? INSTITUTION_ID),
    isActive: true,
    mustChangePassword: false,
    lastLogin: `${addDays(REFERENCE_DATE, -loginAge)}T0${rng.int(6, 9)}:${String(rng.int(0, 59)).padStart(2, "0")}`,
    createdAt: seed.createdAt ?? "2026-01-12",
  };
}

const TEACHER_SEEDS: ReadonlyArray<[TeacherKey, string, string, User["gender"]]> = [
  ["laura", "Laura", "Martínez", "F"],
  ["andres", "Andrés", "Gómez", "M"],
  ["carolina", "Carolina", "Ruiz", "F"],
  ["jorge", "Jorge", "Herrera", "M"],
  ["marcela", "Marcela", "Ortiz", "F"],
  ["diego", "Diego", "Salazar", "M"],
  ["sandra", "Sandra", "Pardo", "F"],
  ["felipe", "Felipe", "Mora", "M"],
  ["natalia", "Natalia", "Cárdenas", "F"],
  ["oscar", "Óscar", "Beltrán", "M"],
  ["juliana", "Juliana", "Ríos", "F"],
  ["mauricio", "Mauricio", "Zapata", "M"],
];

const staff: User[] = [
  makeUser({ id: USER_ID.root, firstName: "Administrador", lastName: "Root", role: "root" }),
  makeUser({
    id: USER_ID.admin,
    firstName: "Ricardo",
    lastName: "Alarcón",
    role: "admin",
    gender: "M",
    birthYear: 1971,
  }),
  makeUser({
    id: USER_ID.coordinatorMain,
    firstName: "Patricia",
    lastName: "Vargas",
    role: "coordinator",
    gender: "F",
    birthYear: 1979,
  }),
  makeUser({
    id: USER_ID.coordinatorNorth,
    firstName: "Hernán",
    lastName: "Castaño",
    role: "coordinator",
    gender: "M",
    birthYear: 1982,
  }),
  makeUser({ id: USER_ID.viewer, firstName: "Consultor", lastName: "Secretaría", role: "viewer" }),
  ...TEACHER_SEEDS.map(([key, firstName, lastName, gender]) =>
    makeUser({
      id: TEACHER_ID[key],
      firstName,
      lastName,
      role: "teacher",
      gender,
      birthYear: rng.int(1974, 1992),
    }),
  ),
];

interface StudentSeed {
  firstName: string;
  surnames: string;
  group: string;
  gender: "M" | "F";
  status?: StudentStatus;
  documentType?: DocType;
}

function seed(
  firstName: string,
  surnames: string,
  group: string,
  gender: "M" | "F",
  extra: Partial<StudentSeed> = {},
): StudentSeed {
  return { firstName, surnames, group, gender, ...extra };
}

/** 40 active students (6/7/7/7/6/5 ...) plus one retired and one graduated record. */
const STUDENT_SEEDS: readonly StudentSeed[] = [
  // 6-01 (8)
  seed("Mariana", "López Sánchez", "6-01", "F"),
  seed("Juan David", "Pérez Ortiz", "6-01", "M"),
  seed("Daniela", "Moreno Cardona", "6-01", "F"),
  seed("Sebastián", "Vargas León", "6-01", "M"),
  seed("Laura Sofía", "Mejía Arango", "6-01", "F"),
  seed("Nicolás", "Acosta Peña", "6-01", "M"),
  seed("Valeria", "Jiménez Ríos", "6-01", "F"),
  seed("Emmanuel", "Cortés Bernal", "6-01", "M"),
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

/** Siblings share one guardian: child full name -> sibling whose guardian they share. */
const SHARED_GUARDIAN: Record<string, string> = {
  "Tomás Ruiz Mora": "Camila Fernanda Ruiz Mora",
  "Salomé Acosta Peña": "Nicolás Acosta Peña",
  "Dylan Mauricio Herrera Molina": "Gabriela Herrera Molina",
};

/** Students that also get a second guardian (father, uncle, grandmother...). */
const SECOND_GUARDIAN = new Set([
  "Mariana López Sánchez",
  "Santiago Duarte Mejía",
  "Valentina Rojas Pineda",
  "Mateo Ramírez Cruz",
  "Samuel Torres Quintero",
  "Sofía Castro Vega",
  "Isabella Gómez Herrera",
  "Juan David Pérez Ortiz",
]);

const MOTHER_NAMES = [
  "Luz Marina",
  "Martha Lucía",
  "Claudia Patricia",
  "Sandra Milena",
  "Diana Carolina",
  "Ana María",
  "Gloria Esperanza",
  "Liliana",
  "Paola Andrea",
  "Adriana",
  "Yolanda",
  "Rocío",
  "Beatriz Elena",
  "Carmenza",
  "Johana",
  "Nubia",
  "Marisol",
  "Olga Lucía",
  "Mónica",
  "Alba Nury",
];

const FATHER_NAMES = [
  "Carlos Alberto",
  "Jorge Enrique",
  "Luis Fernando",
  "Héctor",
  "Julio César",
  "Wilson",
  "Fabio",
  "Gustavo",
  "Édgar",
  "Álvaro",
  "Rodrigo",
  "Hernando",
  "Nelson",
  "Orlando",
  "William",
  "Freddy",
];

const NEIGHBORHOODS = [
  "Chapinero",
  "Usaquén",
  "Suba",
  "Engativá",
  "Kennedy",
  "Teusaquillo",
  "Fontibón",
];
const BLOOD_TYPES = ["O+", "A+", "B+", "O-", "AB+", "A-"];
const EPS_LIST = ["Sanitas", "Compensar", "Nueva EPS", "Sura", "Salud Total"];

const BIRTH_YEAR_BY_GROUP: Record<string, readonly [number, number]> = {
  "1-01": [2019, 2020],
  "5-01": [2015, 2016],
  "6-01": [2014, 2015],
  "6-02": [2014, 2015],
  "7-01": [2013, 2014],
  "11-01": [2009, 2010],
};

const gradeByName = new Map(grades.map((grade) => [grade.name, grade]));

const STUDENT_USER_START = 18;
const studentUsers: User[] = STUDENT_SEEDS.map((studentSeed, index) => {
  const [minYear, maxYear] = BIRTH_YEAR_BY_GROUP[studentSeed.group] ?? [2014, 2015];
  return makeUser({
    id: STUDENT_USER_START + index,
    firstName: studentSeed.firstName,
    lastName: studentSeed.surnames,
    role: "student",
    gender: studentSeed.gender,
    documentType: studentSeed.documentType ?? (studentSeed.group === "1-01" ? "RC" : "TI"),
    birthYear: studentSeed.documentType === "CC" ? 2008 : rng.int(minYear, maxYear),
    emailDomain: `estudiantes.${EMAIL_DOMAIN}`,
  });
});

const PARENT_USER_START = STUDENT_USER_START + STUDENT_SEEDS.length;
const parentUsers: User[] = [];
const parentLinks: ParentStudent[] = [];
const guardianByStudentName = new Map<string, User>();

function createParent(firstName: string, surnames: string, gender: "M" | "F"): User {
  const user = makeUser({
    id: PARENT_USER_START + parentUsers.length,
    firstName,
    lastName: surnames,
    role: "parent",
    gender,
    birthYear: rng.int(1974, 1992),
    emailDomain: "correo.com",
  });
  parentUsers.push(user);
  return user;
}

function linkParent(parent: User, studentId: number, relationship: string) {
  parentLinks.push({ id: parentLinks.length + 1, parentId: parent.id, studentId, relationship });
}

export const students: AcademicStudent[] = STUDENT_SEEDS.map((studentSeed, index) => {
  const studentId = index + 1;
  const user = studentUsers[index] as User;
  const fullName = `${studentSeed.firstName} ${studentSeed.surnames}`;
  const grade = gradeByName.get(studentSeed.group);

  const sharedWith = SHARED_GUARDIAN[fullName];
  let primary: User;
  if (sharedWith && guardianByStudentName.has(sharedWith)) {
    primary = guardianByStudentName.get(sharedWith) as User;
    linkParent(primary, studentId, primary.gender === "F" ? "Madre" : "Padre");
  } else {
    const isMother = index % 2 === 0;
    primary = isMother
      ? createParent(MOTHER_NAMES[index % MOTHER_NAMES.length] as string, studentSeed.surnames, "F")
      : createParent(
          FATHER_NAMES[index % FATHER_NAMES.length] as string,
          studentSeed.surnames,
          "M",
        );
    linkParent(primary, studentId, isMother ? "Madre" : "Padre");
  }
  guardianByStudentName.set(fullName, primary);

  if (SECOND_GUARDIAN.has(fullName)) {
    const secondIsFather = primary.gender === "F";
    const second = secondIsFather
      ? createParent(
          FATHER_NAMES[(index + 5) % FATHER_NAMES.length] as string,
          studentSeed.surnames,
          "M",
        )
      : createParent(
          MOTHER_NAMES[(index + 7) % MOTHER_NAMES.length] as string,
          studentSeed.surnames,
          "F",
        );
    linkParent(second, studentId, secondIsFather ? (index % 3 === 0 ? "Tío/a" : "Padre") : "Madre");
  }

  return {
    id: studentId,
    userId: user.id,
    institutionId: INSTITUTION_ID,
    campusId: grade?.campusId ?? 1,
    gradeId: grade?.id,
    neighborhood: NEIGHBORHOODS[index % NEIGHBORHOODS.length],
    stratum: ([2, 3, 4, 5, 3, 2, 4] as const)[index % 7],
    bloodType: BLOOD_TYPES[(index * 3) % BLOOD_TYPES.length],
    eps: EPS_LIST[(index * 2) % EPS_LIST.length],
    guardianName: `${primary.firstName} ${primary.lastName}`,
    guardianPhone: primary.phone,
    guardianEmail: primary.email,
    enrolledYear: ACADEMIC_YEAR,
    status: studentSeed.status ?? "activo",
  };
});

export const users: User[] = [...staff, ...studentUsers, ...parentUsers];
export const parentStudents: ParentStudent[] = parentLinks;

export const userById = new Map(users.map((user) => [user.id, user]));
export const studentById = new Map(students.map((student) => [student.id, student]));
export const studentByUserId = new Map(students.map((student) => [student.userId, student]));

export function fullName(user: Pick<User, "firstName" | "lastName">): string {
  return `${user.firstName} ${user.lastName}`;
}

export function studentName(studentId: number): string {
  const student = studentById.get(studentId);
  const user = student ? userById.get(student.userId) : undefined;
  return user ? fullName(user) : "Estudiante";
}

export function studentIdByName(name: string): number {
  const found = students.find((student) => {
    const user = userById.get(student.userId);
    return user ? fullName(user) === name : false;
  });
  if (!found) throw new Error(`Unknown student "${name}"`);
  return found.id;
}

const camilaId = studentIdByName("Camila Fernanda Ruiz Mora");
const marianaId = studentIdByName("Mariana López Sánchez");

/** Parent linked to Camila (and her brother Tomás): the multi-child guardian of the dataset. */
const multiChildParentId =
  parentLinks.find((link) => link.studentId === camilaId)?.parentId ?? PARENT_USER_START;

/** The user each role "is logged in as" in the prototype. */
export const demoUserByRole: Record<Role, number> = {
  root: USER_ID.root,
  admin: USER_ID.admin,
  coordinator: USER_ID.coordinatorMain,
  teacher: TEACHER_ID.laura,
  student: (studentById.get(marianaId) as AcademicStudent).userId,
  parent: multiChildParentId,
  viewer: USER_ID.viewer,
};

/** Demo account for the forced password change screen (kept out of the 82-user headcount). */
export const firstLoginDemoUser: User = {
  id: 999,
  username: "jlopez0001",
  email: "jlopez0001@estudiantes.colegiosanjose.edu.co",
  firstName: "Juliana",
  lastName: "López",
  documentType: "TI",
  documentNumber: "1023456789",
  role: "student",
  institutionId: INSTITUTION_ID,
  isActive: true,
  mustChangePassword: true,
  createdAt: REFERENCE_DATE,
};

export function currentUserFor(role: Role): User {
  return userById.get(demoUserByRole[role]) as User;
}

export const teachers: User[] = users.filter((user) => user.role === "teacher");
