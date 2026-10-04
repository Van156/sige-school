import {
  BackButton,
  FormCard,
  FormLayout,
  HelpCard,
  HelpList,
} from "../../-components/form-layout";
import { SelectField, SwitchField, TextField } from "../../-components/form-fields";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { JORNADA_LABEL } from "../../-lib/format";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useIdParam } from "../../-lib/use-search-params";
import { blankToUndefined } from "../../-lib/user-options";
import { REFERENCE_DATE, campusStore, mockAction, useMockCollection } from "../../-mock";
import type { Campus, CampusJornada, Institution } from "../../-mock/types";

const JORNADA_OPTIONS = (Object.keys(JORNADA_LABEL) as CampusJornada[]).map((value) => ({
  value,
  label: JORNADA_LABEL[value],
}));

interface Values {
  name: string;
  code: string;
  address: string;
  jornada: string;
  active: boolean;
  isMainCampus: boolean;
}

function toJornada(value: string): CampusJornada {
  return JORNADA_OPTIONS.find((option) => option.value === value)?.value ?? "completa";
}

/** INS-08: create or edit a campus. */
export function CampusFormScreen() {
  const id = useIdParam();
  const campusList = useMockCollection(campusStore);
  const existing = id === undefined ? undefined : campusList.find((campus) => campus.id === id);

  return (
    <ScopedPage
      screenId="INS-08"
      title={id === undefined ? "Nueva Sede" : "Editar Sede"}
      description="Datos de la ubicación física de la institución"
      actions={<BackButton screenId="INS-07" />}
      target="Sedes"
      banner={false}
    >
      {(institution) =>
        id !== undefined && (!existing || existing.institutionId !== institution.id) ? (
          <NotFoundBlock entity="La sede" backScreenId="INS-07" />
        ) : (
          <CampusForm key={existing?.id ?? "new"} institution={institution} campus={existing} />
        )
      }
    </ScopedPage>
  );
}

function CampusForm({ institution, campus }: { institution: Institution; campus?: Campus }) {
  const campusList = useMockCollection(campusStore);
  const goTo = useGoToScreen();

  const form = useSimpleForm<Values>(
    {
      name: campus?.name ?? "",
      code: campus?.code ?? "",
      address: campus?.address ?? "",
      jornada: campus?.jornada ?? "completa",
      active: campus?.active ?? true,
      isMainCampus: campus?.isMainCampus ?? false,
    },
    (values) => {
      const errors: FormErrors<Values> = {};
      if (!values.name.trim()) errors.name = "El nombre de la sede es obligatorio.";
      if (!values.jornada) errors.jornada = "Debes seleccionar una jornada.";
      const mine = campusList.filter((entry) => entry.institutionId === institution.id);
      if (
        values.isMainCampus &&
        mine.some((entry) => entry.isMainCampus && entry.id !== campus?.id)
      ) {
        errors.isMainCampus = "Ya existe una sede principal en esta institución.";
      }
      const code = values.code.trim();
      if (code && mine.some((entry) => entry.code === code && entry.id !== campus?.id)) {
        errors.code = "Ya existe una sede con este código.";
      }
      return errors;
    },
  );

  const submit = form.handleSubmit((values) => {
    const data = {
      name: values.name.trim(),
      code: blankToUndefined(values.code),
      address: blankToUndefined(values.address),
      jornada: toJornada(values.jornada),
      active: values.active,
      isMainCampus: values.isMainCampus,
    };
    if (campus) {
      campusStore.update(campus.id, data);
    } else {
      campusStore.add({ ...data, institutionId: institution.id, createdAt: REFERENCE_DATE });
    }
    mockAction(
      campus ? "Sede actualizada" : "Sede creada",
      "Los cambios no se guardan en el prototipo.",
    );
    goTo("INS-07");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos de la Sede"
          onSubmit={submit}
          submitLabel={campus ? "Actualizar Sede" : "Crear Sede"}
          cancelScreenId="INS-07"
        >
          <TextField
            label="Nombre de la Sede"
            required
            placeholder="Ej: Sede Principal, Sede Norte, etc."
            hint="Nombre descriptivo de la ubicación física"
            {...form.bind("name")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Código"
              placeholder="Ej: SEDE001"
              hint="Código único identificador (opcional)"
              {...form.bind("code")}
            />
            <SelectField
              label="Jornada"
              options={JORNADA_OPTIONS}
              hint="Horario de funcionamiento de la sede"
              {...form.bind("jornada")}
            />
          </div>
          <TextField
            label="Dirección"
            placeholder="Calle 123 # 45-67, Barrio"
            hint="Ubicación física completa de la sede"
            {...form.bind("address")}
          />
          <SwitchField
            label="Sede Activa"
            hint="Las sedes inactivas no estarán disponibles para selección"
            {...form.bind("active")}
          />
          <SwitchField
            label="Sede Principal"
            hint="Solo puede haber una sede principal por institución"
            {...form.bind("isMainCampus")}
          />
        </FormCard>
      }
      help={
        <>
          <HelpCard title="Información">
            <p className="font-medium text-foreground">¿Qué es una sede?</p>
            <p>Una ubicación física de la institución donde se imparten clases.</p>
            <p className="font-medium text-foreground">Sede Principal</p>
            <p>Una por institución, generalmente la administrativa; se destaca en el listado.</p>
          </HelpCard>
          <HelpCard title="Consejos">
            <HelpList
              items={[
                "Usa un código único para cada sede.",
                "Prefiere nombres descriptivos.",
                "La jornada determina los horarios de clase.",
                "Desactiva las sedes en desuso en lugar de eliminarlas.",
              ]}
            />
          </HelpCard>
        </>
      }
    />
  );
}
