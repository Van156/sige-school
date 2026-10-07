import type { NavKind } from "@/app/navigation";

/** Which dashboard `/dashboard` renders (sige/01 DASH-R1: decided by `kind`). */
export type DashboardView =
  | { type: "management" }
  | { type: "placeholder"; title: string; description: string };

const PLACEHOLDER_TITLES: Record<Exclude<NavKind, "owner" | "admin">, string> = {
  coordinator: "Dashboard Coordinador",
  teacher: "Dashboard Profesor",
  student: "Mi Dashboard",
  parent: "Portal de Acudientes",
  viewer: "Dashboard de Consulta",
  custom: "Dashboard",
};

/**
 * Owner and admin land on DASH-02. The other kinds' dashboards (DASH-03…07) are not built yet:
 * they get an honest neutral state with their screen title. A user without a SIGE kind (a platform
 * admin) gets the root dashboard title.
 */
export function resolveDashboardView(kind: NavKind | null, name: string): DashboardView {
  if (kind === "owner" || kind === "admin") {
    return { type: "management" };
  }
  if (kind === null) {
    return {
      type: "placeholder",
      title: "Panel de Administración General",
      description: "Gestión centralizada de todas las instituciones educativas",
    };
  }
  return {
    type: "placeholder",
    title: PLACEHOLDER_TITLES[kind],
    description: name ? `Bienvenido/a, ${name}` : "Bienvenido/a",
  };
}
