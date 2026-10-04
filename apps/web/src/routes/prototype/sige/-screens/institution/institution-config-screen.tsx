import { Building2, CalendarRange, ClipboardCheck, GraduationCap, Library } from "lucide-react";

import { ActionLink } from "../../-components/action-link";
import { FormCard, FormLayout, HelpCard } from "../../-components/form-layout";
import { ScopedPage } from "../../-components/scoped-page";
import { useSimpleForm } from "../../-lib/use-form";
import { institutionStore, mockAction, useMockCollection } from "../../-mock";
import type { Institution } from "../../-mock/types";
import {
  InstitutionFields,
  institutionToValues,
  validateInstitution,
  valuesToInstitution,
} from "./institution-fields";

/** INS-06: data of the scoped institution (admin: their own; root: the active one). */
export function InstitutionConfigScreen() {
  return (
    <ScopedPage
      screenId="INS-06"
      title="Configuración de Institución"
      description="Datos principales de la institución educativa"
      target="la configuración"
      banner={false}
    >
      {(institution) => <ConfigForm key={institution.id} institution={institution} />}
    </ScopedPage>
  );
}

function ConfigForm({ institution }: { institution: Institution }) {
  const institutions = useMockCollection(institutionStore);
  const form = useSimpleForm(institutionToValues(institution), (values) =>
    validateInstitution(
      values,
      institutions.filter((other) => other.id !== institution.id),
    ),
  );

  const submit = form.handleSubmit((values) => {
    institutionStore.update(institution.id, valuesToInstitution(values));
    mockAction("Configuración guardada", "Los cambios no se guardan en el prototipo.");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos de la Institución"
          onSubmit={submit}
          submitLabel="Guardar Configuración"
        >
          <InstitutionFields form={form} />
        </FormCard>
      }
      help={
        <>
          <HelpCard title="Enlaces Rápidos">
            <div className="flex flex-col gap-2">
              <ActionLink screenId="INS-07" title="Gestionar Sedes" icon={Building2} />
              <ActionLink screenId="INS-11" title="Gestionar Grados" icon={GraduationCap} />
              <ActionLink screenId="INS-13" title="Gestionar Asignaturas" icon={Library} />
              <ActionLink screenId="INS-15" title="Gestionar Periodos" icon={CalendarRange} />
              <ActionLink screenId="INS-17" title="Criterios de Evaluación" icon={ClipboardCheck} />
            </div>
          </HelpCard>
          <HelpCard title="Información">
            <p>
              Estos datos aparecen en boletines, reportes y documentos oficiales de la institución.
            </p>
          </HelpCard>
        </>
      }
    />
  );
}
