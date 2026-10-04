import { TEACHER_ID, USER_ID, classrooms, grades, periods } from "./base";
import { REFERENCE_DATE, addDays } from "./dates";
import { average, performanceLevel } from "./helpers";
import { finalGrades, subjectById, subjectGradeById, subjectGrades } from "./academics";
import { studentIdByName, students, studentName, users } from "./people";
import { createRng } from "./prng";
import type {
  Alert,
  Observation,
  ObservationType,
  QRAccessLog,
  QRLogStatus,
  QRToken,
  ReportCard,
  ReportCardObservation,
  StudentAchievement,
} from "./types";

/** Observations, alerts, achievements, report cards and QR data (inventory 5.10-5.14). */

const rng = createRng(90210);

const COORDINATOR = USER_ID.coordinatorMain;

/* ---------------------------- Observations ----------------------------- */

type ObservationSeed = readonly [
  student: string,
  type: ObservationType,
  category: string,
  description: string,
  authorId: number,
  daysAgo: number,
  commitments?: string,
];

const OBSERVATION_SEEDS: readonly ObservationSeed[] = [
  // positiva (14)
  [
    "Valentina Rojas Pineda",
    "positiva",
    "Valores",
    "Lideró el trabajo en equipo con respeto y creatividad",
    TEACHER_ID.jorge,
    40,
  ],
  [
    "Valentina Rojas Pineda",
    "positiva",
    "Rendimiento",
    "Obtuvo el mejor puntaje del grupo en la prueba de periodo",
    TEACHER_ID.jorge,
    20,
  ],
  [
    "Sofía Castro Vega",
    "positiva",
    "Valores",
    "Ayudó a un compañero nuevo a integrarse al grupo",
    TEACHER_ID.marcela,
    25,
  ],
  [
    "Sofía Castro Vega",
    "positiva",
    "Participación",
    "Participa con entusiasmo en todas las actividades",
    TEACHER_ID.marcela,
    9,
  ],
  [
    "Isabella Gómez Herrera",
    "positiva",
    "Rendimiento",
    "Mostró una mejora destacable en Matemáticas",
    TEACHER_ID.diego,
    18,
  ],
  [
    "Camila Fernanda Ruiz Mora",
    "positiva",
    "Responsabilidad",
    "Entregó todos los trabajos a tiempo y con excelente presentación",
    TEACHER_ID.carolina,
    30,
  ],
  [
    "Mariana López Sánchez",
    "positiva",
    "Participación",
    "Participó activamente en la feria de ciencias",
    TEACHER_ID.carolina,
    33,
  ],
  [
    "Juan David Pérez Ortiz",
    "positiva",
    "Valores",
    "Representó al curso en la izada de bandera con responsabilidad",
    TEACHER_ID.laura,
    27,
  ],
  [
    "Tomás Ruiz Mora",
    "positiva",
    "Valores",
    "Compartió sus materiales con compañeros que los necesitaban",
    TEACHER_ID.marcela,
    12,
  ],
  [
    "Daniela Moreno Cardona",
    "positiva",
    "Participación",
    "Lideró la exposición de Ciencias Sociales",
    TEACHER_ID.sandra,
    21,
  ],
  [
    "Natalia Andrea Cano Vélez",
    "positiva",
    "Valores",
    "Apoyó a sus compañeros en la jornada de reciclaje",
    TEACHER_ID.jorge,
    16,
  ],
  [
    "Martín Ávila Correa",
    "positiva",
    "Rendimiento",
    "Superó sus metas de lectura del periodo",
    TEACHER_ID.diego,
    35,
  ],
  [
    "Luciana Zapata Marín",
    "positiva",
    "Valores",
    "Mostró solidaridad con una compañera en dificultades",
    TEACHER_ID.andres,
    44,
  ],
  [
    "Carlos Eduardo Medina Suárez",
    "positiva",
    "Participación",
    "Colaboró en la organización de la jornada deportiva",
    TEACHER_ID.oscar,
    10,
  ],
  // negativa (10)
  [
    "Mateo Ramírez Cruz",
    "negativa",
    "Disciplina",
    "Interrumpió la clase en repetidas ocasiones",
    TEACHER_ID.jorge,
    52,
    "El estudiante se compromete a mantener una actitud de respeto en clase",
  ],
  [
    "Mateo Ramírez Cruz",
    "negativa",
    "Responsabilidad",
    "No presentó el taller asignado por tercera vez",
    TEACHER_ID.jorge,
    31,
    "El estudiante se compromete a entregar los talleres pendientes antes del viernes",
  ],
  [
    "Mateo Ramírez Cruz",
    "negativa",
    "Disciplina",
    "Uso del celular durante la evaluación",
    TEACHER_ID.jorge,
    19,
  ],
  [
    "Mateo Ramírez Cruz",
    "negativa",
    "Responsabilidad",
    "Llegó tarde a tres clases consecutivas",
    COORDINATOR,
    5,
  ],
  [
    "Santiago Duarte Mejía",
    "negativa",
    "Responsabilidad",
    "No entregó las tareas de Matemáticas durante dos semanas",
    TEACHER_ID.laura,
    23,
    "Entregar las tareas atrasadas y asistir a tutorías",
  ],
  [
    "Samuel Torres Quintero",
    "negativa",
    "Disciplina",
    "Salió del salón sin autorización",
    TEACHER_ID.andres,
    29,
  ],
  [
    "Samuel Torres Quintero",
    "negativa",
    "Responsabilidad",
    "Ausencias reiteradas sin soporte",
    COORDINATOR,
    3,
  ],
  [
    "Thiago Bermúdez Orozco",
    "negativa",
    "Disciplina",
    "Interrumpió la clase de Inglés con bromas",
    TEACHER_ID.felipe,
    8,
  ],
  [
    "Kevin Stiven Ortega Lozano",
    "negativa",
    "Responsabilidad",
    "No porta el uniforme completo",
    TEACHER_ID.jorge,
    38,
  ],
  [
    "Esteban Vélez Arias",
    "negativa",
    "Disciplina",
    "Agresión verbal a un compañero",
    TEACHER_ID.andres,
    70,
  ],
  // seguimiento (7)
  [
    "Santiago Duarte Mejía",
    "seguimiento",
    "Rendimiento",
    "Se acordó plan de refuerzo en Matemáticas",
    COORDINATOR,
    17,
    "Asistir a las tutorías los martes y jueves",
  ],
  [
    "Mateo Ramírez Cruz",
    "seguimiento",
    "Rendimiento",
    "Reunión con el acudiente por bajo rendimiento e inasistencia",
    COORDINATOR,
    26,
    "Asistencia puntual y entrega de talleres pendientes",
  ],
  [
    "Samuel Torres Quintero",
    "seguimiento",
    "Convivencia",
    "Seguimiento a las inasistencias del último mes",
    COORDINATOR,
    11,
  ],
  [
    "Mariana López Sánchez",
    "seguimiento",
    "Rendimiento",
    "Seguimiento al descenso en Lengua Castellana",
    TEACHER_ID.andres,
    15,
    "Refuerzo de comprensión lectora en casa",
  ],
  [
    "Isabella Gómez Herrera",
    "seguimiento",
    "Rendimiento",
    "Seguimiento a la recuperación en Matemáticas",
    TEACHER_ID.diego,
    40,
  ],
  [
    "Valentina Rojas Pineda",
    "seguimiento",
    "Rendimiento",
    "Seguimiento al plan de preparación para las pruebas de Estado",
    TEACHER_ID.jorge,
    22,
  ],
  [
    "Kevin Stiven Ortega Lozano",
    "seguimiento",
    "Otro",
    "Seguimiento a la orientación vocacional",
    COORDINATOR,
    37,
  ],
  // convivencia (4)
  [
    "Juan David Pérez Ortiz",
    "convivencia",
    "Convivencia",
    "Discusión con compañero durante el descanso",
    COORDINATOR,
    4,
  ],
  [
    "Juan David Pérez Ortiz",
    "convivencia",
    "Convivencia",
    "Conflicto verbal en el salón; se realizó mediación",
    TEACHER_ID.laura,
    2,
    "Pedir disculpas y respetar los turnos de palabra",
  ],
  [
    "Gabriela Herrera Molina",
    "convivencia",
    "Convivencia",
    "Discusión por el uso del balón en el descanso",
    TEACHER_ID.oscar,
    33,
  ],
  [
    "Andrés Felipe Gaviria Soto",
    "convivencia",
    "Convivencia",
    "Mediación por comentarios ofensivos en el chat del grupo",
    TEACHER_ID.carolina,
    19,
    "Retirar los mensajes y ofrecer disculpas al grupo",
  ],
];

function requiresNotification(type: ObservationType): boolean {
  return type === "negativa" || type === "convivencia";
}

export const observations: Observation[] = OBSERVATION_SEEDS.map(
  ([student, type, category, description, authorId, daysAgo, commitments], index) => ({
    id: index + 1,
    studentId: studentIdByName(student),
    authorId,
    type,
    category,
    description,
    date: `${addDays(REFERENCE_DATE, -daysAgo)}T${String(8 + (index % 7)).padStart(2, "0")}:${index % 2 === 0 ? "15" : "40"}`,
    commitments,
    notified: requiresNotification(type) ? daysAgo > 14 : daysAgo > 7,
  }),
);

/* ------------------------------- Alerts -------------------------------- */

function periodFinal(studentName_: string, code: string, order: number): number | undefined {
  const studentId = studentIdByName(studentName_);
  const subject = [...subjectById.values()].find((entry) => entry.code === code);
  const match = finalGrades.find((final) => {
    const item = subjectGradeById.get(final.subjectGradeId);
    return (
      final.studentId === studentId && final.periodId === order && item?.subjectId === subject?.id
    );
  });
  return match?.finalScore;
}

const score1 = (value: number | undefined) => (value ?? 0).toFixed(1);

/** Lowest-scoring 6-02 student in MAT during P3, who carries the group-level alert. */
const group602Math = subjectGrades.find(
  (item) =>
    item.gradeId === (grades.find((grade) => grade.name === "6-02")?.id ?? -1) &&
    subjectById.get(item.subjectId)?.code === "MAT",
);
const group602P3 = finalGrades.filter(
  (final) => final.subjectGradeId === group602Math?.id && final.periodId === 3,
);
const groupFailing = group602P3.filter((final) => final.finalScore < 3).length;
const groupFailingRate = Math.round((groupFailing / (group602P3.length || 1)) * 100);
const lowestInGroup = [...group602P3].sort((a, b) => a.finalScore - b.finalScore)[0];

type AlertSeed = Omit<Alert, "id" | "studentId" | "resolvedAt"> & {
  student: string | number;
  resolvedDaysAgo?: number;
};

const ALERT_SEEDS: readonly AlertSeed[] = [
  {
    student: "Santiago Duarte Mejía",
    alertType: "riesgo_academico",
    severity: "alta",
    title: "Riesgo Académico",
    description: `El estudiante Santiago Duarte Mejía tiene nota final de ${score1(periodFinal("Santiago Duarte Mejía", "MAT", 3))} en Matemáticas durante Periodo 3. La nota está por debajo del mínimo (3.0).`,
    triggeredAt: `${addDays(REFERENCE_DATE, -12)}T07:00`,
    resolved: false,
  },
  {
    student: "Samuel Torres Quintero",
    alertType: "inasistencia_critica",
    severity: "media",
    title: "Inasistencia Crítica",
    description:
      "El estudiante Samuel Torres Quintero acumula 28% de inasistencias en los últimos 30 días.",
    triggeredAt: `${addDays(REFERENCE_DATE, -9)}T07:00`,
    resolved: false,
  },
  {
    student: lowestInGroup?.studentId ?? "Samuel Torres Quintero",
    alertType: "grupo_riesgo",
    severity: "alta",
    title: "Grupo en Riesgo: 6-02 Matemáticas",
    description: `El ${groupFailingRate}% del grupo 6-02 perdió Matemáticas en el Periodo 3 con la profesora Laura Martínez.`,
    triggeredAt: `${addDays(REFERENCE_DATE, -21)}T07:00`,
    resolved: false,
  },
  {
    student: "Mateo Ramírez Cruz",
    alertType: "riesgo_desercion",
    severity: "alta",
    title: "Riesgo de Deserción",
    description:
      "El estudiante Mateo Ramírez Cruz combina promedio bajo (2.8) con 22% de inasistencias en los últimos 30 días.",
    triggeredAt: `${addDays(REFERENCE_DATE, -7)}T07:00`,
    resolved: false,
  },
  {
    student: "Mariana López Sánchez",
    alertType: "tendencia_negativa",
    severity: "media",
    title: "Tendencia Negativa",
    description: `La nota de Lengua Castellana de Mariana López Sánchez bajó de ${score1(periodFinal("Mariana López Sánchez", "LEN", 2))} a ${score1(periodFinal("Mariana López Sánchez", "LEN", 3))} entre el Periodo 2 y el Periodo 3.`,
    triggeredAt: `${addDays(REFERENCE_DATE, -5)}T07:00`,
    resolved: false,
  },
  {
    student: "Isabella Gómez Herrera",
    alertType: "mejora_destacable",
    severity: "baja",
    title: "Mejora Destacable",
    description: `Isabella Gómez Herrera subió de ${score1(periodFinal("Isabella Gómez Herrera", "MAT", 2))} a ${score1(periodFinal("Isabella Gómez Herrera", "MAT", 3))} en Matemáticas entre el Periodo 2 y el Periodo 3.`,
    triggeredAt: `${addDays(REFERENCE_DATE, -20)}T07:00`,
    resolved: false,
  },
  {
    student: "Mariana López Sánchez",
    alertType: "tendencia_negativa",
    severity: "media",
    title: "Tendencia Negativa",
    description:
      "La nota de Ciencias Naturales de Mariana López Sánchez bajó 0.6 puntos entre el Periodo 1 y el Periodo 2.",
    triggeredAt: `${addDays(REFERENCE_DATE, -110)}T07:00`,
    resolved: true,
    resolvedDaysAgo: 95,
    resolvedBy: COORDINATOR,
    notes: "Se citó al acudiente; acordó plan de refuerzo",
  },
  {
    student: "Mateo Ramírez Cruz",
    alertType: "riesgo_academico",
    severity: "alta",
    title: "Riesgo Académico",
    description:
      "El estudiante Mateo Ramírez Cruz tiene nota final inferior a 3.0 en tres asignaturas durante Periodo 2.",
    triggeredAt: `${addDays(REFERENCE_DATE, -100)}T07:00`,
    resolved: true,
    resolvedDaysAgo: 80,
    resolvedBy: COORDINATOR,
    notes: "Se brindó plan de nivelación y seguimiento semanal con el director de grupo",
  },
  {
    student: "Daniela Moreno Cardona",
    alertType: "inasistencia_critica",
    severity: "media",
    title: "Inasistencia Crítica",
    description:
      "La estudiante Daniela Moreno Cardona acumuló 24% de inasistencias entre abril y mayo.",
    triggeredAt: `${addDays(REFERENCE_DATE, -140)}T07:00`,
    resolved: true,
    resolvedDaysAgo: 120,
    resolvedBy: USER_ID.coordinatorMain,
    notes: "Las ausencias correspondían a una incapacidad médica soportada",
  },
  {
    student: "Kevin Stiven Ortega Lozano",
    alertType: "riesgo_academico",
    severity: "alta",
    title: "Riesgo Académico",
    description:
      "El estudiante Kevin Stiven Ortega Lozano tiene nota final de 2.8 en Ciencias Naturales durante Periodo 1.",
    triggeredAt: `${addDays(REFERENCE_DATE, -170)}T07:00`,
    resolved: true,
    resolvedDaysAgo: 150,
    resolvedBy: USER_ID.coordinatorMain,
    notes: "Se citó al acudiente; acordó plan de refuerzo",
  },
];

export const alerts: Alert[] = ALERT_SEEDS.map((entry, index) => {
  const { student, resolvedDaysAgo, ...alert } = entry;
  return {
    ...alert,
    id: index + 1,
    studentId: typeof student === "number" ? student : studentIdByName(student),
    resolvedAt:
      resolvedDaysAgo === undefined
        ? undefined
        : `${addDays(REFERENCE_DATE, -resolvedDaysAgo)}T15:30`,
  };
});

/* ---------------------------- Achievements ----------------------------- */

const ACHIEVEMENT_ID = {
  superador: 1,
  excelencia: 2,
  asistencia_perfecta: 3,
  todo_terreno: 4,
  resiliente: 5,
  constancia: 6,
  companero: 7,
} as const;

type AchievementSeed = readonly [
  student: string,
  achievement: keyof typeof ACHIEVEMENT_ID,
  periodOrder: number,
  awardedBy?: number,
];

const ACHIEVEMENT_SEEDS: readonly AchievementSeed[] = [
  ["Valentina Rojas Pineda", "excelencia", 1],
  ["Valentina Rojas Pineda", "companero", 2],
  ["Valentina Rojas Pineda", "todo_terreno", 2],
  ["Valentina Rojas Pineda", "constancia", 3],
  ["Valentina Rojas Pineda", "asistencia_perfecta", 3],
  ["Camila Fernanda Ruiz Mora", "companero", 1],
  ["Camila Fernanda Ruiz Mora", "excelencia", 2],
  ["Camila Fernanda Ruiz Mora", "todo_terreno", 3],
  ["Camila Fernanda Ruiz Mora", "superador", 3],
  ["Sofía Castro Vega", "excelencia", 1],
  ["Sofía Castro Vega", "companero", 2],
  ["Sofía Castro Vega", "asistencia_perfecta", 3],
  ["Isabella Gómez Herrera", "superador", 3],
  ["Isabella Gómez Herrera", "resiliente", 3],
  ["Isabella Gómez Herrera", "companero", 3],
  ["Mariana López Sánchez", "companero", 2, COORDINATOR],
  ["Juan David Pérez Ortiz", "companero", 1],
  ["Tomás Ruiz Mora", "companero", 2],
  ["Daniela Moreno Cardona", "excelencia", 1],
  ["Natalia Andrea Cano Vélez", "todo_terreno", 2],
  ["Natalia Andrea Cano Vélez", "companero", 3],
  ["Martín Ávila Correa", "excelencia", 2],
  ["Carlos Eduardo Medina Suárez", "asistencia_perfecta", 2, COORDINATOR],
  ["Luciana Zapata Marín", "companero", 1],
  ["Emma Lucía Salgado Rey", "asistencia_perfecta", 3],
];

export const studentAchievements: StudentAchievement[] = ACHIEVEMENT_SEEDS.map(
  ([student, achievement, periodOrder, awardedBy], index) => {
    const period = periods.find((entry) => entry.order === periodOrder);
    return {
      id: index + 1,
      studentId: studentIdByName(student),
      achievementId: ACHIEVEMENT_ID[achievement],
      earnedAt: period?.endDate ?? REFERENCE_DATE,
      periodId: period?.id,
      awardedBy,
    };
  },
);

/* ---------------------------- Report cards ----------------------------- */

const REPORT_DATES: Record<number, { generated: string; delivery: readonly string[] }> = {
  1: { generated: "2026-04-06", delivery: ["2026-04-10", "2026-04-17", "2026-04-24"] },
  2: { generated: "2026-06-22", delivery: ["2026-06-26", "2026-07-03", "2026-07-10"] },
  3: { generated: "2026-09-21", delivery: ["2026-09-25", "2026-09-29"] },
};

const GENERAL_REMARKS = {
  Superior: [
    "Excelente desempeño académico y actitud ejemplar. Felicitaciones.",
    "Estudiante destacado; mantiene un alto nivel de compromiso y responsabilidad.",
  ],
  Alto: [
    "Buen desempeño general. Se recomienda continuar con el mismo ritmo de trabajo.",
    "Participa activamente y cumple con sus compromisos académicos.",
  ],
  Básico: [
    "Cumple con los mínimos esperados. Se sugiere reforzar el estudio en casa.",
    "Debe mejorar la constancia en la entrega de trabajos para alcanzar mejores resultados.",
  ],
  Bajo: [
    "Requiere acompañamiento familiar y plan de nivelación en las asignaturas con bajo desempeño.",
    "Se recomienda asistir a las tutorías y fortalecer los hábitos de estudio.",
  ],
} as const;

const SUBJECT_REMARKS = {
  positive: [
    "Muestra interés y buen trabajo en clase.",
    "Participa de forma activa y colaborativa.",
    "Entrega sus actividades con calidad y a tiempo.",
  ],
  support: [
    "Debe reforzar los conceptos trabajados en el periodo.",
    "Se recomienda mayor dedicación a las tareas en casa.",
    "Necesita fortalecer la atención durante las explicaciones.",
  ],
} as const;

export const reportCards: ReportCard[] = [];
export const reportCardObservations: ReportCardObservation[] = [];

(() => {
  const active = students.filter((student) => student.status === "activo" && student.gradeId);
  for (const period of periods.filter((entry) => entry.order <= 3)) {
    const dates = REPORT_DATES[period.order] as (typeof REPORT_DATES)[number];
    active.forEach((student, index) => {
      const finals = finalGrades.filter(
        (final) => final.studentId === student.id && final.periodId === period.id,
      );
      const mean = average(finals.map((final) => final.finalScore)) ?? 3;
      const level = performanceLevel(mean);
      const alwaysDelivered = studentName(student.id) === "Camila Fernanda Ruiz Mora";
      const delivered =
        alwaysDelivered ||
        period.order === 1 ||
        (period.order === 2 && index % 7 !== 3) ||
        (period.order === 3 && index < 2);
      const grade = grades.find((entry) => entry.id === student.gradeId);
      const card: ReportCard = {
        id: reportCards.length + 1,
        studentId: student.id,
        periodId: period.id,
        generatedAt: dates.generated,
        pdfPath: "/samples/boletin-ejemplo.pdf",
        generalObservation: rng.pick(GENERAL_REMARKS[level]),
        generatedBy: grade?.campusId === 2 ? USER_ID.coordinatorNorth : USER_ID.coordinatorMain,
        deliveryStatus: delivered ? "entregado" : "pendiente",
        deliveryDate: delivered ? dates.delivery[index % dates.delivery.length] : undefined,
      };
      reportCards.push(card);

      const commented = finals.slice(0, rng.int(2, 6));
      for (const final of commented) {
        reportCardObservations.push({
          id: reportCardObservations.length + 1,
          reportCardId: card.id,
          subjectGradeId: final.subjectGradeId,
          observation: rng.pick(
            final.finalScore >= 4 ? SUBJECT_REMARKS.positive : SUBJECT_REMARKS.support,
          ),
        });
      }
    });
  }
})();

/* ------------------------------- QR data ------------------------------- */

function uuid(): string {
  const hex = (length: number) =>
    Array.from({ length }, () => rng.int(0, 15).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${rng.pick(["8", "9", "a", "b"])}${hex(3)}-${hex(12)}`;
}

export const qrTokens: QRToken[] = users.map((user, index) => ({
  id: index + 1,
  userId: user.id,
  token: uuid(),
  isActive: true,
  createdAt: "2026-01-12",
  lastUsedAt: index % 3 === 0 ? `${addDays(REFERENCE_DATE, -(index % 6))}T07:10` : undefined,
}));

const QR_STATUS_PATTERN: readonly QRLogStatus[] = [
  "authorized",
  "authorized",
  "authorized",
  "wrong_schedule",
  "authorized",
  "authorized",
  "denied",
  "authorized",
  "authorized",
  "authorized",
  "wrong_schedule",
  "authorized",
  "authorized",
  "invalid_token",
  "authorized",
  "authorized",
  "denied",
  "authorized",
  "wrong_schedule",
  "authorized",
];

const QR_MESSAGES: Record<QRLogStatus, string> = {
  authorized: "Acceso autorizado",
  wrong_schedule: "Fuera de horario de clase",
  denied: "Ubicación no reconocida",
  invalid_token: "Código QR inválido",
};

export const qrAccessLogs: QRAccessLog[] = Array.from({ length: 40 }, (_, index) => {
  const status = QR_STATUS_PATTERN[index % QR_STATUS_PATTERN.length] as QRLogStatus;
  const person = students[(index * 7) % students.length];
  const classroom = classrooms[(index * 3) % classrooms.length];
  const simulated = index % 13 === 0;
  return {
    id: index + 1,
    userId: status === "invalid_token" ? undefined : person?.userId,
    classroomId: classroom?.id,
    timestamp: `${addDays(REFERENCE_DATE, -(index % 7))}T${String(6 + (index % 9)).padStart(2, "0")}:${String((index * 11) % 60).padStart(2, "0")}`,
    status,
    message: QR_MESSAGES[status],
    ipAddress: simulated ? "SIM-127.0.0.1" : `192.168.1.${20 + ((index * 5) % 200)}`,
  };
});
