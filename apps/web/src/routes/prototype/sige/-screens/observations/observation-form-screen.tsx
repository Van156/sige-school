import { SelectField, TextareaField, TextField } from "../../-components/form-fields";
import {
  BackButton,
  FormCard,
  FormLayout,
  HelpCard,
  HelpList,
} from "../../-components/form-layout";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import {
  OBSERVATION_CATEGORY_OPTIONS,
  OBSERVATION_TYPE_OPTIONS,
  requiresNotification,
  toObservationType,
  useObservationAccess,
  type ObservationAccess,
} from "../../-lib/observations";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useSchool, type School } from "../../-lib/use-school";
import { useIdParam, useIntParam } from "../../-lib/use-search-params";
import { blankToUndefined } from "../../-lib/user-options";
import { REFERENCE_DATE, mockAction, observationStore, useMockCollection } from "../../-mock";
import type { Institution, Observation } from "../../-mock/types";

/** OBS-03: create or edit an observation (`?id=`; `?student=` preselects the student). */
export function ObservationFormScreen() {
  const id = useIdParam();
  return (
    <ScopedPage
      screenId="OBS-03"
      title={id === undefined ? "Nueva Observación" : "Editar Observación"}
      description={
        id === undefined
          ? "Complete el formulario para crear la observación"
          : "Complete el formulario para actualizar la observación"
      }
      target="Observaciones"
      banner={false}
      actions={
        <BackButton
          screenId={id === undefined ? "OBS-01" : "OBS-02"}
          search={id === undefined ? undefined : { id: String(id) }}
          label={id === undefined ? "Volver a la lista" : "Volver al detalle"}
        />
      }
    >
      {(institution) => <FormLoader institution={institution} id={id} />}
    </ScopedPage>
  );
}

function FormLoader({ institution, id }: { institution: Institution; id?: number }) {
  const school = useSchool(institution.id);
  const access = useObservationAccess(school);
  const observation = useMockCollection(observationStore).find((row) => row.id === id);
  const preselected = useIntParam("student");

  if (id !== undefined && (!observation || !access.canSeeStudent(observation.studentId))) {
    return <NotFoundBlock entity="La observación" backScreenId="OBS-01" />;
  }
  return (
    <ObservationForm
      key={observation?.id ?? "new"}
      observation={observation}
      preselected={preselected}
      school={school}
      access={access}
    />
  );
}

interface Values {
  studentId: string;
  type: string;
  category: string;
  description: string;
  commitments: string;
  date: string;
}

function ObservationForm({
  observation,
  preselected,
  school,
  access,
}: {
  observation?: Observation;
  preselected?: number;
  school: School;
  access: ObservationAccess;
}) {
  const goTo = useGoToScreen();
  const students = school.students
    .filter((student) => student.status === "activo" && access.canSeeStudent(student.id))
    .toSorted((a, b) =>
      (school.studentName(a.id) ?? "").localeCompare(school.studentName(b.id), "es"),
    );

  const form = useSimpleForm<Values>(
    {
      studentId: String(observation?.studentId ?? preselected ?? ""),
      type: observation?.type ?? "",
      category: observation?.category ?? "",
      description: observation?.description ?? "",
      commitments: observation?.commitments ?? "",
      date: observation?.date.slice(0, 10) ?? REFERENCE_DATE,
    },
    (values) => {
      const errors: FormErrors<Values> = {};
      if (!values.studentId) errors.studentId = "Debes seleccionar un estudiante.";
      if (!values.type) errors.type = "Debes seleccionar un tipo.";
      if (!values.description.trim()) errors.description = "La descripción es obligatoria.";
      return errors;
    },
  );

  const submit = form.handleSubmit((values) => {
    const type = toObservationType(values.type);
    const data = {
      type,
      category: blankToUndefined(values.category),
      description: values.description.trim(),
      commitments: blankToUndefined(values.commitments),
    };
    if (observation) {
      observationStore.update(observation.id, {
        ...data,
        date: `${values.date}${observation.date.slice(10)}`,
      });
      mockAction("Observación actualizada");
    } else {
      observationStore.add({
        ...data,
        studentId: Number(values.studentId),
        authorId: access.userId,
        date: `${values.date}T08:00`,
        notified: false,
      });
      mockAction(
        "Observación creada exitosamente",
        requiresNotification(type) ? "El director de grupo será notificado." : undefined,
      );
    }
    goTo("OBS-01");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos de la Observación"
          onSubmit={submit}
          submitLabel={observation ? "Actualizar Observación" : "Crear Observación"}
          cancelScreenId="OBS-01"
        >
          <SelectField
            label="Estudiante"
            required
            placeholder="Seleccionar estudiante..."
            disabled={observation !== undefined}
            hint={
              observation
                ? "No se puede cambiar el estudiante de una observación existente"
                : undefined
            }
            options={students.map((student) => {
              const user = school.userOfStudent(student);
              return {
                value: String(student.id),
                label: `${school.studentName(student.id)} - ${school.gradeName(student.gradeId) ?? "Sin grado"}${user ? ` (${user.documentNumber})` : ""}`,
              };
            })}
            {...form.bind("studentId")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Tipo"
              required
              placeholder="Seleccionar tipo..."
              options={OBSERVATION_TYPE_OPTIONS}
              {...form.bind("type")}
            />
            <SelectField
              label="Categoría"
              placeholder="Seleccionar categoría..."
              options={OBSERVATION_CATEGORY_OPTIONS}
              {...form.bind("category")}
            />
          </div>
          <TextareaField
            label="Descripción"
            required
            rows={5}
            placeholder="Describa la observación detalladamente..."
            hint="Proporcione una descripción clara y detallada de la observación"
            {...form.bind("description")}
          />
          <TextareaField
            label="Compromisos"
            rows={3}
            placeholder="Compromisos adquiridos (opcional)..."
            hint="Opcional: acuerdos o compromisos derivados de la observación"
            {...form.bind("commitments")}
          />
          <TextField
            label="Fecha"
            type="date"
            hint="Fecha en que ocurrió la observación (por defecto hoy)"
            {...form.bind("date")}
          />
        </FormCard>
      }
      help={
        <HelpCard title="Información importante">
          <p>
            Las observaciones negativas y de convivencia requieren notificación automática a los
            acudientes del estudiante.
          </p>
          <HelpList
            items={[
              "Sea específico y objetivo en la descripción.",
              "Registre los compromisos cuando existan acuerdos.",
              "La notificación se marca manualmente desde la lista o el detalle.",
            ]}
          />
        </HelpCard>
      }
    />
  );
}
