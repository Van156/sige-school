import { BackButton, FormCard, FormLayout, HelpCard } from "../../-components/form-layout";
import { TextField, TextareaField } from "../../-components/form-fields";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useIdParam } from "../../-lib/use-search-params";
import { blankToUndefined } from "../../-lib/user-options";
import { criteriaStore, mockAction, useMockCollection } from "../../-mock";
import type { GradeCriteria, Institution } from "../../-mock/types";

interface Values {
  name: string;
  weight: string;
  description: string;
  order: string;
}

/** INS-18: create or edit an evaluation criterion. */
export function CriterionFormScreen() {
  const id = useIdParam();
  const criteriaList = useMockCollection(criteriaStore);
  const existing =
    id === undefined ? undefined : criteriaList.find((criterion) => criterion.id === id);

  return (
    <ScopedPage
      screenId="INS-18"
      title={id === undefined ? "Nuevo Criterio" : "Editar Criterio"}
      description="Complete los datos del criterio"
      actions={<BackButton screenId="INS-17" />}
      target="Criterios"
      banner={false}
    >
      {(institution) =>
        id !== undefined && existing?.institutionId !== institution.id ? (
          <NotFoundBlock entity="El criterio" backScreenId="INS-17" />
        ) : (
          <CriterionForm
            key={existing?.id ?? "new"}
            institution={institution}
            criterion={existing}
          />
        )
      }
    </ScopedPage>
  );
}

function CriterionForm({
  institution,
  criterion,
}: {
  institution: Institution;
  criterion?: GradeCriteria;
}) {
  const criteriaList = useMockCollection(criteriaStore);
  const goTo = useGoToScreen();
  const nextOrder =
    Math.max(
      0,
      ...criteriaList
        .filter((entry) => entry.institutionId === institution.id)
        .map((entry) => entry.order),
    ) + 1;

  const form = useSimpleForm<Values>(
    {
      name: criterion?.name ?? "",
      weight: criterion ? String(criterion.weight) : "",
      description: criterion?.description ?? "",
      order: String(criterion?.order ?? nextOrder),
    },
    (values) => {
      const errors: FormErrors<Values> = {};
      if (!values.name.trim()) errors.name = "El nombre del criterio es obligatorio.";
      const weight = Number(values.weight);
      if (values.weight.trim() === "") errors.weight = "El peso es obligatorio.";
      else if (!Number.isFinite(weight)) errors.weight = "El peso debe ser un número válido.";
      else if (weight <= 0 || weight > 100) {
        errors.weight = "El peso debe ser mayor a 0 y menor o igual a 100.";
      }
      const order = Number(values.order);
      if (!Number.isInteger(order) || order < 1)
        errors.order = "El orden debe ser un entero desde 1.";
      return errors;
    },
  );

  const submit = form.handleSubmit((values) => {
    const data = {
      name: values.name.trim(),
      weight: Number(values.weight),
      description: blankToUndefined(values.description),
      order: Number(values.order),
    };
    if (criterion) criteriaStore.update(criterion.id, data);
    else criteriaStore.add({ ...data, institutionId: institution.id });
    mockAction(
      criterion ? "Criterio actualizado" : "Criterio creado",
      "Los cambios no se guardan en el prototipo.",
    );
    goTo("INS-17");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos del Criterio"
          onSubmit={submit}
          submitLabel={criterion ? "Actualizar Criterio" : "Crear Criterio"}
          cancelScreenId="INS-17"
        >
          <TextField
            label="Nombre del Criterio"
            required
            hint="Nombre descriptivo (ej: Seguimiento, Formativo, Cognitivo)"
            {...form.bind("name")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Peso (%)"
              required
              type="number"
              step="0.01"
              min={0}
              max={100}
              hint="Porcentaje del criterio (ej: 20, 30)"
              {...form.bind("weight")}
            />
            <TextField
              label="Orden"
              type="number"
              min={1}
              hint="Orden de visualización en listas"
              {...form.bind("order")}
            />
          </div>
          <TextareaField
            label="Descripción"
            hint="Descripción detallada del criterio de evaluación"
            {...form.bind("description")}
          />
        </FormCard>
      }
      help={
        <HelpCard title="Información">
          <p>Los criterios de evaluación definen cómo se calculan las notas.</p>
          <p className="font-medium text-foreground">Criterios por defecto</p>
          <ul className="flex flex-col gap-1 tabular-nums">
            <li>Seguimiento: 20%</li>
            <li>Formativo: 20%</li>
            <li>Cognitivo: 30%</li>
            <li>Procedimental: 30%</li>
          </ul>
        </HelpCard>
      }
    />
  );
}
