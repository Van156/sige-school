import { createFileRoute } from "@tanstack/react-router";

import { StudentProfileScreen } from "../-screens/students/student-profile-screen";

/** STU-02 */
export const Route = createFileRoute("/prototype/sige/_shell/estudiantes/perfil")({
  component: StudentProfileScreen,
});
