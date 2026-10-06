import {
  BackButton,
  FormCard,
  FormLayout,
  HelpCard,
  HelpList,
} from "../../-components/form-layout";
import { SwitchField, TextField } from "../../-components/form-fields";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useIdParam } from "../../-lib/use-search-params";
import { ACADEMIC_YEAR, mockAction, periodStore, useMockCollection } from "../../-mock";
import type { AcademicPeriod, Institution } from "../../-mock/types";

interface Values {
  name: string;
  shortName: string;
  startDate: string;
  endDate: string;
  academicYear: string;
  order: string;
  isActive: boolean;
}

/** INS-16: create or edit an academic period. */
export function PeriodFormScreen() {
  const id = useIdParam();
  const periodList = useMockCollection(periodStore);
  const existing = id === undefined ? undefined : periodList.find((period) => period.id === id);

  return (
    <ScopedPage
      screenId="INS-16"
      title={id === undefined ? "Nuevo Periodo" : "Editar Periodo"}
      description="Complete los datos del periodo académico"
      actions={<BackButton screenId="INS-15" />}
      target="Periodos"
      banner={false}
    >
      {(institution) =>
        id !== undefined && existing?.institutionId !== institution.id ? (
          <NotFoundBlock entity="Periodo" backScreenId="INS-15" />
        ) : (
          <PeriodForm key={existing?.id ?? "new"} institution={institution} period={existing} />
        )
      }
    </ScopedPage>
  );
}

function PeriodForm({
  institution,
  period,
}: {
  institution: Institution;
  period?: AcademicPeriod;
}) {
  const periodList = useMockCollection(periodStore);
  const goTo = useGoToScreen();
  const nextOrder =
    Math.max(
      0,
      ...periodList
        .filter((entry) => entry.institutionId === institution.id)
        .map((entry) => entry.order),
    ) + 1;

  const form = useSimpleForm<Values>(
    {
      name: period?.name ?? "",
      shortName: period?.shortName ?? "",
      startDate: period?.startDate ?? "",
      endDate: period?.endDate ?? "",
      academicYear: period?.academicYear ?? ACADEMIC_YEAR,
      order: String(period?.order ?? nextOrder),
      isActive: period?.isActive ?? true,
    },
    (values) => {
      const errors: FormErrors<Values> = {};
      if (!values.name.trim()) errors.name = "El nombre del periodo es obligatorio.";
      if (!values.shortName.trim()) errors.shortName = "El nombre corto es obligatorio.";
      if (!values.startDate) errors.startDate = "La fecha de inicio es obligatoria.";
      if (!values.endDate) errors.endDate = "La fecha de fin es obligatoria.";
      else if (values.startDate && values.endDate < values.startDate) {
        errors.endDate = "La fecha de fin no puede ser anterior a la de inicio.";
      }
      if (!values.academicYear.trim()) errors.academicYear = "El año académico es obligatorio.";
      const order = Number(values.order);
      if (!Number.isInteger(order) || order < 1)
        errors.order = "El orden debe ser un entero desde 1.";
      return errors;
    },
  );

  const submit = form.handleSubmit((values) => {
    const data = {
      name: values.name.trim(),
      shortName: values.shortName.trim(),
      startDate: values.startDate,
      endDate: values.endDate,
      academicYear: values.academicYear.trim(),
      order: Number(values.order),
      isActive: values.isActive,
    };
    // Exactly one period is active per institution: activating this one switches the others off.
    if (values.isActive) {
      for (const other of periodList) {
        if (other.institutionId === institution.id && other.id !== period?.id && other.isActive) {
          periodStore.update(other.id, { isActive: false });
        }
      }
    }
    if (period) periodStore.update(period.id, data);
    else periodStore.add({ ...data, institutionId: institution.id });
    mockAction(
      period ? "Periodo actualizado" : "Periodo creado",
      "Los cambios no se guardan en el prototipo.",
    );
    goTo("INS-15");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos del Periodo"
          onSubmit={submit}
          submitLabel={period ? "Actualizar Periodo" : "Crear Periodo"}
          cancelScreenId="INS-15"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Nombre del Periodo"
              required
              hint="Ej: Primer Periodo, Segundo Periodo"
              {...form.bind("name")}
            />
            <TextField
              label="Nombre Corto"
              required
              hint="Ej: P1, P2, P3, P4"
              {...form.bind("shortName")}
            />
            <TextField label="Fecha de Inicio" required type="date" {...form.bind("startDate")} />
            <TextField label="Fecha de Fin" required type="date" {...form.bind("endDate")} />
            <TextField
              label="Año Académico"
              required
              hint="Ej: 2026"
              {...form.bind("academicYear")}
            />
            <TextField
              label="Orden"
              type="number"
              min={1}
              hint="Orden del periodo (1, 2, 3, 4)"
              {...form.bind("order")}
            />
          </div>
          <SwitchField
            label="Periodo Activo"
            hint="Solo un periodo puede estar activo a la vez."
            {...form.bind("isActive")}
          />
        </FormCard>
      }
      help={
        <HelpCard title="Información">
          <HelpList
            items={[
              "Los periodos dividen el año lectivo.",
              "Generalmente hay 4 periodos por año.",
              "Las notas se cierran por periodo.",
              "Se usan para los boletines.",
            ]}
          />
        </HelpCard>
      }
    />
  );
}
