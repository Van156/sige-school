import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { brand } from "@/app/brand";
import { navGroups, resolveDisplayRole } from "@/app/navigation";
import { useNavContext } from "@/app/use-nav-context";
import { ImpersonationBanner } from "@/features/admin";
import { UserMenu } from "@/features/auth";
import { OrgSwitcher } from "@/features/organizations";
import AppBreadcrumbs from "@/shared/components/layout/app-breadcrumbs";
import AppShell from "@/shared/components/layout/app-shell";
import { ModeToggle } from "@/shared/components/layout/mode-toggle";
import SidebarBrand from "@/shared/components/layout/sidebar-brand";
import { filterNavGroups, getBreadcrumbs } from "@/shared/lib/navigation";
import { roleKindLabel, roleKindTone } from "@/shared/lib/role-label";

/**
 * Wires the presentational `AppShell` to the app: nav config, the role-aware visibility context,
 * the SIGE brand and (for platform admins only) the organization switcher, the user menu with its
 * role badge, the breadcrumb derived from the nav config and the impersonation banner.
 */
export default function AuthenticatedShell({ children }: { children: ReactNode }) {
  const navContext = useNavContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const breadcrumbs = getBreadcrumbs(filterNavGroups(navGroups, navContext), pathname);
  const displayRole = resolveDisplayRole(navContext);

  return (
    <AppShell
      navGroups={navGroups}
      navContext={navContext}
      sidebarHeader={
        <>
          <SidebarBrand name={brand.name} subtitle={brand.subtitle} logoSrc={brand.logo.src} />
          {navContext.isSuperadmin ? <OrgSwitcher variant="sidebar" /> : null}
        </>
      }
      sidebarFooter={
        <UserMenu
          variant="sidebar"
          showDashboard={navContext.hasOrganization}
          role={
            displayRole
              ? { label: roleKindLabel(displayRole), tone: roleKindTone(displayRole) }
              : undefined
          }
        />
      }
      breadcrumb={<AppBreadcrumbs items={breadcrumbs} />}
      banner={<ImpersonationBanner />}
      headerActions={<ModeToggle />}
    >
      {children}
    </AppShell>
  );
}
