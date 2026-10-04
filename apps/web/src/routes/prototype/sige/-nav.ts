import {
  Bell,
  Building2,
  CalendarCheck,
  CalendarRange,
  ChartColumn,
  ClipboardList,
  FileText,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  NotebookPen,
  QrCode,
  ScanLine,
  Trophy,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "./-mock/types";

/**
 * Per-role sidebar (inventory 1.2). Items point at screen ids; `-screens.ts` decides whether the
 * target is a real route or the "Pantalla pendiente" placeholder.
 */

export interface NavLeaf {
  label: string;
  screenId: string;
  /** Extra search params, e.g. the user-list role filter. */
  filter?: Record<string, string>;
  roles: readonly Role[];
  /** Shows the open-alerts counter next to the label. */
  badge?: "alerts";
}

export interface NavParent {
  label: string;
  icon: LucideIcon;
  roles: readonly Role[];
  children: readonly NavLeaf[];
}

export interface NavEntry {
  label: string;
  icon: LucideIcon;
  leaf?: NavLeaf;
  parent?: NavParent;
}

export interface NavSection {
  label?: string;
  entries: readonly NavEntry[];
}

const ALL: readonly Role[] = [
  "root",
  "admin",
  "coordinator",
  "teacher",
  "student",
  "parent",
  "viewer",
];
const RA: readonly Role[] = ["root", "admin"];
const RAC: readonly Role[] = ["root", "admin", "coordinator"];
const RACT: readonly Role[] = ["root", "admin", "coordinator", "teacher"];

function leafEntry(icon: LucideIcon, leaf: NavLeaf): NavEntry {
  return { label: leaf.label, icon, leaf };
}

function parentEntry(parent: NavParent): NavEntry {
  return { label: parent.label, icon: parent.icon, parent };
}

function child(
  label: string,
  screenId: string,
  roles: readonly Role[],
  filter?: Record<string, string>,
): NavLeaf {
  return { label, screenId, roles, filter };
}

export const navSections: readonly NavSection[] = [
  {
    entries: [
      leafEntry(LayoutDashboard, { label: "Dashboard", screenId: "DASH-01", roles: ["root"] }),
      leafEntry(LayoutDashboard, { label: "Dashboard", screenId: "DASH-02", roles: ["admin"] }),
      leafEntry(LayoutDashboard, {
        label: "Dashboard",
        screenId: "DASH-03",
        roles: ["coordinator"],
      }),
      leafEntry(LayoutDashboard, { label: "Dashboard", screenId: "DASH-04", roles: ["teacher"] }),
      leafEntry(LayoutDashboard, { label: "Dashboard", screenId: "DASH-05", roles: ["student"] }),
      leafEntry(LayoutDashboard, { label: "Dashboard", screenId: "DASH-06", roles: ["parent"] }),
      leafEntry(LayoutDashboard, { label: "Dashboard", screenId: "DASH-07", roles: ["viewer"] }),
    ],
  },
  {
    label: "Gestión",
    entries: [
      parentEntry({
        label: "Institución",
        icon: Building2,
        roles: RA,
        children: [
          child("Gestionar Instituciones", "INS-01", ["root"]),
          child("Datos Institución", "INS-06", ["admin"]),
          child("Sedes", "INS-07", RA),
          child("Niveles Académicos", "INS-09", RA),
          child("Cursos", "INS-11", RA),
          child("Asignaturas", "INS-13", RA),
          child("Periodos", "INS-15", RA),
          child("Criterios Evaluación", "INS-17", RA),
        ],
      }),
      parentEntry({
        label: "Usuarios",
        icon: UsersRound,
        roles: RA,
        children: [
          child("Todos", "USR-01", RA),
          child("Profesores", "USR-01", RA, { rol: "teacher" }),
          child("Coordinadores", "USR-01", RA, { rol: "coordinator" }),
          child("Estudiantes", "USR-01", RA, { rol: "student" }),
          child("Acudientes", "USR-01", RA, { rol: "parent" }),
          child("Nuevo Usuario", "USR-02", RA),
        ],
      }),
      parentEntry({
        label: "Matrícula y Programación",
        icon: CalendarRange,
        roles: RAC,
        children: [
          child("Matrículas", "SCH-01", RAC),
          child("Asignar Profesores", "SCH-03", RAC),
          child("Materias por Grado", "SCH-05", RAC),
          child("Salones", "SCH-07", RAC),
          child("Horarios", "SCH-11", RAC),
          child("Bloques Horarios", "SCH-09", RAC),
        ],
      }),
    ],
  },
  {
    label: "Académico",
    entries: [
      leafEntry(CalendarRange, { label: "Mi Horario", screenId: "SCH-11", roles: ["student"] }),
      leafEntry(GraduationCap, { label: "Estudiantes", screenId: "STU-01", roles: RACT }),
      leafEntry(NotebookPen, { label: "Notas", screenId: "GRD-01", roles: RACT }),
      leafEntry(NotebookPen, { label: "Mis Notas", screenId: "GRD-08", roles: ["student"] }),
      leafEntry(CalendarCheck, { label: "Asistencia", screenId: "ATT-01", roles: RACT }),
      leafEntry(CalendarCheck, { label: "Mi Asistencia", screenId: "ATT-02", roles: ["student"] }),
      leafEntry(ClipboardList, { label: "Observaciones", screenId: "OBS-01", roles: RACT }),
      leafEntry(ClipboardList, {
        label: "Mis Observaciones",
        screenId: "OBS-05",
        roles: ["student"],
      }),
      leafEntry(FileText, { label: "Boletines", screenId: "RPT-01", roles: RAC }),
      leafEntry(ChartColumn, { label: "Métricas", screenId: "MET-01", roles: RAC }),
      leafEntry(ChartColumn, { label: "Métricas", screenId: "MET-05", roles: ["teacher"] }),
      leafEntry(Trophy, { label: "Logros", screenId: "ACH-01", roles: RACT }),
      leafEntry(Trophy, { label: "Mis Logros", screenId: "ACH-02", roles: ["student"] }),
      leafEntry(Bell, {
        label: "Alertas Tempranas",
        screenId: "ALR-01",
        roles: RAC,
        badge: "alerts",
      }),
    ],
  },
  {
    label: "Familia",
    entries: [
      leafEntry(HeartHandshake, { label: "Portal Padres", screenId: "PAR-01", roles: ["parent"] }),
    ],
  },
  {
    label: "Acceso",
    entries: [
      leafEntry(ScanLine, { label: "Monitoreo QR", screenId: "QR-03", roles: RAC }),
      leafEntry(QrCode, { label: "Mi Código QR", screenId: "QR-01", roles: ALL }),
    ],
  },
];

export interface VisibleNavEntry extends NavEntry {
  visibleChildren?: readonly NavLeaf[];
}

export interface VisibleNavSection {
  label?: string;
  entries: readonly VisibleNavEntry[];
}

/** Sections and entries the role can see; empty parents and sections are dropped. */
export function navForRole(role: Role): VisibleNavSection[] {
  return navSections
    .map((section) => ({
      label: section.label,
      entries: section.entries.flatMap((entry): VisibleNavEntry[] => {
        if (entry.leaf) return entry.leaf.roles.includes(role) ? [entry] : [];
        if (!entry.parent?.roles.includes(role)) return [];
        const visibleChildren = entry.parent.children.filter((item) => item.roles.includes(role));
        return visibleChildren.length > 0 ? [{ ...entry, visibleChildren }] : [];
      }),
    }))
    .filter((section) => section.entries.length > 0);
}
