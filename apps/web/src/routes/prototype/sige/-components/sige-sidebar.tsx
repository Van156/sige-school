import { Avatar, AvatarFallback } from "@base-template/ui/components/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@base-template/ui/components/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@base-template/ui/components/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@base-template/ui/components/sidebar";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  ChevronsUpDown,
  GraduationCap,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useState } from "react";

import { getInitials } from "@/shared/lib/initials";
import {
  initialNavParentState,
  nextNavParentState,
  toggleNavParent,
} from "@/shared/lib/nav-parent-state";

import { currentUserFor, fullName, mockInfo, openAlertCount } from "../-mock";
import { navForRole, type NavLeaf, type VisibleNavEntry } from "../-nav";
import { dashboardScreenId, type ScreenDef } from "../-screens";
import { ROLE_LABEL } from "../-lib/roles";
import { useCurrentScreen, useRole, useRoleFilter } from "../-lib/use-role";
import { ScreenLink } from "./sige-link";

function useLeafActive() {
  const current = useCurrentScreen();
  const roleFilter = useRoleFilter();
  return (leaf: NavLeaf, screen: ScreenDef | undefined = current) => {
    if (screen?.id !== leaf.screenId) return false;
    return (leaf.filter?.rol ?? undefined) === roleFilter;
  };
}

function NavParentItem({ entry, onNavigate }: { entry: VisibleNavEntry; onNavigate: () => void }) {
  const isLeafActive = useLeafActive();
  const children = entry.visibleChildren ?? [];
  const active = children.some((child) => isLeafActive(child));
  const [state, setState] = useState(() => initialNavParentState(active));
  const next = nextNavParentState(state, active);
  if (next !== state) {
    // Adjust state during render (no effect): opens when a child becomes active.
    setState(next);
  }
  const Icon = entry.icon;

  return (
    <Collapsible
      open={next.open}
      onOpenChange={(open) => setState((current) => toggleNavParent(current, open))}
      render={<SidebarMenuItem />}
      className="group/collapsible"
    >
      <CollapsibleTrigger render={<SidebarMenuButton tooltip={entry.label} isActive={active} />}>
        <Icon />
        <span>{entry.label}</span>
        <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-panel-open/menu-button:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {children.map((child) => (
            <SidebarMenuSubItem key={`${child.screenId}-${child.label}`}>
              <SidebarMenuSubButton
                isActive={isLeafActive(child)}
                render={<ScreenLink screenId={child.screenId} search={child.filter} />}
                onClick={onNavigate}
              >
                <span>{child.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SigeUserMenu() {
  const role = useRole();
  const user = currentUserFor(role);
  const name = fullName(user);
  const navigate = useNavigate();
  const { isMobile } = useSidebar();

  const signOut = () => {
    mockInfo("Ha cerrado sesión exitosamente.");
    void navigate({ to: "/prototype/sige/auth/login", search: { role } });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" aria-label="Menú de usuario" />}
          >
            <Avatar className="rounded-md">
              <AvatarFallback className="rounded-md text-xs">{getInitials(name)}</AvatarFallback>
            </Avatar>
            <span className="grid min-w-0 flex-1 text-left text-[13px] leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{ROLE_LABEL[role]}</span>
            </span>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="end"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <span className="flex items-center gap-2 px-1 py-1.5">
                  <Avatar className="rounded-md">
                    <AvatarFallback className="rounded-md text-xs">
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 flex-1 text-left text-[13px] leading-tight">
                    <span className="truncate font-medium text-foreground">{name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<ScreenLink screenId={dashboardScreenId[role]} />}>
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem render={<ScreenLink screenId="AUTH-04" />}>
              <UserIcon />
              Mi Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={signOut}>
              <LogOut />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** Ink sidebar with the per-role navigation of the legacy system and the user menu. */
export function SigeSidebar() {
  const role = useRole();
  const sections = navForRole(role);
  const isLeafActive = useLeafActive();
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobileSheet = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<ScreenLink screenId={dashboardScreenId[role]} />}
              onClick={closeMobileSheet}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <GraduationCap className="size-4" />
              </span>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">SIGE</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  Sistema de Gestión Escolar
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section, index) => (
          <SidebarGroup key={section.label ?? `section-${index}`}>
            {section.label ? <SidebarGroupLabel>{section.label}</SidebarGroupLabel> : null}
            <SidebarMenu>
              {section.entries.map((entry) => {
                if (entry.leaf) {
                  const leaf = entry.leaf;
                  const Icon = entry.icon;
                  return (
                    <SidebarMenuItem key={`${leaf.screenId}-${leaf.label}`}>
                      <SidebarMenuButton
                        tooltip={leaf.label}
                        isActive={isLeafActive(leaf)}
                        render={<ScreenLink screenId={leaf.screenId} search={leaf.filter} />}
                        onClick={closeMobileSheet}
                      >
                        <Icon />
                        <span>{leaf.label}</span>
                      </SidebarMenuButton>
                      {leaf.badge === "alerts" ? (
                        <SidebarMenuBadge>{openAlertCount()}</SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                }
                return (
                  <NavParentItem key={entry.label} entry={entry} onNavigate={closeMobileSheet} />
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SigeUserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
