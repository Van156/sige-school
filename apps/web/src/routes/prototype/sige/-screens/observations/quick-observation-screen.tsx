import { RadioGroup, RadioGroupItem } from "@base-template/ui/components/radio-group";
import { FieldError, FieldLegend, FieldSet } from "@base-template/ui/components/field";
import { cn } from "@base-template/ui/lib/utils";

import { SelectField, TextareaField } from "../../-components/form-fields";
import { BackButton, FormCard, FormLayout, HelpCard } from "../../-components/form-layout";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { StudentStrip } from "../../-components/student-strip";
import {
  OBSERVATION_CATEGORIES,
  OBSERVATION_EMOJI,
  OBSERVATION_HINT,
  OBSERVATION_LABEL,
  OBSERVATION_TYPES,
  requiresNotification,
  toObservationType,
  useObservationAccess,
} from "../../-lib/observations";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useSchool, type School } from "../../-lib/use-school";
import { useIntParam } from "../../-lib/use-search-params";
import { blankToUndefined } from "../../-lib/user-options";
import { REFERENCE_DATE, mockAction, observationStore } from "../../-mock";
import type { AcademicStudent, Institution } from "../../-mock/types";

/** OBS-04: quick observation for one student (`?student=`, reached from STU-01 / STU-02). */
export function QuickObservationScreen() {
  const studentId = useIntParam("student");
  return (
    <ScopedPage
      screenId="OBS-04"
      title="Observación Rápida"
      description="Crear observación para el estudiante"
      target="Observaciones"
      banner={false}
      actions={
        <BackButton
          screenId="STU-02"
          search={studentId === undefined ? undefined : { id: String(studentId) }}
          label="Volver al perfil"
        />
      }
    >
      {(institution) => <QuickLoader institution={institution} studentId={studentId} />}
    </ScopedPage>
  );
}

function QuickLoader({ institution, studentId }: { institution: Institution; studentId?: number }) {
  const school = useSchool(institution.id);
  const access = useObservationAccess(school);
  const student = school.students.find((entry) => entry.id === studentId);
  if (!student || !access.canSeeStudent(student.id)) {
    return <NotFoundBlock entity="Estudiante" backScreenId="STU-01" />;
  }
  return <QuickForm key={student.id} student={student} school={school} authorId={access.userId} />;
}

interface Values {
  type: string;
  category: string;
  description: string;
  commitments: string;
}

function QuickForm({
  student,
  school,
  authorId,
}: {
  student: AcademicStudent;
  school: School;
  authorId: number;
}) {
  const goTo = useGoToScreen();
  const form = useSimpleForm<Values>(
    { type: "", category: "", description: "", commitments: "" },
    (values) => {
      const errors: FormErrors<Values> = {};
      if (!values.type) errors.type = "Selecciona el tipo de observación.";
      if (!values.description.trim()) errors.description = "La descripción es obligatoria.";
      return errors;
    },
  );
  const type = form.bind("type");

  const submit = form.handleSubmit((values) => {
    const observationType = toObservationType(values.type);
    observationStore.add({
      studentId: student.id,
      authorId,
      type: observationType,
      category: blankToUndefined(values.category),
      description: values.description.trim(),
      commitments: blankToUndefined(values.commitments),
      date: `${REFERENCE_DATE}T08:00`,
      notified: false,
    });
    mockAction(
      "Observación creada exitosamente",
      requiresNotification(observationType) ? "El director de grupo será notificado." : undefined,
    );
    goTo("OBS-05", { student: String(student.id) });
  });

  return (
    <>
      <StudentStrip student={student} school={school} />
      <FormLayout
        form={
          <FormCard
            title="Nueva Observación"
            onSubmit={submit}
            submitLabel="Crear Observación"
            cancelScreenId="STU-02"
            cancelSearch={{ id: String(student.id) }}
          >
            <FieldSet data-invalid={Boolean(type.error)}>
              <FieldLegend variant="label">
                Tipo de Observación
                <span aria-hidden="true" className="text-destructive">
                  {" "}
                  *
                </span>
              </FieldLegend>
              <RadioGroup
                value={type.value}
                onValueChange={type.onValueChange}
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {OBSERVATION_TYPES.map((value) => (
                  <label
                    key={value}
                    htmlFor={`quick-type-${value}`}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center text-[13px] transition-colors hover:bg-muted/50",
                      type.value === value && "border-primary bg-primary/5",
                    )}
                  >
                    <span aria-hidden="true" className="text-xl">
                      {OBSERVATION_EMOJI[value]}
                    </span>
                    {OBSERVATION_LABEL[value]}
                    <RadioGroupItem id={`quick-type-${value}`} value={value} />
                  </label>
                ))}
              </RadioGroup>
              {type.error ? <FieldError>{type.error}</FieldError> : null}
            </FieldSet>
            <SelectField
              label="Categoría"
              placeholder="Seleccionar..."
              hint="Categoría opcional para clasificar la observación"
              options={OBSERVATION_CATEGORIES.slice(0, 6).map((value) => ({ value, label: value }))}
              {...form.bind("category")}
            />
            <TextareaField
              label="Descripción"
              required
              rows={4}
              placeholder="Describa la observación con detalle..."
              hint="Sea específico y objetivo en la descripción"
              {...form.bind("description")}
            />
            <TextareaField
              label="Compromisos"
              rows={2}
              placeholder="Compromisos adquiridos (opcional)..."
              hint="Compromisos que adquiere el estudiante (opcional)"
              {...form.bind("commitments")}
            />
          </FormCard>
        }
        help={
          <HelpCard title="Tipos de Observación">
            <dl className="flex flex-col gap-2">
              {OBSERVATION_TYPES.map((value) => (
                <div key={value}>
                  <dt className="font-medium text-foreground">
                    {OBSERVATION_EMOJI[value]} {OBSERVATION_LABEL[value]}
                  </dt>
                  <dd>{OBSERVATION_HINT[value]}</dd>
                </div>
              ))}
            </dl>
          </HelpCard>
        }
      />
    </>
  );
}
