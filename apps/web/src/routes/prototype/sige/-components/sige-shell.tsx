import { SidebarInset, SidebarProvider } from "@base-template/ui/components/sidebar";
import type { ReactNode } from "react";

import AppHeader from "@/shared/components/layout/app-header";
import { ModeToggle } from "@/shared/components/layout/mode-toggle";

import { CampusIndicator, RoleSwitcher, SigeBreadcrumbs } from "./shell-controls";
import { SigeSidebar } from "./sige-sidebar";

/**
 * SIGE app frame, mirroring the real authenticated shell: ink sidebar (a sheet on phones),
 * 48px bordered header and the same content padding. Domain data arrives through the nav config.
 */
export function SigeShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <SigeSidebar />
      <SidebarInset>
        <AppHeader breadcrumb={<SigeBreadcrumbs />}>
          <CampusIndicator />
          <RoleSwitcher />
          <ModeToggle />
        </AppHeader>
        <div className="flex flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
