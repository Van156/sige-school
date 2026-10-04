import { useRole } from "../../-lib/use-role";
import { AdminDashboard } from "./admin-dashboard";
import { CoordinatorDashboard } from "./coordinator-dashboard";
import { ParentDashboard } from "./parent-dashboard";
import { RootDashboard } from "./root-dashboard";
import { StudentDashboard } from "./student-dashboard";
import { TeacherDashboard } from "./teacher-dashboard";
import { ViewerDashboard } from "./viewer-dashboard";

/** DASH-01..07: picks the dashboard of the active `?role=`. */
export function DashboardScreen() {
  const role = useRole();
  switch (role) {
    case "root":
      return <RootDashboard />;
    case "admin":
      return <AdminDashboard />;
    case "coordinator":
      return <CoordinatorDashboard />;
    case "teacher":
      return <TeacherDashboard />;
    case "student":
      return <StudentDashboard />;
    case "parent":
      return <ParentDashboard />;
    case "viewer":
      return <ViewerDashboard />;
  }
}
