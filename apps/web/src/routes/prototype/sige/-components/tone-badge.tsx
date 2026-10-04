import { Badge } from "@base-template/ui/components/badge";
import type { ReactNode } from "react";

import type { PerformanceLevel, Role, Severity } from "../-mock/types";
import { LEVEL_TONE, SEVERITY_TONE, capitalize } from "../-lib/format";
import { ROLE_LABEL, ROLE_TONE, type BadgeTone } from "../-lib/roles";

/** Semantic status badge: tone maps onto the design-system badge variants. */
export function ToneBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <Badge variant={tone}>{children}</Badge>;
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>;
}

export function LevelBadge({ level }: { level: PerformanceLevel }) {
  return <Badge variant={LEVEL_TONE[level]}>{level}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge variant={SEVERITY_TONE[severity]}>{capitalize(severity)}</Badge>;
}
