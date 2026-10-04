import { Button } from "@base-template/ui/components/button";
import { Building2, List, Plus, Undo2 } from "lucide-react";
import { useState } from "react";

import { ActionLink } from "../../-components/action-link";
import { Callout } from "../../-components/callout";
import { EmptyBlock } from "../../-components/empty-block";
import { BackButton } from "../../-components/form-layout";
import { InstitutionPicker } from "../../-components/institution-picker";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScreenPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { useScopeInstitution } from "../../-lib/institution-scope";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import {
  institutionStore,
  mockAction,
  setActiveInstitution,
  useActiveInstitutionId,
  useMockCollection,
} from "../../-mock";

/** INS-03: root picks the institution every scoped screen works in. */
export function SelectInstitutionScreen() {
  const institutions = useMockCollection(institutionStore);
  const activeId = useActiveInstitutionId();
  const active = useScopeInstitution();
  const goTo = useGoToScreen();
  const [selected, setSelected] = useState<number | null>(activeId);

  return (
    <ScreenPage
      screenId="INS-03"
      title="Seleccionar Institución"
      description="Como administrador del sistema, seleccione la institución donde desea trabajar"
      actions={<BackButton screenId="DASH-01" label="Volver al Dashboard" />}
    >
      <Callout tone="info" title="Importante">
        Debe seleccionar una institución para gestionar sedes, grados y otros elementos. Esta
        selección determina el contexto de trabajo.
      </Callout>
      {active ? (
        <SectionCard title="Institución Actualmente Seleccionada">
          <p className="text-sm font-medium">{active.name}</p>
        </SectionCard>
      ) : null}
      <SectionCard title="Instituciones Disponibles">
        {institutions.length === 0 ? (
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
        ) : (
          <>
            <InstitutionPicker
              institutions={institutions}
              value={selected}
              onValueChange={setSelected}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={selected === null}
                onClick={() => {
                  if (selected === null) return;
                  setActiveInstitution(selected);
                  mockAction("Institución seleccionada", "Ahora trabajas dentro de su contexto.");
                  goTo("DASH-01");
                }}
              >
                Seleccionar y Continuar
              </Button>
              {active ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveInstitution(null);
                    setSelected(null);
                    mockAction("Contexto limpiado", "Verás todas las instituciones.");
                  }}
                >
                  <Undo2 data-icon="inline-start" />
                  Ver Todas las Instituciones
                </Button>
              ) : null}
            </div>
          </>
        )}
      </SectionCard>
      <div className="grid gap-3 sm:grid-cols-3">
        <ActionLink
          screenId="INS-01"
          title="Lista Completa"
          subtitle="Ver todas las instituciones"
          icon={List}
        />
        <ActionLink
          screenId="INS-02"
          title="Nueva Institución"
          subtitle="Crear una nueva institución"
          icon={Plus}
        />
        <ActionLink
          screenId="DASH-01"
          title="Dashboard Root"
          subtitle="Volver al panel principal"
          icon={Building2}
        />
      </div>
    </ScreenPage>
  );
}
