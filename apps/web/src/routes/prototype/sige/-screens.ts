import type { LinkProps } from "@tanstack/react-router";

import type { Role } from "./-mock/types";

/**
 * Single source of truth for the 94 SISTEMA_ESCOLAR screens (inventory 3.x / Appendix C).
 *
 * Add a screen in three steps:
 * 1. Create the route file under `sige/_shell/` (thin) and its component under `-screens/`.
 * 2. Flip its row below from `pending(...)` to `built(..., { to: "/prototype/sige/..." })`; `to` is
 *    type-checked against the generated route tree. Add `params` for `$param` routes.
 * 3. Done: the nav, the screen index, breadcrumbs and the "Pantalla pendiente" placeholder all read
 *    this file.
 */

export type SigeRoutePath = Extract<NonNullable<LinkProps["to"]>, `/prototype/sige${string}`>;

export type ModuleKey =
  | "AUTH"
  | "DASH"
  | "INS"
  | "USR"
  | "SCH"
  | "STU"
  | "GRD"
  | "ATT"
  | "OBS"
  | "RPT"
  | "MET"
  | "ACH"
  | "ALR"
  | "PAR"
  | "QR";

export const MODULE_LABEL: Record<ModuleKey, string> = {
  AUTH: "Autenticación, perfil y errores",
  DASH: "Dashboards",
  INS: "Institución",
  USR: "Usuarios",
  SCH: "Matrícula y Programación",
  STU: "Estudiantes",
  GRD: "Notas",
  ATT: "Asistencia",
  OBS: "Observaciones",
  RPT: "Boletines",
  MET: "Métricas",
  ACH: "Logros",
  ALR: "Alertas Tempranas",
  PAR: "Portal de Acudientes",
  QR: "Acceso por QR",
};

export const MODULE_ORDER: readonly ModuleKey[] = Object.keys(MODULE_LABEL) as ModuleKey[];

export interface ScreenRoute {
  to: SigeRoutePath;
  /** Values for `$param` segments, e.g. `{ code: "404" }`. */
  params?: Record<string, string>;
  /** Role that must be active when the screen is the role's dashboard (several screens share a route). */
  asRole?: Role;
}

export type ScreenDef = {
  id: string;
  module: ModuleKey;
  title: string;
  roles: readonly Role[];
} & ({ status: "pending" } | ({ status: "built" } & ScreenRoute));

const ALL: readonly Role[] = [
  "root",
  "admin",
  "coordinator",
  "teacher",
  "student",
  "parent",
  "viewer",
];
const ROOT: readonly Role[] = ["root"];
const RA: readonly Role[] = ["root", "admin"];
const RAC: readonly Role[] = ["root", "admin", "coordinator"];
const RACT: readonly Role[] = ["root", "admin", "coordinator", "teacher"];
const RACTS: readonly Role[] = [...RACT, "student"];
const RACTSP: readonly Role[] = [...RACTS, "parent"];
const ADMIN: readonly Role[] = ["root", "admin"];
const PARENT: readonly Role[] = ["parent"];

function moduleOf(id: string): ModuleKey {
  return id.split("-")[0] as ModuleKey;
}

function pending(id: string, title: string, roles: readonly Role[]): ScreenDef {
  return { id, module: moduleOf(id), title, roles, status: "pending" };
}

function built(id: string, title: string, roles: readonly Role[], route: ScreenRoute): ScreenDef {
  return { id, module: moduleOf(id), title, roles, status: "built", ...route };
}

const DASHBOARD = "/prototype/sige/dashboard" as const;

export const screens: readonly ScreenDef[] = [
  // Authentication, profile, errors
  built("AUTH-01", "Iniciar sesión", ALL, { to: "/prototype/sige/auth/login" }),
  built("AUTH-02", "Cerrar sesión (acción del menú de usuario)", ALL, {
    to: "/prototype/sige/auth/login",
  }),
  built("AUTH-03", "Cambiar contraseña (primer acceso)", ALL, {
    to: "/prototype/sige/auth/cambiar-contrasena",
  }),
  built("AUTH-04", "Mi perfil", ALL, { to: "/prototype/sige/perfil" }),
  built("AUTH-05", "Páginas de error (400, 401, 403, 404, 413, 429, 500)", ALL, {
    to: "/prototype/sige/error/$code",
    params: { code: "404" },
  }),

  // Dashboards
  built("DASH-01", "Panel de Administración General", ROOT, { to: DASHBOARD, asRole: "root" }),
  built("DASH-02", "Dashboard Administrador", RA, { to: DASHBOARD, asRole: "admin" }),
  built("DASH-03", "Dashboard Coordinador", ["coordinator"], {
    to: DASHBOARD,
    asRole: "coordinator",
  }),
  built("DASH-04", "Dashboard Profesor", ["teacher"], { to: DASHBOARD, asRole: "teacher" }),
  built("DASH-05", "Mi Dashboard", ["student"], { to: DASHBOARD, asRole: "student" }),
  built("DASH-06", "Dashboard de Acudiente", PARENT, { to: DASHBOARD, asRole: "parent" }),
  built("DASH-07", "Dashboard de Consulta", ["viewer"], { to: DASHBOARD, asRole: "viewer" }),

  // Institution
  pending("INS-01", "Gestión de Instituciones", ROOT),
  pending("INS-02", "Nueva / Editar Institución", ROOT),
  pending("INS-03", "Seleccionar Institución", ROOT),
  pending("INS-04", "Usuarios de la institución", ROOT),
  pending("INS-05", "Crear usuario en la institución", ROOT),
  pending("INS-06", "Configuración de Institución", RA),
  pending("INS-07", "Gestión de Sedes", RAC),
  pending("INS-08", "Nueva / Editar Sede", RA),
  pending("INS-09", "Niveles Académicos", RAC),
  pending("INS-10", "Nuevo / Editar Nivel Académico", RA),
  pending("INS-11", "Gestión de Grados (Cursos)", RAC),
  pending("INS-12", "Nuevo / Editar Grado", RA),
  pending("INS-13", "Asignaturas", RACT),
  pending("INS-14", "Nueva / Editar Asignatura", RA),
  pending("INS-15", "Periodos Académicos", RAC),
  pending("INS-16", "Nuevo / Editar Periodo", RA),
  pending("INS-17", "Criterios de Evaluación", RACT),
  pending("INS-18", "Nuevo / Editar Criterio", RA),

  // Users
  pending("USR-01", "Gestión de Usuarios", ADMIN),
  pending("USR-02", "Crear Nuevo Usuario", ADMIN),
  pending("USR-03", "Editar Usuario", ADMIN),
  pending("USR-04", "Importar Usuarios desde Excel", ADMIN),

  // Matrícula y Programación
  pending("SCH-01", "Matrículas de Estudiantes", RAC),
  pending("SCH-02", "Nueva / Editar Matrícula", RAC),
  pending("SCH-03", "Asignación de Profesores", RAC),
  pending("SCH-04", "Nueva / Editar Asignación", RAC),
  pending("SCH-05", "Materias por Grado", RAC),
  pending("SCH-06", "Asignar Materias a Grados", RAC),
  pending("SCH-07", "Gestión de Salones", RAC),
  pending("SCH-08", "Nuevo / Editar Salón", RAC),
  pending("SCH-09", "Bloques de Tiempo", RAC),
  pending("SCH-10", "Nuevo / Editar Bloque de Tiempo", RAC),
  pending("SCH-11", "Horarios de Clases", RACTS),
  pending("SCH-12", "Generar Horario Automático", RAC),

  // Students
  pending("STU-01", "Gestión de Estudiantes", RACT),
  pending("STU-02", "Perfil del Estudiante", RACT),
  pending("STU-03", "Nuevo / Editar Estudiante", RAC),
  pending("STU-04", "Asignar Acudientes", RAC),
  pending("STU-05", "Cargar Estudiantes desde Excel", RAC),

  // Grades
  pending("GRD-01", "Ingreso de Notas: selección", RACT),
  pending("GRD-02", "Planilla de Calificaciones", RACT),
  pending("GRD-03", "Carga Masiva de Notas desde Excel", RACT),
  pending("GRD-04", "Panel de Bloqueo de Periodos", RAC),
  pending("GRD-05", "Notas Finales del Periodo", RACT),
  pending("GRD-06", "Notas Anuales", RACT),
  pending("GRD-07", "Resumen de Notas", RACT),
  pending("GRD-08", "Notas del Estudiante", RACTSP),

  // Attendance
  pending("ATT-01", "Tomar Asistencia", RACT),
  pending("ATT-02", "Historial de Asistencia", RACTS),
  pending("ATT-03", "Resumen de Asistencia", RACT),
  pending("ATT-04", "Reporte de Asistencia", RACT),

  // Observations
  pending("OBS-01", "Observaciones de Comportamiento", RACT),
  pending("OBS-02", "Detalle de Observación", RACT),
  pending("OBS-03", "Nueva / Editar Observación", RACT),
  pending("OBS-04", "Observación Rápida", RACT),
  pending("OBS-05", "Historial de Observaciones", RACTS),

  // Report cards
  pending("RPT-01", "Gestión de Boletines", RAC),
  pending("RPT-02", "Generar Boletín de Calificaciones", RACTS),
  pending("RPT-03", "Historial de Boletines", RACTS),
  pending("RPT-04", "Boletín (vista de impresión / PDF)", RACTSP),

  // Metrics
  pending("MET-01", "Métricas Institucionales", RAC),
  pending("MET-02", "Mapa de Calor de Rendimiento", RAC),
  pending("MET-03", "Tendencias Académicas", RAC),
  pending("MET-04", "Comparativa Anónima de Docentes", RAC),
  pending("MET-05", "Métricas del Docente", RACT),
  pending("MET-06", "Asistencia vs Rendimiento", RACT),
  pending("MET-07", "Estudiantes en Riesgo", RACT),

  // Achievements
  pending("ACH-01", "Logros y Gamificación", RACT),
  pending("ACH-02", "Logros del Estudiante", RACTSP),
  pending("ACH-03", "Ranking Estudiantil", RACTSP),

  // Alerts
  pending("ALR-01", "Alertas Tempranas", RAC),
  pending("ALR-02", "Detalle de Alerta", RAC),
  pending("ALR-03", "Ejecutar Motor de Alertas", RAC),

  // Parent portal
  pending("PAR-01", "Portal de Acudientes", PARENT),
  pending("PAR-02", "Notas del hijo/a", PARENT),
  pending("PAR-03", "Asistencia del hijo/a", PARENT),
  pending("PAR-04", "Observaciones del hijo/a", PARENT),
  pending("PAR-05", "Boletines del hijo/a", PARENT),
  pending("PAR-06", "Logros del hijo/a", PARENT),

  // QR access
  pending("QR-01", "Mi Código QR (Identidad Digital)", ALL),
  pending("QR-02", "Simulador de Hardware QR", ROOT),
  pending("QR-03", "Monitoreo de Accesos QR", RAC),
];

export const screenById: ReadonlyMap<string, ScreenDef> = new Map(
  screens.map((screen) => [screen.id, screen]),
);

export function screensOfModule(module: ModuleKey): ScreenDef[] {
  return screens.filter((screen) => screen.module === module);
}

export function builtCount(): number {
  return screens.filter((screen) => screen.status === "built").length;
}

/** Landing dashboard of each role (the nav "Dashboard" item and the role switcher target). */
export const dashboardScreenId: Record<Role, string> = {
  root: "DASH-01",
  admin: "DASH-02",
  coordinator: "DASH-03",
  teacher: "DASH-04",
  student: "DASH-05",
  parent: "DASH-06",
  viewer: "DASH-07",
};

export const PENDING_ROUTE = "/prototype/sige/pendiente/$screenId" as const;

export interface ScreenHref {
  to: SigeRoutePath;
  params?: Record<string, string>;
  /** Overrides the active role when the link is a role-specific dashboard. */
  asRole?: Role;
}

/** Where a screen lives: its own route when built, the shared placeholder otherwise. */
export function hrefFor(screen: ScreenDef): ScreenHref {
  if (screen.status === "built") {
    return { to: screen.to, params: screen.params, asRole: screen.asRole };
  }
  return { to: PENDING_ROUTE, params: { screenId: screen.id } };
}

const PENDING_PATH = /^\/prototype\/sige\/pendiente\/([^/]+)\/?$/;

function routePattern(to: string): RegExp {
  const source = to
    .replace(/\/$/, "")
    .split("/")
    .map((segment) =>
      segment.startsWith("$") ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^${source}/?$`);
}

/** Resolves the screen shown at `pathname` (placeholder routes resolve to the pending screen). */
export function matchScreen(pathname: string, role: Role): ScreenDef | undefined {
  const pendingId = PENDING_PATH.exec(pathname)?.[1];
  if (pendingId) return screenById.get(decodeURIComponent(pendingId));

  let best: ScreenDef | undefined;
  for (const screen of screens) {
    if (screen.status !== "built") continue;
    if (screen.asRole && screen.asRole !== role) continue;
    if (!routePattern(screen.to).test(pathname)) continue;
    if (!best || best.status !== "built" || screen.to.length > best.to.length) best = screen;
  }
  return best;
}
