import { Button, buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Trash2, UsersRound } from "lucide-react";

import { orpc } from "@/app/orpc";
import { CanGate, useCan } from "@/features/access-control";
import { ActiveInstitutionGuard, ConfirmDelete, useDeleteEntity } from "@/features/institution";
import PageHeader from "@/shared/components/layout/page-header";

import type { StudentProfileSearch, StudentProfileTab } from "../lib/student-profile";
import { STUDENT_PERMISSIONS } from "../lib/student-permissions";
import type { StudentDetail } from "../types";
import StudentDetailLoader from "./student-detail-loader";
import StudentGuardiansTab from "./student-guardians-tab";
import StudentIdentityCard from "./student-identity-card";
import StudentInfoTab from "./student-info-tab";
import StudentProfileTabs from "./student-profile-tabs";
import StudentScheduleTab, { type StudentScheduleState } from "./student-schedule-tab";
import StudentStrip from "./student-strip";

/**
 * STU-02 `/estudiantes/$studentId` (container): the identity strip with the caller's actions
 * ("Editar", "Asignar Acudientes", "Eliminar"), the "Identidad" card and the tabs of `?tab=`; the
 * "Acudientes" tab links to STU-04 through "Gestionar". Action cards point to screens not built
 * yet and stay hidden (D7).
 */
export default function StudentProfilePage({
  studentId,
  search,
}: {
  studentId: string;
  search: StudentProfileSearch;
}) {
  return (
    <ActiveInstitutionGuard pageName="sus estudiantes">
      <CanGate
        permission={STUDENT_PERMISSIONS.list}
        message="No tienes permiso para ver los estudiantes de esta institución."
      >
        <div className="flex flex-col gap-4">
          <PageHeader
            title="Perfil del Estudiante"
            description="Información académica, horario y acudientes"
            breadcrumbs={[
              { label: "Estudiantes", to: "/estudiantes" },
              { label: "Perfil del Estudiante" },
            ]}
            actions={
              <Link to="/estudiantes" className={buttonVariants({ variant: "outline" })}>
                <ArrowLeft data-icon="inline-start" />
                Volver
              </Link>
            }
          />
          <StudentProfile studentId={studentId} tab={search.tab} />
        </div>
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function StudentProfile({ studentId, tab }: { studentId: string; tab: StudentProfileTab }) {
  return (
    <StudentDetailLoader studentId={studentId}>
      {(student) => <StudentProfileContent student={student} tab={tab} />}
    </StudentDetailLoader>
  );
}

function StudentProfileContent({
  student,
  tab,
}: {
  student: StudentDetail;
  tab: StudentProfileTab;
}) {
  const navigate = useNavigate({ from: "/estudiantes/$studentId/" });
  const canUpdate = useCan(STUDENT_PERMISSIONS.update).can;
  const canDelete = useCan(STUDENT_PERMISSIONS.delete).can;
  const canManageGuardians = useCan(STUDENT_PERMISSIONS.guardians).can;

  const deleteStudent = useMutation(orpc.student.delete.mutationOptions());
  const deletion = useDeleteEntity<{ id: string; name: string }>({
    remove: async (target) => {
      await deleteStudent.mutateAsync({ id: target.id });
      // Leave before the student queries refresh, so the deleted profile never refetches.
      await navigate({ to: "/estudiantes" });
    },
    invalidate: orpc.student.key(),
    successMessage: () => "Estudiante eliminado",
  });

  return (
    <>
      <StudentStrip
        student={student}
        actions={
          canUpdate || canManageGuardians || canDelete ? (
            <div className="flex flex-wrap gap-2">
              {canUpdate ? (
                <Link
                  to="/estudiantes/$studentId/editar"
                  params={{ studentId: student.id }}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Pencil data-icon="inline-start" />
                  Editar
                </Link>
              ) : null}
              {canManageGuardians ? (
                <Link
                  to="/estudiantes/$studentId/acudientes"
                  params={{ studentId: student.id }}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <UsersRound data-icon="inline-start" />
                  Asignar Acudientes
                </Link>
              ) : null}
              {canDelete ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deletion.requestDelete({ id: student.id, name: student.name })}
                >
                  <Trash2 data-icon="inline-start" />
                  Eliminar
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <StudentIdentityCard student={student} />
        </div>
        <div className="lg:col-span-2">
          <StudentProfileTabs
            tab={tab}
            onTabChange={(next) =>
              void navigate({ search: (previous) => ({ ...previous, tab: next }), replace: true })
            }
            panels={{
              info: <StudentInfoTab student={student} />,
              horario: (
                <StudentSchedule courseId={student.courseId} courseName={student.courseName} />
              ),
              acudientes: (
                <StudentGuardiansTab
                  student={student}
                  manage={
                    canManageGuardians ? (
                      <Link
                        to="/estudiantes/$studentId/acudientes"
                        params={{ studentId: student.id }}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Gestionar
                      </Link>
                    ) : undefined
                  }
                />
              ),
            }}
          />
        </div>
      </div>
      <ConfirmDelete
        {...deletion.dialog}
        title="¿Eliminar este estudiante?"
        description="Esta acción no se puede deshacer."
      />
    </>
  );
}

/** "Horario" tab (container): the course grid of `schedule.get`, fetched only while it shows. */
function StudentSchedule({
  courseId,
  courseName,
}: {
  courseId: string | null;
  courseName: string | null;
}) {
  const canOpenCourseSchedule = useCan(STUDENT_PERMISSIONS.courseSchedule).can;
  const scheduleQuery = useQuery({
    ...orpc.schedule.get.queryOptions({ input: { view: "course", courseId: courseId ?? "" } }),
    enabled: courseId !== null,
  });

  if (courseId === null || courseName === null) {
    return <StudentScheduleTab state={{ status: "no-course" }} />;
  }
  const state: StudentScheduleState = scheduleQuery.data
    ? { status: "ready", courseName, schedule: scheduleQuery.data }
    : scheduleQuery.isError
      ? { status: "error", courseName, onRetry: () => void scheduleQuery.refetch() }
      : { status: "loading", courseName };
  return (
    <StudentScheduleTab
      state={state}
      fullScreenLink={
        // The course view of SCH-11 is the managers' (teachers see their own grid there).
        canOpenCourseSchedule ? (
          <Link
            to="/horarios"
            search={{ courseId }}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Ver en pantalla completa
          </Link>
        ) : undefined
      }
    />
  );
}
