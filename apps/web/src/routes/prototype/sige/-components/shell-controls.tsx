import { Badge } from "@base-template/ui/components/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@base-template/ui/components/breadcrumb";
import { Button } from "@base-template/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@base-template/ui/components/dropdown-menu";
import { useNavigate } from "@tanstack/react-router";
import { Building2, ChevronDown, FlaskConical } from "lucide-react";
import { Fragment, useState } from "react";

import { campuses, institution, mockAction } from "../-mock";
import type { Role } from "../-mock/types";
import { MODULE_LABEL } from "../-screens";
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL } from "../-lib/roles";
import { useCurrentScreen, useRole } from "../-lib/use-role";
import { SigeLink } from "./sige-link";

/** Header breadcrumb: SIGE > module > screen, derived from the screen registry. */
export function SigeBreadcrumbs() {
  const screen = useCurrentScreen();
  const crumbs: Array<{ label: string; to?: string }> = [{ label: "SIGE", to: "/prototype/sige" }];
  if (!screen) {
    crumbs.push({ label: "Índice de pantallas" });
  } else {
    if (screen.module !== "DASH" && screen.module !== "AUTH") {
      crumbs.push({ label: MODULE_LABEL[screen.module] });
    }
    crumbs.push({ label: screen.title });
  }
  const lastIndex = crumbs.length - 1;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap text-[13px]">
        {crumbs.map((crumb, index) => {
          const isLast = index === lastIndex;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbItem className={isLast ? "min-w-0" : "hidden md:block"}>
                {isLast ? (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                ) : crumb.to ? (
                  <BreadcrumbLink render={<SigeLink to={crumb.to} />}>{crumb.label}</BreadcrumbLink>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </BreadcrumbItem>
              {isLast ? null : <BreadcrumbSeparator className="hidden md:block" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Institution and campus indicator. Cosmetic: picking a campus only shows a toast. */
export function CampusIndicator() {
  const role = useRole();
  const [campusId, setCampusId] = useState("all");
  const activeCampuses = campuses.filter((campus) => campus.active);
  const label =
    campusId === "all"
      ? "Todas las sedes"
      : (activeCampuses.find((campus) => String(campus.id) === campusId)?.name ?? "Sede");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="hidden max-w-64 md:inline-flex" />}
      >
        <Building2 />
        <span className="truncate">
          {institution.name} · {label}
        </span>
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {role === "root" ? "Institución activa" : "Institución"}
          </DropdownMenuLabel>
          <DropdownMenuLabel className="pt-0 text-sm font-medium text-foreground">
            {institution.name}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sede</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={campusId}
            onValueChange={(value) => {
              setCampusId(value);
              mockAction("Sede seleccionada", "El filtro por sede es solo visual en el prototipo.");
            }}
          >
            <DropdownMenuRadioItem value="all">Todas las sedes</DropdownMenuRadioItem>
            {activeCampuses.map((campus) => (
              <DropdownMenuRadioItem key={campus.id} value={String(campus.id)}>
                {campus.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Prototype-only role switcher: replaces auth. Keeps the choice in `?role=` and lands on the dashboard. */
export function RoleSwitcher() {
  const role = useRole();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" aria-label="Cambiar rol (prototipo)" />}
      >
        <Badge variant="warning" className="gap-1">
          <FlaskConical />
          Prototipo
        </Badge>
        <span className="hidden sm:inline">{ROLE_LABEL[role]}</span>
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Ver el sistema como</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={role}
            onValueChange={(value) => {
              void navigate({
                to: "/prototype/sige/dashboard",
                search: { role: value as Role },
              });
            }}
          >
            {ROLES.map((item) => (
              <DropdownMenuRadioItem key={item} value={item}>
                <span className="flex flex-col">
                  <span>{ROLE_LABEL[item]}</span>
                  <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[item]}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
