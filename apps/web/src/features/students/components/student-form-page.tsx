import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, UserX } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { CanGate, useCan } from "@/features/access-control";
import {
  ActiveInstitutionGuard,
  campusChoices,
  FormPageLayout,
  HelpCard,
  INVALID_FORM_MESSAGE,
} from "@/features/institution";
import { LiveUsernamePreview } from "@/features/users";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";
import { isNotFoundError } from "@/shared/lib/orpc-error";

import { useAdmissionNotice } from "../hooks/use-admission-notice";
import {
  currentYearCourses,
  emptyStudentForm,
  studentToFormValues,
  toStudentCompleteInput,
  toStudentCreateInput,
  toStudentUpdateInput,
  type StudentCourseOption,
  type StudentFormValues,
} from "../lib/student-form";
import { STUDENT_PERMISSIONS } from "../lib/student-permissions";
import type { IncompleteStudentRow, StudentDetail } from "../types";
import ExistingUserBanner from "./existing-user-banner";
import StudentForm from "./student-form";

/** Which STU-03 screen (sige/05 §5.3): the route decides. */
export type StudentFormTarget =
  | { mode: "create" }
  | { mode: "complete"; personId: string }
  | { mode: "edit"; studentId: string };

const COPY = {
  create: {
    title: "Nuevo Estudiante",
    description: () => "Complete los datos para matricular un nuevo estudiante",
  },
  complete: {
    title: "Completar Perfil Académico",
    description: (name?: string) =>
      name
        ? `Complete la información académica de ${name}`
        : "Complete la información académica del estudiante",
  },
  edit: { title: "Editar Estudiante", description: () => "Modifica los datos del estudiante" },
} as const;

/**
 * STU-03 (container): `/estudiantes/nuevo` (path A), `/estudiantes/completar/$personId` (path B)
 * and `/estudiantes/$studentId/editar`. New and complete need `student:create`, edit
 * `student:update`; success toasts follow STU-R3 / "Estudiante actualizado", then STU-01.
 */
export default function StudentFormPage({ target }: { target: StudentFormTarget }) {
  const permission =
    target.mode === "edit" ? STUDENT_PERMISSIONS.update : STUDENT_PERMISSIONS.create;
  return (
    <ActiveInstitutionGuard pageName="sus estudiantes">
      <CanGate
        permission={permission}
        message="No tienes permiso para gestionar los estudiantes de esta institución."
      >
        <StudentFormLoader target={target} />
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function Header({ target, name }: { target: StudentFormTarget; name?: string }) {
  const copy = COPY[target.mode];
  return (
    <PageHeader
      title={copy.title}
      description={copy.description(name)}
      breadcrumbs={[{ label: "Estudiantes", to: "/estudiantes" }, { label: copy.title }]}
      actions={
        <Link to="/estudiantes" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft data-icon="inline-start" />
          Volver
        </Link>
      }
    />
  );
}

function StudentFormLoader({ target }: { target: StudentFormTarget }) {
  const institutionQuery = useQuery(orpc.institution.get.queryOptions());
  const campusesQuery = useQuery(orpc.campus.options.queryOptions());
  const coursesQuery = useQuery(orpc.course.options.queryOptions({ input: {} }));
  const studentQuery = useQuery({
    ...orpc.student.get.queryOptions({
      input: { id: target.mode === "edit" ? target.studentId : "" },
    }),
    enabled: target.mode === "edit",
  });
  const pendingQuery = useQuery({
    ...orpc.student.getIncomplete.queryOptions({
      input: { personId: target.mode === "complete" ? target.personId : "" },
    }),
    enabled: target.mode === "complete",
  });
  const subject =
    target.mode === "edit" ? studentQuery : target.mode === "complete" ? pendingQuery : null;

  if (subject?.isError && isNotFoundError(subject.error)) {
    return (
      <>
        <Header target={target} />
        <SubjectNotFound mode={target.mode} />
      </>
    );
  }
  const queries = [institutionQuery, campusesQuery, coursesQuery, ...(subject ? [subject] : [])];
  if (queries.some((query) => query.isError)) {
    return (
      <>
        <Header target={target} />
        <LoadError
          message="No se pudo cargar el formulario."
          onRetry={() => {
            for (const query of queries) {
              if (query.isError) {
                void query.refetch();
              }
            }
          }}
        />
      </>
    );
  }
  if (
    institutionQuery.data === undefined ||
    campusesQuery.data === undefined ||
    coursesQuery.data === undefined ||
    (subject !== null && subject.data === undefined)
  ) {
    return (
      <>
        <Header target={target} />
        <Loader />
      </>
    );
  }

  const courses = currentYearCourses(coursesQuery.data, institutionQuery.data.currentAcademicYear);
  const options = { campuses: campusesQuery.data, courses };
  if (target.mode === "edit" && studentQuery.data) {
    return (
      <>
        <Header target={target} />
        <EditStudent student={studentQuery.data} {...options} />
      </>
    );
  }
  if (target.mode === "complete" && pendingQuery.data) {
    return (
      <>
        <Header target={target} name={pendingQuery.data.name} />
        <CompleteStudent user={pendingQuery.data} {...options} />
      </>
    );
  }
  return (
    <>
      <Header target={target} />
      <CreateStudent {...options} />
    </>
  );
}

type FormOptions = {
  campuses: { id: string; name: string; isMain: boolean }[];
  courses: StudentCourseOption[];
};

/** Saves, refreshes the student queries and returns to STU-01. */
function useFinishSave() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: orpc.student.key() });
    await navigate({ to: "/estudiantes" });
  };
}

function CreateStudent({ campuses, courses }: FormOptions) {
  const createMutation = useMutation(orpc.student.create.mutationOptions());
  const notifyAdmission = useAdmissionNotice();
  const finish = useFinishSave();
  return (
    <StudentFormFrame mode="create">
      <StudentForm
        mode="create"
        initialValues={emptyStudentForm()}
        campuses={campuses}
        courses={courses}
        cancelTo="/estudiantes"
        onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
        renderUsernamePreview={(parts) => <LiveUsernamePreview {...parts} />}
        onSubmit={async (values) => {
          const input = toStudentCreateInput(values);
          const created = await createMutation.mutateAsync(input);
          await notifyAdmission(created.enrolled, input.courseId);
          await finish();
        }}
      />
    </StudentFormFrame>
  );
}

function CompleteStudent({
  user,
  campuses,
  courses,
}: FormOptions & { user: IncompleteStudentRow }) {
  const completeMutation = useMutation(orpc.student.complete.mutationOptions());
  const notifyAdmission = useAdmissionNotice();
  const finish = useFinishSave();
  const canListUsers = useCan(STUDENT_PERMISSIONS.listUsers).can;
  return (
    <StudentFormFrame mode="complete">
      <StudentForm
        key={user.personId}
        mode="complete"
        initialValues={emptyStudentForm()}
        campuses={campuses}
        courses={courses}
        // USR-01 per the spec, but only for callers who can open it (coordinators cannot).
        cancelTo={canListUsers ? "/usuarios" : "/estudiantes"}
        header={<ExistingUserBanner user={user} />}
        onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
        onSubmit={async (values) => {
          const input = toStudentCompleteInput(user.personId, values);
          const completed = await completeMutation.mutateAsync(input);
          await notifyAdmission(completed.enrolled, input.courseId);
          await finish();
        }}
      />
    </StudentFormFrame>
  );
}

function EditStudent({ student, campuses, courses }: FormOptions & { student: StudentDetail }) {
  const updateMutation = useMutation(orpc.student.update.mutationOptions());
  const finish = useFinishSave();
  const currentCourse: StudentCourseOption | null =
    student.courseId === null || student.courseName === null
      ? null
      : { id: student.courseId, name: student.courseName, campusId: student.campusId };
  return (
    <StudentFormFrame mode="edit">
      <StudentForm
        key={student.id}
        mode="edit"
        initialValues={studentToFormValues(student)}
        // A campus deactivated since stays selectable for the student it already holds.
        campuses={campusChoices(campuses, student)}
        courses={courses}
        currentCourse={currentCourse}
        cancelTo="/estudiantes"
        onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
        onSubmit={async (values: StudentFormValues) => {
          await updateMutation.mutateAsync(toStudentUpdateInput(student.id, values));
          toast.success("Estudiante actualizado");
          await finish();
        }}
      />
    </StudentFormFrame>
  );
}

const HELP: Record<StudentFormTarget["mode"], string[]> = {
  create: [
    "El username se genera con la inicial del nombre, el apellido y el documento.",
    "La contraseña inicial es el número de documento.",
    "Si eliges un grado, el estudiante se inscribe en todas sus materias.",
    "Los acudientes con cuenta se vinculan después desde el perfil.",
  ],
  complete: [
    "Si eliges un grado, el estudiante se inscribe en todas sus materias.",
    "Los acudientes con cuenta se vinculan después desde el perfil.",
  ],
  edit: [
    "El tipo y número de documento no se pueden modificar.",
    "Cambiar el grado aquí no modifica las matrículas por materia.",
    "Retirado o Graduado oculta al estudiante de la lista de activos.",
  ],
};

function StudentFormFrame({
  mode,
  children,
}: {
  mode: StudentFormTarget["mode"];
  children: ReactNode;
}) {
  return (
    <FormPageLayout
      form={children}
      help={
        <HelpCard title="Información">
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {HELP[mode].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </HelpCard>
      }
    />
  );
}

function SubjectNotFound({ mode }: { mode: StudentFormTarget["mode"] }) {
  // An unknown, out-of-scope or already completed id is NOT_FOUND (R1.15, sige/05 §5.3).
  const isUser = mode === "complete";
  return (
    <EmptyState
      icon={<UserX />}
      title={isUser ? "Usuario no encontrado" : "Estudiante no encontrado"}
      description={
        isUser
          ? "El usuario no existe, no es un estudiante o ya tiene un perfil académico."
          : "El estudiante no existe o no tienes acceso a su perfil."
      }
      action={
        <Link to="/estudiantes" className={buttonVariants()}>
          Volver a Estudiantes
        </Link>
      }
    />
  );
}
