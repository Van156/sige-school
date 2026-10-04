import { ACADEMIC_YEAR } from "./dates";
import type {
  Achievement,
  AcademicPeriod,
  Campus,
  Classroom,
  Grade,
  GradeCriteria,
  GradeLevel,
  Institution,
  InstitutionSummary,
  ScheduleBlock,
  Shift,
  Subject,
} from "./types";

/** Hand-authored reference data (inventory 5.1-5.6). Stable ids: other collections point here. */

export const INSTITUTION_ID = 1;

/** Fixed user ids for staff; students and guardians are numbered after them. */
export const USER_ID = {
  root: 1,
  admin: 2,
  coordinatorMain: 3,
  coordinatorNorth: 4,
  viewer: 5,
} as const;

export const TEACHER_ID = {
  laura: 6,
  andres: 7,
  carolina: 8,
  jorge: 9,
  marcela: 10,
  diego: 11,
  sandra: 12,
  felipe: 13,
  natalia: 14,
  oscar: 15,
  juliana: 16,
  mauricio: 17,
} as const;

export type TeacherKey = keyof typeof TEACHER_ID;

export const institutions: Institution[] = [
  {
    id: INSTITUTION_ID,
    name: "Colegio San José",
    nit: "900.456.789-1",
    address: "Calle 45 # 12-30",
    phone: "(601) 234 5678",
    email: "contacto@colegiosanjose.edu.co",
    municipality: "Bogotá D.C.",
    department: "Cundinamarca",
    resolution: "Resolución No. 4821 del 14/03/2019 de la Secretaría de Educación",
    academicYear: ACADEMIC_YEAR,
    createdAt: "2019-03-14",
  },
  {
    id: 2,
    name: "Institución Educativa Simón Bolívar",
    nit: "890.123.456-2",
    address: "Carrera 70 # 44-18",
    phone: "(604) 345 6789",
    email: "rectoria@iesimonbolivar.edu.co",
    municipality: "Medellín",
    department: "Antioquia",
    resolution: "Resolución No. 1156 del 02/02/2015",
    academicYear: ACADEMIC_YEAR,
    createdAt: "2021-01-18",
  },
  {
    id: 3,
    name: "Liceo Moderno del Norte",
    nit: "802.987.654-3",
    address: "Calle 84 # 51-20",
    phone: "(605) 456 7890",
    email: "info@liceomodernonorte.edu.co",
    municipality: "Barranquilla",
    department: "Atlántico",
    resolution: "Resolución No. 0873 del 21/06/2012",
    academicYear: ACADEMIC_YEAR,
    createdAt: "2022-08-01",
  },
];

/** Counts for the two institutions without detailed data (San José is computed from the dataset). */
export const stubInstitutionSummaries: InstitutionSummary[] = [
  { institutionId: 2, admins: 1, campuses: 3, teachers: 38, students: 612, users: 790 },
  { institutionId: 3, admins: 2, campuses: 1, teachers: 21, students: 340, users: 441 },
];

export const campuses: Campus[] = [
  {
    id: 1,
    institutionId: INSTITUTION_ID,
    name: "Sede Principal",
    code: "SEDE-001",
    address: "Calle 45 # 12-30",
    jornada: "completa",
    isMainCampus: true,
    active: true,
    createdAt: "2019-03-14",
  },
  {
    id: 2,
    institutionId: INSTITUTION_ID,
    name: "Sede Norte",
    code: "SEDE-002",
    address: "Carrera 15 # 128-40",
    jornada: "manana",
    isMainCampus: false,
    active: true,
    createdAt: "2020-02-03",
  },
  {
    id: 3,
    institutionId: INSTITUTION_ID,
    name: "Sede Antigua",
    code: "SEDE-003",
    address: "Calle 12 # 8-15",
    jornada: "tarde",
    isMainCampus: false,
    active: false,
    createdAt: "2019-03-14",
  },
];

export const gradeLevels: GradeLevel[] = [
  { id: 1, campusId: 1, name: "Sexto", orderNum: 6 },
  { id: 2, campusId: 1, name: "Séptimo", orderNum: 7 },
  { id: 3, campusId: 1, name: "Once", orderNum: 11 },
  { id: 4, campusId: 2, name: "Primero", orderNum: 1 },
  { id: 5, campusId: 2, name: "Quinto", orderNum: 5 },
];

export const grades: Grade[] = [
  group(1, 1, 1, TEACHER_ID.laura, "6-01", "Mañana", 40),
  group(2, 1, 1, TEACHER_ID.andres, "6-02", "Tarde", 40),
  group(3, 1, 2, TEACHER_ID.carolina, "7-01", "Mañana", 40),
  group(4, 1, 3, TEACHER_ID.jorge, "11-01", "Mañana", 35),
  group(5, 2, 4, TEACHER_ID.marcela, "1-01", "Mañana", 30),
  group(6, 2, 5, TEACHER_ID.diego, "5-01", "Mañana", 35),
];

function group(
  id: number,
  campusId: number,
  levelId: number,
  directorId: number,
  name: string,
  shift: Shift,
  maxStudents: number,
): Grade {
  return {
    id,
    campusId,
    levelId,
    directorId,
    name,
    academicYear: ACADEMIC_YEAR,
    shift,
    maxStudents,
  };
}

export const SUBJECT_CODES = [
  "MAT",
  "LEN",
  "CNA",
  "SOC",
  "ING",
  "TEC",
  "ART",
  "EDF",
  "ETI",
  "REL",
] as const;
export type SubjectCode = (typeof SUBJECT_CODES)[number];

const subjectNames: Record<SubjectCode, string> = {
  MAT: "Matemáticas",
  LEN: "Lengua Castellana",
  CNA: "Ciencias Naturales",
  SOC: "Ciencias Sociales",
  ING: "Inglés",
  TEC: "Tecnología e Informática",
  ART: "Educación Artística",
  EDF: "Educación Física",
  ETI: "Ética y Valores",
  REL: "Educación Religiosa",
};

export const subjects: Subject[] = SUBJECT_CODES.map((code, index) => ({
  id: index + 1,
  institutionId: INSTITUTION_ID,
  name: subjectNames[code],
  code,
}));

export const subjectHoursPerWeek: Record<SubjectCode, number> = {
  MAT: 5,
  LEN: 5,
  CNA: 4,
  SOC: 3,
  ING: 3,
  TEC: 2,
  ART: 2,
  EDF: 2,
  ETI: 1,
  REL: 1,
};

export const periods: AcademicPeriod[] = [
  period(1, "Primer Periodo", "P1", "2026-01-26", "2026-04-03", false),
  period(2, "Segundo Periodo", "P2", "2026-04-13", "2026-06-19", false),
  period(3, "Tercer Periodo", "P3", "2026-07-13", "2026-09-18", false),
  period(4, "Cuarto Periodo", "P4", "2026-09-28", "2026-12-04", true),
];

function period(
  order: number,
  name: string,
  shortName: string,
  startDate: string,
  endDate: string,
  isActive: boolean,
): AcademicPeriod {
  return {
    id: order,
    institutionId: INSTITUTION_ID,
    name,
    shortName,
    startDate,
    endDate,
    isActive,
    academicYear: ACADEMIC_YEAR,
    order,
  };
}

export const criteria: GradeCriteria[] = [
  {
    id: 1,
    institutionId: INSTITUTION_ID,
    name: "Seguimiento",
    weight: 20,
    description: "Tareas, quizzes, participación diaria",
    order: 1,
  },
  {
    id: 2,
    institutionId: INSTITUTION_ID,
    name: "Formativo",
    weight: 20,
    description: "Trabajo en clase, talleres y actitud",
    order: 2,
  },
  {
    id: 3,
    institutionId: INSTITUTION_ID,
    name: "Cognitivo",
    weight: 30,
    description: "Pruebas escritas, evaluaciones de conocimiento",
    order: 3,
  },
  {
    id: 4,
    institutionId: INSTITUTION_ID,
    name: "Procedimental",
    weight: 30,
    description: "Proyectos, laboratorios y prácticas",
    order: 4,
  },
];

/** P4 only grades these two criteria so far (40% of the weight). */
export const ACTIVE_PERIOD_CRITERION_IDS: readonly number[] = [1, 2];

export const classrooms: Classroom[] = [
  ...[1, 2, 3, 4, 5, 6].map((n) =>
    room(n, 1, `AULA-10${n}`, "aula", 40, n <= 3 ? 1 : 2, "Edificio A"),
  ),
  room(
    7,
    1,
    "LAB-CIENCIAS",
    "laboratorio",
    30,
    1,
    "Edificio B",
    '{"microscopios": 12, "proyector": true}',
  ),
  room(8, 1, "SALA-SISTEMAS", "laboratorio", 35, 2, "Edificio B", '{"computadoras": 30}'),
  room(9, 1, "AUD-PRINCIPAL", "auditorio", 200, 1, "Edificio C"),
  room(10, 1, "CANCHA-1", "cancha", 60, 1, "Exterior"),
  room(11, 2, "AULA-N01", "aula", 30, 1, "Edificio Norte"),
  room(12, 2, "AULA-N02", "aula", 35, 1, "Edificio Norte"),
  room(13, 2, "SALA-N-ARTES", "aula", 30, 1, "Edificio Norte"),
  room(14, 2, "CANCHA-N", "cancha", 50, 1, "Exterior"),
];

function room(
  id: number,
  campusId: number,
  code: string,
  classroomType: Classroom["classroomType"],
  capacity: number,
  floor: number,
  building: string,
  resources?: string,
): Classroom {
  return { id, campusId, name: code, code, capacity, floor, building, classroomType, resources };
}

type BlockSpec = readonly [name: string, start: string, end: string, isBreak?: boolean];

const MORNING_BLOCKS: readonly BlockSpec[] = [
  ["Bloque 1", "06:30", "07:30"],
  ["Bloque 2", "07:30", "08:30"],
  ["Recreo", "08:30", "09:00", true],
  ["Bloque 3", "09:00", "10:00"],
  ["Bloque 4", "10:00", "11:00"],
  ["Almuerzo", "11:00", "11:30", true],
  ["Bloque 5", "11:30", "12:30"],
  ["Bloque 6", "12:30", "13:30"],
];

/** The inventory lists five afternoon blocks; a sixth keeps room for the 28 weekly hours. */
const AFTERNOON_BLOCKS: readonly BlockSpec[] = [
  ["Bloque 1", "13:00", "14:00"],
  ["Bloque 2", "14:00", "15:00"],
  ["Recreo", "15:00", "15:20", true],
  ["Bloque 3", "15:20", "16:20"],
  ["Bloque 4", "16:20", "17:20"],
  ["Bloque 5", "17:20", "18:20"],
  ["Bloque 6", "18:20", "19:20"],
];

export const scheduleBlocks: ScheduleBlock[] = (() => {
  const result: ScheduleBlock[] = [];
  const add = (campusId: number, shift: Shift, specs: readonly BlockSpec[]) => {
    specs.forEach(([name, startTime, endTime, isBreak], index) => {
      result.push({
        id: result.length + 1,
        campusId,
        name,
        startTime,
        endTime,
        isBreak: isBreak ?? false,
        orderNum: index + 1,
        shift,
        academicYear: ACADEMIC_YEAR,
      });
    });
  };
  add(1, "Mañana", MORNING_BLOCKS);
  add(1, "Tarde", AFTERNOON_BLOCKS);
  add(2, "Mañana", MORNING_BLOCKS);
  return result;
})();

export const achievements: Achievement[] = [
  achievement(
    1,
    "Superador",
    "📈",
    "superador",
    "mejora",
    "Subió 1+ punto entre periodos consecutivos",
  ),
  achievement(2, "Excelencia", "⭐", "excelencia", "académico", "Nota >= 4.5 en un periodo"),
  achievement(
    3,
    "Asistencia Perfecta",
    "✅",
    "asistencia_perfecta",
    "asistencia",
    "0 inasistencias en un periodo",
  ),
  achievement(
    4,
    "Todo Terreno",
    "🏅",
    "todo_terreno",
    "académico",
    "Todas las materias ganadas en el periodo",
  ),
  achievement(
    5,
    "Resiliente",
    "💪",
    "resiliente",
    "mejora",
    "Recuperó una materia perdida entre periodos",
  ),
  achievement(
    6,
    "Constancia",
    "🔥",
    "constancia",
    "académico",
    "3 periodos seguidos con promedio >= 4.0",
  ),
  achievement(
    7,
    "Compañero",
    "🤝",
    "companero",
    "comportamiento",
    "Recibió una observación positiva",
  ),
];

function achievement(
  id: number,
  name: string,
  icon: string,
  criteria: string,
  category: Achievement["category"],
  description: string,
): Achievement {
  return {
    id,
    institutionId: INSTITUTION_ID,
    name,
    description,
    icon,
    criteria,
    category,
    isActive: true,
  };
}
