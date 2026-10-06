import { Button } from "@base-template/ui/components/button";
import { ArrowLeftRight, Building2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useScopeInstitution } from "../-lib/institution-scope";
import { useRole } from "../-lib/use-role";
import { institutionStore, mockAction, setActiveInstitution, useMockCollection } from "../-mock";
import type { Institution } from "../-mock/types";
import { EmptyBlock } from "./empty-block";
import { InstitutionBanner } from "./institution-banner";
import { InstitutionPicker } from "./institution-picker";
import { SigePageHeader } from "./page-header";
import { RoleGate } from "./role-gate";
import { ScreenLinkButton } from "./link-button";
import { SectionCard } from "./section-card";

/** Page frame of a screen: role gate plus the standard header. */
export function ScreenPage({
  screenId,
  title,
  description,
  back,
  actions,
  children,
}: {
  screenId: string;
  title: string;
  description?: ReactNode;
  back?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <RoleGate screenId={screenId}>
      <div className="flex flex-col gap-4">
        <SigePageHeader title={title} description={description} back={back} actions={actions} />
        {children}
      </div>
    </RoleGate>
  );
}

/**
 * Screen scoped to one institution. Root without an active institution gets the selector card
 * (inventory 0.3); with one, the header gains "Cambiar Institución" and the institution banner.
 */
export function ScopedPage({
  screenId,
  title,
  description,
  back,
  actions,
  target,
  banner = true,
  children,
}: {
  screenId: string;
  title: string;
  description?: ReactNode;
  back?: ReactNode;
  actions?: ReactNode;
  /** What root will manage after choosing, e.g. "Sedes" (button "Seleccionar y Gestionar Sedes"). */
  target: string;
  banner?: boolean;
  children: (institution: Institution) => ReactNode;
}) {
  const role = useRole();
  const scope = useScopeInstitution();

  return (
    <ScreenPage
      screenId={screenId}
      title={title}
      description={description}
      back={back}
      actions={
        <>
          {role === "root" && scope ? (
            <Button variant="outline" onClick={() => setActiveInstitution(null)}>
              <ArrowLeftRight data-icon="inline-start" />
              Cambiar Institución
            </Button>
          ) : null}
          {actions}
        </>
      }
    >
      {scope ? (
        <>
          {banner ? (
            <InstitutionBanner
              institution={scope}
              badge={role === "root" ? "Vista Root" : "Tu Institución"}
            />
          ) : null}
          {children(scope)}
        </>
      ) : (
        <RootSelectorCard target={target} />
      )}
    </ScreenPage>
  );
}

/** "Selecciona una institución" card shown to root until an institution context is active. */
export function RootSelectorCard({ target }: { target: string }) {
  const institutions = useMockCollection(institutionStore);
  const [selected, setSelected] = useState<number | null>(null);

  if (institutions.length === 0) {
    return (
      <EmptyBlock
        icon={<Building2 />}
        title="No hay instituciones creadas"
        description="Comienza creando tu primera institución educativa del sistema."
        action={
          <ScreenLinkButton screenId="INS-02" variant="default">
            Crear Primera Institución
          </ScreenLinkButton>
        }
      />
    );
  }

  return (
    <SectionCard
      title="Selecciona una institución"
      description={`Como administrador del sistema, debes seleccionar una institución para gestionar ${target.toLowerCase()}.`}
    >
      <InstitutionPicker institutions={institutions} value={selected} onValueChange={setSelected} />
      <div>
        <Button
          disabled={selected === null}
          onClick={() => {
            if (selected === null) return;
            setActiveInstitution(selected);
            mockAction("Institución seleccionada", "Ahora trabajas dentro de su contexto.");
          }}
        >
          Seleccionar y Gestionar {target}
        </Button>
      </div>
    </SectionCard>
  );
}
