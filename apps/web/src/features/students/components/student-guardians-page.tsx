import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, List } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { CanGate, useCan } from "@/features/access-control";
import {
  ActiveInstitutionGuard,
  ConfirmDelete,
  mapSubmitError,
  useDeleteEntity,
} from "@/features/institution";
import PageHeader from "@/shared/components/layout/page-header";

import { useGuardianCandidates } from "../hooks/use-guardian-candidates";
import {
  GUARDIAN_LINK_FALLBACK,
  toGuardianLinkInput,
  type GuardianLinkFormValues,
} from "../lib/student-guardians";
import { STUDENT_PERMISSIONS } from "../lib/student-permissions";
import type { StudentDetail } from "../types";
import AssignedGuardiansCard from "./assigned-guardians-card";
import GuardianAssignCard from "./guardian-assign-card";
import StudentDetailLoader from "./student-detail-loader";
import StudentStrip from "./student-strip";

/**
 * STU-04 `/estudiantes/$studentId/acudientes` (container): links guardian accounts to a student
 * and unlinks them (sige/05 §5.4, STU-R6). Unreachable without `student:guardians`; accounts are
 * created in USR-02, this screen only links them.
 */
export default function StudentGuardiansPage({ studentId }: { studentId: string }) {
  return (
    <ActiveInstitutionGuard pageName="sus estudiantes">
      <CanGate
        permission={STUDENT_PERMISSIONS.guardians}
        message="No tienes permiso para asignar acudientes en esta institución."
      >
        <div className="flex flex-col gap-4">
          <PageHeader
            title="Asignar Acudientes"
            description="Vincula las cuentas de acudientes con el estudiante"
            breadcrumbs={[
              { label: "Estudiantes", to: "/estudiantes" },
              { label: "Asignar Acudientes" },
            ]}
            actions={
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/estudiantes/$studentId"
                  params={{ studentId }}
                  search={{ tab: "acudientes" }}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <ArrowLeft data-icon="inline-start" />
                  Volver al Perfil
                </Link>
                <Link to="/estudiantes" className={buttonVariants({ variant: "outline" })}>
                  <List data-icon="inline-start" />
                  Lista de Estudiantes
                </Link>
              </div>
            }
          />
          <StudentDetailLoader studentId={studentId}>
            {(student) => <StudentGuardians student={student} />}
          </StudentDetailLoader>
        </div>
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function StudentGuardians({ student }: { student: StudentDetail }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { candidates, status, term } = useGuardianCandidates(student.id, search);
  const canCreateGuardian = useCan(STUDENT_PERMISSIONS.createUser).can;

  // The student's links and the candidates both change with a link or an unlink.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.student.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.guardian.key() }),
    ]);

  const link = useMutation({
    ...orpc.guardian.link.mutationOptions(),
    onSuccess: async () => {
      toast.success("Acudiente asignado");
      await refresh();
    },
  });
  const linkError = link.isError
    ? mapSubmitError(link.error, { fields: [], fallback: GUARDIAN_LINK_FALLBACK }).formError
    : null;

  const unlink = useMutation(orpc.guardian.unlink.mutationOptions());
  const unlinking = useDeleteEntity<{ id: string; name: string }>({
    remove: async (target) => {
      await unlink.mutateAsync({ studentId: student.id, guardianPersonId: target.id });
      await queryClient.invalidateQueries({ queryKey: orpc.guardian.key() });
    },
    invalidate: orpc.student.key(),
    successMessage: () => "Acudiente desvinculado",
  });

  return (
    <>
      <StudentStrip student={student} />
      <div className="grid gap-4 lg:grid-cols-2">
        <GuardianAssignCard
          candidates={candidates}
          status={status}
          term={term}
          error={linkError}
          createGuardian={
            canCreateGuardian ? (
              <Link
                to="/usuarios/nuevo"
                search={{ role: "parent" }}
                className={buttonVariants({ size: "sm" })}
              >
                Crear acudiente primero
              </Link>
            ) : undefined
          }
          onSearchChange={setSearch}
          onSubmit={async (values: GuardianLinkFormValues) => {
            await link.mutateAsync(toGuardianLinkInput(student.id, values));
          }}
        />
        <AssignedGuardiansCard
          guardians={student.guardians}
          onUnlink={(guardian) =>
            unlinking.requestDelete({ id: guardian.guardianPersonId, name: guardian.name })
          }
        />
      </div>
      <ConfirmDelete
        {...unlinking.dialog}
        title="¿Eliminar este acudiente?"
        description={
          unlinking.target
            ? `${unlinking.target.name} dejará de estar vinculado a este estudiante.`
            : undefined
        }
      />
    </>
  );
}
