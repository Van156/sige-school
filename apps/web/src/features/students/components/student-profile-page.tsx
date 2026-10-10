import { buttonVariants } from "@base-template/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, UserX } from "lucide-react";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import { ActiveInstitutionGuard } from "@/features/institution";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { STUDENT_PERMISSIONS } from "../lib/student-permissions";
import StudentStrip from "./student-strip";

/**
 * STU-02 `/estudiantes/$studentId` (container), first cut: the identity strip of `student.get`
 * so STU-01 rows have a typed destination. The tabs (información, horario, acudientes) and the
 * action cards arrive with the full STU-02.
 */
export default function StudentProfilePage({ studentId }: { studentId: string }) {
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
          <StudentProfile studentId={studentId} />
        </div>
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function StudentProfile({ studentId }: { studentId: string }) {
  const detailQuery = useQuery(orpc.student.get.queryOptions({ input: { id: studentId } }));

  if (detailQuery.isPending) {
    return <Loader />;
  }
  if (detailQuery.isError && detailQuery.data === undefined) {
    // An unknown or out-of-scope id is NOT_FOUND (R1.15).
    return (detailQuery.error as { code?: unknown }).code === "NOT_FOUND" ? (
      <EmptyState
        icon={<UserX />}
        title="Estudiante no encontrado"
        description="El estudiante no existe o no tienes acceso a su perfil."
        action={
          <Link to="/estudiantes" className={buttonVariants()}>
            Volver a Estudiantes
          </Link>
        }
      />
    ) : (
      <LoadError
        message="No se pudo cargar el estudiante."
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }
  const student = detailQuery.data;
  return student === undefined ? null : <StudentStrip student={student} />;
}
