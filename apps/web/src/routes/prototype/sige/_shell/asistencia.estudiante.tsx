import { createFileRoute } from "@tanstack/react-router";

import { StudentAttendanceScreen } from "../-screens/attendance/student-attendance-screen";

/** ATT-02 */
export const Route = createFileRoute("/prototype/sige/_shell/asistencia/estudiante")({
  component: StudentAttendanceScreen,
});
