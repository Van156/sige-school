import { Badge } from "@base-template/ui/components/badge";

import { roleKindLabel, roleKindTone, type RoleKind } from "@/shared/lib/role-label";

/** Role as a coloured badge (labels and tones from sige/01 §5.2). Presentational. */
export default function RoleBadge({ role }: { role: RoleKind }) {
  return <Badge variant={roleKindTone(role)}>{roleKindLabel(role)}</Badge>;
}
