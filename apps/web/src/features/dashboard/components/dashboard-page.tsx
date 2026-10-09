import { Link } from "@tanstack/react-router";
import { Button } from "@base-template/ui/components/button";

import { useSigeMe } from "@/app/use-nav-context";
import LoadError from "@/shared/components/feedback/load-error";
import Loader from "@/shared/components/feedback/loader";

import { managementQuickActions, managementSystemLinks } from "../lib/dashboard-links";
import { resolveDashboardView } from "../lib/dashboard-view";
import ManagementDashboard from "./management-dashboard";
import RoleDashboardPlaceholder from "./role-dashboard-placeholder";

/** `/dashboard`: picks the dashboard variant for the caller's `kind` (sige/01 DASH-R1). */
export default function DashboardPage() {
  const { data: me, isPending, isError, refetch } = useSigeMe();

  if (isPending) {
    return <Loader />;
  }
  if (isError) {
    return <LoadError message="No se pudo cargar su información." onRetry={() => refetch()} />;
  }

  const view = resolveDashboardView(me?.kind ?? null, me?.person.firstName ?? "");
  if (view.type === "management") {
    return (
      <ManagementDashboard
        institutionName={me?.org.name}
        impersonating={me?.impersonating ?? false}
        quickActions={managementQuickActions}
        systemLinks={managementSystemLinks}
      />
    );
  }
  return (
    <RoleDashboardPlaceholder
      title={view.title}
      description={view.description}
      action={
        me ? undefined : (
          <Button render={<Link to="/admin/instituciones" />} variant="outline">
            Gestionar instituciones
          </Button>
        )
      }
    />
  );
}
