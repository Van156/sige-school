import { ReadOnlyField, SelectField, TextareaField } from "../../-components/form-fields";
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
import {
  ASSIGNMENT_OPTIONS,
  gradeOptions,
  subjectOptions,
  teacherOptions,
  toAssignmentStatus,
} from "../../-lib/school-options";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useSchool, type School } from "../../-lib/use-school";
import { useIdParam } from "../../-lib/use-search-params";
import { blankToUndefined } from "../../-lib/user-options";
import { assignTeacher, assignmentStore, mockAction } from "../../-mock";
import type { Institution, TeacherSubjectAssignment } from "../../-mock/types";

/** SCH-04: assign a teacher to a (course, subject) or edit an assignment (`?id=`). */
export function AssignmentFormScreen() {
  const id = useIdParam();

  return (
    <ScopedPage
      screenId="SCH-04"
      title={id === undefined ? "Nueva Asignación de Profesor" : "Editar Asignación"}
      description="Asigna un profesor a una materia de un grado"
      actions={<BackButton screenId="SCH-03" />}
      target="Asignaciones"
    >
      {(institution) => <AssignmentFormLoader institution={institution} id={id} />}
    </ScopedPage>
  );
}

function AssignmentFormLoader({ institution, id }: { institution: Institution; id?: number }) {
  const school = useSchool(institution.id);
  if (id === undefined) return <CreateAssignmentForm institution={institution} school={school} />;
  const assignment = school.assignments.find((row) => row.id === id);
  return assignment ? (
    <EditAssignmentForm key={assignment.id} assignment={assignment} school={school} />
  ) : (
    <NotFoundBlock entity="La asignación" backScreenId="SCH-03" />
  );
}

const HELP = (
  <HelpCard title="Información">
    <HelpList
      items={[
        "Si la materia ya existe en el grado, solo cambia su profesor.",
        "Si no existe, se crea con 4 horas semanales.",
        "El profesor solo puede tomar notas y asistencia de sus asignaciones.",
        "Una materia de un grado tiene un único profesor.",
      ]}
    />
  </HelpCard>
);

interface CreateValues {
  gradeId: string;
  subjectId: string;
  teacherId: string;
}

function CreateAssignmentForm({
  institution,
  school,
}: {
  institution: Institution;
  school: School;
}) {
  const goTo = useGoToScreen();
  const form = useSimpleForm<CreateValues>(
    { gradeId: "", subjectId: "", teacherId: "" },
    (values) => {
      const errors: FormErrors<CreateValues> = {};
      if (!values.gradeId) errors.gradeId = "Debes seleccionar un grado.";
      if (!values.subjectId) errors.subjectId = "Debes seleccionar una materia.";
      if (!values.teacherId) errors.teacherId = "Debes seleccionar un profesor.";
      return errors;
    },
  );

  const submit = form.handleSubmit((values) => {
    assignTeacher({
      gradeId: Number(values.gradeId),
      subjectId: Number(values.subjectId),
      teacherId: Number(values.teacherId),
      academicYear: institution.academicYear,
    });
    mockAction(
      "Profesor asignado",
      `${school.userName(Number(values.teacherId))} · ${school.subjectName(Number(values.subjectId))}`,
    );
    goTo("SCH-03");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Nueva Asignación"
          onSubmit={submit}
          submitLabel="Asignar Profesor"
          cancelScreenId="SCH-03"
        >
          <SelectField
            label="Grado"
            required
            placeholder="Seleccione un grado"
            options={gradeOptions(school.grades)}
            {...form.bind("gradeId")}
          />
          <SelectField
            label="Materia"
            required
            placeholder="Seleccione una materia"
            options={subjectOptions(school.subjects)}
            {...form.bind("subjectId")}
          />
          <SelectField
            label="Profesor"
            required
            placeholder="Seleccione un profesor"
            options={teacherOptions(school.teachers)}
            {...form.bind("teacherId")}
          />
        </FormCard>
      }
      help={HELP}
    />
  );
}

interface EditValues {
  status: string;
  notes: string;
}

function EditAssignmentForm({
  assignment,
  school,
}: {
  assignment: TeacherSubjectAssignment;
  school: School;
}) {
  const goTo = useGoToScreen();
  const item = school.subjectGradeById.get(assignment.subjectGradeId);
  const form = useSimpleForm<EditValues>(
    { status: assignment.status, notes: assignment.notes ?? "" },
    () => ({}),
  );

  const submit = form.handleSubmit((values) => {
    assignmentStore.update(assignment.id, {
      status: toAssignmentStatus(values.status),
      notes: blankToUndefined(values.notes),
    });
    mockAction("Asignación actualizada", "Los cambios no se guardan en el prototipo.");
    goTo("SCH-03");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos de la Asignación"
          onSubmit={submit}
          submitLabel="Guardar Cambios"
          cancelScreenId="SCH-03"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField label="Profesor" value={school.userName(assignment.teacherId) ?? "-"} />
            <ReadOnlyField
              label="Materia"
              value={item ? school.subjectName(item.subjectId) : "-"}
            />
            <ReadOnlyField label="Grado" value={school.gradeName(item?.gradeId) ?? "-"} />
            <ReadOnlyField label="Fecha Asignación" value={formatDate(assignment.assignmentDate)} />
          </div>
          <SelectField label="Estado" options={ASSIGNMENT_OPTIONS} {...form.bind("status")} />
          <TextareaField
            label="Observaciones"
            placeholder="Ej: Reemplazo temporal por incapacidad"
            {...form.bind("notes")}
          />
        </FormCard>
      }
      help={HELP}
    />
  );
}
