import { Badge } from "@base-template/ui/components/badge";

import { STUDENT_STATUS_LABELS, STUDENT_STATUS_VARIANTS } from "../lib/student-status";
import type { StudentStatus } from "../types";

/** A student's status as a coloured badge (sige/05 §5.6). Presentational. */
export default function StatusBadge({ status }: { status: StudentStatus }) {
  return <Badge variant={STUDENT_STATUS_VARIANTS[status]}>{STUDENT_STATUS_LABELS[status]}</Badge>;
}
