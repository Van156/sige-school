import type { LinkProps } from "@tanstack/react-router";

/** A link card on a dashboard ("Acciones Rápidas", "Configuración del Sistema"). */
export type DashboardLink = {
  label: string;
  description: string;
  to: NonNullable<LinkProps["to"]>;
};

/**
 * DASH-02 "Acciones Rápidas" (sige/01 §5.3). Empty until the target screens exist: a module adds
 * its entry in the same change that creates its route, so the dashboard never shows a dead link.
 * Planned entries: Gestionar Estudiantes (STU-01), Matrícula y Programación (SCH-01), Ingresar
 * Notas (GRD-01), Generar Boletines (RPT-01), Ver Métricas (MET-01).
 */
export const managementQuickActions: readonly DashboardLink[] = [];

/**
 * DASH-02 "Configuración del Sistema" (sige/01 §5.3). Empty until the institution screens exist;
 * planned entries: Datos Institución, Gestión de Sedes, Gestión de Grados, Asignaturas, Periodos
 * Académicos, Criterios Evaluación.
 */
export const managementSystemLinks: readonly DashboardLink[] = [];
