import { Badge } from "@base-template/ui/components/badge";
import {
  BookX,
  CalendarX,
  ChartNoAxesCombined,
  TrendingDown,
  TrendingUp,
  UserX,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { ALERT_TYPE_LABEL } from "../-mock";
import type { AlertType } from "../-mock/types";

export const ALERT_TYPE_ICON: Record<AlertType, LucideIcon> = {
  riesgo_academico: BookX,
  tendencia_negativa: TrendingDown,
  inasistencia_critica: CalendarX,
  grupo_riesgo: UsersRound,
  riesgo_desercion: UserX,
  mejora_destacable: TrendingUp,
};

/** Chart colour per alert type (alerts-by-type bar chart). */
export const ALERT_TYPE_COLOR: Record<AlertType, string> = {
  riesgo_academico: "var(--chart-1)",
  tendencia_negativa: "var(--chart-2)",
  inasistencia_critica: "var(--chart-3)",
  grupo_riesgo: "var(--chart-4)",
  riesgo_desercion: "var(--chart-5)",
  mejora_destacable: "var(--success)",
};

/** Short axis labels of the alerts-by-type chart. */
export const ALERT_TYPE_SHORT: Record<AlertType, string> = {
  riesgo_academico: "Académico",
  tendencia_negativa: "Tendencia",
  inasistencia_critica: "Inasistencia",
  grupo_riesgo: "Grupo",
  riesgo_desercion: "Deserción",
  mejora_destacable: "Mejora",
};

export function AlertTypeBadge({ type }: { type: AlertType }) {
  const Icon = ALERT_TYPE_ICON[type] ?? ChartNoAxesCombined;
  return (
    <Badge variant="outline">
      <Icon />
      {ALERT_TYPE_LABEL[type]}
    </Badge>
  );
}

export function AlertStatusBadge({ resolved }: { resolved: boolean }) {
  return (
    <Badge variant={resolved ? "success" : "warning"}>{resolved ? "Resuelta" : "Activa"}</Badge>
  );
}
