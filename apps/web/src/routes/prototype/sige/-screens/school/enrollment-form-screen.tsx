import { CheckList } from "../../-components/check-list";
import { Callout } from "../../-components/callout";
import {
  ReadOnlyField,
  SelectField,
  TextareaField,
  TextField,
} from "../../-components/form-fields";
import {
  BackButton,
  FormCard,
  FormLayout,
  HelpCard,
  HelpList,
} from "../../-components/form-layout";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { formatDate } from "../../-lib/format";
import { ENROLLMENT_OPTIONS, gradeOptions, toEnrollmentStatus } from "../../-lib/school-options";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useSchool, type School } from "../../-lib/use-school";
import { useIdParam } from "../../-lib/use-search-params";
import { blankToUndefined } from "../../-lib/user-options";
import { enrollStudents, enrollmentStore, mockAction } from "../../-mock";
import type { Institution, StudentEnrollment } from "../../-mock/types";

/** SCH-02: enroll students in a course (create) or edit one subject enrollment (`?id=`). */
export function EnrollmentFormScreen() {
  const id = useIdParam();

  return (
    <ScopedPage
      screenId="SCH-02"
      title={id === undefined ? "Nueva Matrícula" : "Editar Matrícula"}
      description="Matricula estudiantes en todas las materias de un grado"
      actions={<BackButton screenId="SCH-01" />}
      target="Matrículas"
    >
      {(institution) => <EnrollmentFormLoader institution={institution} id={id} />}
    </ScopedPage>
  );
}

function EnrollmentFormLoader({ institution, id }: { institution: Institution; id?: number }) {
  const school = useSchool(institution.id);
  if (id === undefined) return <CreateEnrollmentForm institution={institution} school={school} />;
  const enrollment = school.enrollments.find((row) => row.id === id);
  return enrollment ? (
    <EditEnrollmentForm key={enrollment.id} enrollment={enrollment} school={school} />
  ) : (
    <NotFoundBlock entity="La matrícula" backScreenId="SCH-01" />
  );
}

/* --------------------------------- Create --------------------------------- */

interface CreateValues {
  gradeId: string;
  studentIds: string[];
}

function CreateEnrollmentForm({
  institution,
  school,
}: {
  institution: Institution;
  school: School;
}) {
  const goTo = useGoToScreen();
  const activeStudents = school.students.filter((student) => student.status === "activo");

  const form = useSimpleForm<CreateValues>({ gradeId: "", studentIds: [] }, (values) => {
    const errors: FormErrors<CreateValues> = {};
    const grade = school.gradeById.get(Number(values.gradeId));
    if (!grade) errors.gradeId = "Debes seleccionar un grado.";
    if (values.studentIds.length === 0) errors.studentIds = "Seleccione al menos un estudiante.";
    if (grade) {
      const current = activeStudents.filter((student) => student.gradeId === grade.id).length;
      if (current + values.studentIds.length > grade.maxStudents) {
        errors.studentIds = `El grado superaría su capacidad máxima (${grade.maxStudents} estudiantes).`;
      }
    }
    return errors;
  });

  const selectedGrade = school.gradeById.get(Number(form.values.gradeId));
  const subjectCount = selectedGrade
    ? school.subjectGrades.filter((item) => item.gradeId === selectedGrade.id).length
    : 0;
  // Students already in the chosen course cannot be enrolled in it again.
  const candidates = selectedGrade
    ? activeStudents.filter((student) => student.gradeId !== selectedGrade.id)
    : [];

  const gradeBinding = form.bind("gradeId");

  const submit = form.handleSubmit((values) => {
    const created = enrollStudents(
      Number(values.gradeId),
      values.studentIds.map(Number),
      institution.academicYear,
    );
    mockAction(
      `${values.studentIds.length} estudiante(s) matriculado(s)`,
      `${created} inscripciones creadas en ${selectedGrade?.name ?? "el grado"}.`,
    );
    goTo("SCH-01");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Matricular Estudiantes"
          onSubmit={submit}
          submitLabel="Matricular Estudiantes"
          cancelScreenId="SCH-01"
        >
          <SelectField
            label="Grado"
            required
            placeholder="Seleccione un grado"
            options={gradeOptions(school.grades)}
            {...gradeBinding}
            onValueChange={(value) => {
              gradeBinding.onValueChange(value);
              form.set("studentIds", []);
            }}
          />
          <CheckList
            legend="Estudiantes"
            required
            items={candidates.map((student) => ({
              value: String(student.id),
              label: school.studentName(student.id),
              hint: `Actualmente: ${school.gradeName(student.gradeId) ?? "Sin grado"}`,
            }))}
            empty={
              selectedGrade
                ? "No hay estudiantes activos disponibles para este grado."
                : "Seleccione un grado primero"
            }
            hint="Marque los estudiantes que serán matriculados."
            {...form.bind("studentIds")}
          />
          <Callout tone="info" title="Nota">
            Al matricular, los estudiantes serán inscritos en{" "}
            <strong className="font-medium text-foreground">todas las materias</strong> asignadas a
            este grado
            {selectedGrade ? ` (${subjectCount} en ${selectedGrade.name})` : ""}.
          </Callout>
        </FormCard>
      }
      help={
        <HelpCard title="Información">
          <p className="font-medium text-foreground">Año académico {institution.academicYear}</p>
          <HelpList
            items={[
              "Cada estudiante queda inscrito en todas las materias del grado.",
              "El estudiante pasa a pertenecer al grado seleccionado.",
              "No se supera la capacidad máxima del grado.",
              "Para cambiar el estado de una inscripción usa la edición.",
            ]}
          />
        </HelpCard>
      }
    />
  );
}

/* ---------------------------------- Edit ---------------------------------- */

interface EditValues {
  status: string;
  finalScore: string;
  statusNote: string;
}

function EditEnrollmentForm({
  enrollment,
  school,
}: {
  enrollment: StudentEnrollment;
  school: School;
}) {
  const goTo = useGoToScreen();
  const item = school.subjectGradeById.get(enrollment.subjectGradeId);

  const form = useSimpleForm<EditValues>(
    {
      status: enrollment.status,
      finalScore: enrollment.finalScore === undefined ? "" : String(enrollment.finalScore),
      statusNote: enrollment.statusNote ?? "",
    },
    (values) => {
      const errors: FormErrors<EditValues> = {};
      if (values.finalScore.trim()) {
        const score = Number(values.finalScore);
        if (Number.isNaN(score) || score < 1 || score > 5) {
          errors.finalScore = "La nota final debe estar entre 1.0 y 5.0.";
        }
      }
      return errors;
    },
  );

  const submit = form.handleSubmit((values) => {
    enrollmentStore.update(enrollment.id, {
      status: toEnrollmentStatus(values.status),
      finalScore: values.finalScore.trim() ? Number(values.finalScore) : undefined,
      statusNote: blankToUndefined(values.statusNote),
    });
    mockAction("Matrícula actualizada", "Los cambios no se guardan en el prototipo.");
    goTo("SCH-01");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos de la Matrícula"
          onSubmit={submit}
          submitLabel="Guardar Cambios"
          cancelScreenId="SCH-01"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField label="Estudiante" value={school.studentName(enrollment.studentId)} />
            <ReadOnlyField
              label="Materia"
              value={
                item
                  ? `${school.subjectName(item.subjectId)} · ${school.gradeName(item.gradeId)}`
                  : "-"
              }
            />
            <ReadOnlyField label="Fecha Matrícula" value={formatDate(enrollment.enrollmentDate)} />
            <SelectField label="Estado" options={ENROLLMENT_OPTIONS} {...form.bind("status")} />
          </div>
          <TextField
            label="Nota Final"
            type="number"
            min={1}
            max={5}
            step={0.1}
            hint="Opcional · escala 1.0 a 5.0"
            {...form.bind("finalScore")}
          />
          <TextareaField
            label="Observaciones"
            placeholder="Motivo del cambio de estado"
            {...form.bind("statusNote")}
          />
        </FormCard>
      }
      help={
        <HelpCard title="Información">
          <HelpList
            items={[
              "Solo el estado, la nota final y las observaciones son editables.",
              "Cancelada o retirada deja la materia fuera del cálculo de notas.",
              "La nota final de la matrícula es independiente de las notas del periodo.",
            ]}
          />
        </HelpCard>
      }
    />
  );
}
