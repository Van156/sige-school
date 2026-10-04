/**
 * Domain contracts for the SIGE prototype (inventory Appendix B). Later tasks extend the dataset
 * with new collections or derived views; these shapes stay stable.
 */

export type Role = "root" | "admin" | "coordinator" | "teacher" | "student" | "parent" | "viewer";
export type Shift = "Mañana" | "Tarde" | "Nocturna" | "Única" | "Sabatina";
export type CampusJornada = "manana" | "tarde" | "completa";
export type DocType = "TI" | "CC" | "RC" | "CE" | "Pasaporte";
export type StudentStatus = "activo" | "retirado" | "graduado";
export type FinalStatus = "ganada" | "perdida" | "no evaluado";
export type AnnualStatus = "aprobado" | "reprobado" | "no evaluado";
export type AttendanceStatus = "presente" | "ausente" | "justificado" | "excusado";
export type ObservationType = "positiva" | "negativa" | "seguimiento" | "convivencia";
export type AlertType =
  | "riesgo_academico"
  | "tendencia_negativa"
  | "inasistencia_critica"
  | "grupo_riesgo"
  | "riesgo_desercion"
  | "mejora_destacable";
export type Severity = "alta" | "media" | "baja";
export type EnrollmentStatus = "activa" | "cancelada" | "retirada";
export type AssignmentStatus = "activo" | "inactivo" | "temporal";
export type ClassroomType = "aula" | "laboratorio" | "auditorio" | "cancha";
export type DeliveryStatus = "pendiente" | "entregado";
export type QRLogStatus = "authorized" | "denied" | "invalid_token" | "wrong_schedule";
export type PerformanceLevel = "Superior" | "Alto" | "Básico" | "Bajo";
export type AchievementCategory = "académico" | "mejora" | "asistencia" | "comportamiento";

/** ISO calendar date (`2026-10-05`) or local date-time (`2026-10-05T09:30`). */
export type IsoDate = string;

export interface Institution {
  id: number;
  name: string;
  nit?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  municipality?: string;
  department?: string;
  resolution?: string;
  academicYear: string;
  createdAt: IsoDate;
}

export interface Campus {
  id: number;
  institutionId: number;
  name: string;
  code?: string;
  address?: string;
  jornada: CampusJornada;
  isMainCampus: boolean;
  active: boolean;
  createdAt: IsoDate;
}

export interface GradeLevel {
  id: number;
  campusId: number;
  name: string;
  orderNum: number;
}

export interface Grade {
  id: number;
  campusId: number;
  levelId?: number;
  directorId?: number;
  name: string;
  academicYear: string;
  shift: Shift;
  maxStudents: number;
}

export interface Subject {
  id: number;
  institutionId: number;
  name: string;
  code?: string;
}

export interface SubjectGrade {
  id: number;
  subjectId: number;
  gradeId: number;
  teacherId: number;
  hoursPerWeek: number;
}

export interface AcademicPeriod {
  id: number;
  institutionId: number;
  name: string;
  shortName: string;
  startDate: IsoDate;
  endDate: IsoDate;
  isActive: boolean;
  academicYear: string;
  order: number;
}

export interface GradeCriteria {
  id: number;
  institutionId: number;
  name: string;
  weight: number;
  description?: string;
  order: number;
}

export interface User {
  id: number;
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  documentType: DocType;
  documentNumber: string;
  birthDate?: IsoDate;
  gender?: "M" | "F" | "Otro";
  phone?: string;
  address?: string;
  country?: string;
  department?: string;
  municipality?: string;
  role: Role;
  institutionId?: number;
  photo?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin?: IsoDate;
  createdAt: IsoDate;
}

export interface AcademicStudent {
  id: number;
  userId: number;
  institutionId: number;
  campusId: number;
  gradeId?: number;
  neighborhood?: string;
  stratum?: 1 | 2 | 3 | 4 | 5 | 6;
  bloodType?: string;
  eps?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  enrolledYear?: string;
  status: StudentStatus;
}

export interface ParentStudent {
  id: number;
  parentId: number;
  studentId: number;
  relationship: string;
}

export interface StudentEnrollment {
  id: number;
  studentId: number;
  subjectGradeId: number;
  academicYear: string;
  enrollmentDate: IsoDate;
  status: EnrollmentStatus;
  finalScore?: number;
  statusNote?: string;
}

export interface TeacherSubjectAssignment {
  id: number;
  subjectGradeId: number;
  teacherId: number;
  academicYear: string;
  assignmentDate: IsoDate;
  status: AssignmentStatus;
  notes?: string;
}

export interface Classroom {
  id: number;
  campusId: number;
  name: string;
  code?: string;
  capacity: number;
  floor: number;
  building?: string;
  classroomType: ClassroomType;
  resources?: string;
}

export interface ScheduleBlock {
  id: number;
  campusId: number;
  name: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  orderNum: number;
  shift: Shift;
  academicYear: string;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4;

export interface Schedule {
  id: number;
  subjectGradeId: number;
  classroomId: number;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  academicYear: string;
  isActive: boolean;
}

export interface GradeRecord {
  id: number;
  studentId: number;
  subjectGradeId: number;
  periodId: number;
  criterionId: number;
  score: number;
  observation?: string;
  createdBy: number;
  locked: boolean;
}

export interface FinalGrade {
  id: number;
  studentId: number;
  subjectGradeId: number;
  periodId: number;
  finalScore: number;
  status: FinalStatus;
  observation?: string;
  calculatedAt: IsoDate;
}

export interface AnnualGrade {
  id: number;
  studentId: number;
  subjectGradeId: number;
  academicYear: string;
  annualScore: number;
  status: AnnualStatus;
}

export interface Attendance {
  id: number;
  studentId: number;
  subjectGradeId: number;
  date: IsoDate;
  status: AttendanceStatus;
  observation?: string;
  recordedBy: number;
}

export interface Observation {
  id: number;
  studentId: number;
  authorId: number;
  type: ObservationType;
  category?: string;
  description: string;
  date: IsoDate;
  commitments?: string;
  notified: boolean;
}

export interface Alert {
  id: number;
  studentId: number;
  alertType: AlertType;
  severity: Severity;
  title: string;
  description: string;
  triggeredAt: IsoDate;
  resolved: boolean;
  resolvedAt?: IsoDate;
  resolvedBy?: number;
  notes?: string;
}

export interface Achievement {
  id: number;
  institutionId?: number;
  name: string;
  description: string;
  icon: string;
  criteria: string;
  category: AchievementCategory;
  isActive: boolean;
}

export interface StudentAchievement {
  id: number;
  studentId: number;
  achievementId: number;
  earnedAt: IsoDate;
  periodId?: number;
  awardedBy?: number;
}

export interface ReportCard {
  id: number;
  studentId: number;
  periodId: number;
  generatedAt: IsoDate;
  pdfPath?: string;
  generalObservation?: string;
  generatedBy: number;
  deliveryStatus: DeliveryStatus;
  deliveryDate?: IsoDate;
}

export interface ReportCardObservation {
  id: number;
  reportCardId: number;
  subjectGradeId: number;
  observation: string;
}

export interface QRToken {
  id: number;
  userId: number;
  token: string;
  isActive: boolean;
  createdAt: IsoDate;
  lastUsedAt?: IsoDate;
}

export interface QRAccessLog {
  id: number;
  userId?: number;
  classroomId?: number;
  timestamp: IsoDate;
  status: QRLogStatus;
  message?: string;
  ipAddress?: string;
}

/** Aggregate counts for institutions that only exist to populate root-level lists. */
export interface InstitutionSummary {
  institutionId: number;
  admins: number;
  campuses: number;
  teachers: number;
  students: number;
  users: number;
}
