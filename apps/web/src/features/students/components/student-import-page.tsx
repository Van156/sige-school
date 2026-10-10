import { buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import {
  importScreen,
  useImportFlow,
  useImportTemplate,
  type ImportProcedures,
} from "@/features/imports";
import { ActiveInstitutionGuard } from "@/features/institution";
import PageHeader from "@/shared/components/layout/page-header";

import { STUDENT_IMPORT_TEMPLATE_FILENAME } from "../lib/student-import";
import { STUDENT_PERMISSIONS } from "../lib/student-permissions";
import type { StudentImportPreviewRow } from "../types";
import StudentImportView from "./student-import-view";

const STUDENT_IMPORT: ImportProcedures<StudentImportPreviewRow> = {
  preview: (input) => orpc.student.importPreview.call(input),
  start: (input) => orpc.student.importStart.call(input),
  invalidate: orpc.student.key(),
};

const fetchTemplate = () => orpc.student.importTemplate.call();

/**
 * STU-05 `/estudiantes/importar` (container): admission path C (STU-R2). Pick an `.xlsx`, review
 * the server preview, start the `students` job, follow its progress and read the result; a
 * running student import of the institution refuses the start ("Ya hay una importación en
 * curso."). Unreachable without `student:import`. The running job id is kept in the URL so a
 * reload resumes it.
 */
export default function StudentImportPage({
  jobId,
  onJobChange,
}: {
  /** The running import, from the URL (`?job=`); `null` shows the picker. */
  jobId: string | null;
  onJobChange: (jobId: string | null) => void;
}) {
  return (
    <ActiveInstitutionGuard pageName="sus estudiantes">
      <CanGate
        permission={STUDENT_PERMISSIONS.import}
        message="No tienes permiso para importar estudiantes en esta institución."
      >
        <PageHeader
          title="Cargar Estudiantes desde Excel"
          description="Carga masiva de estudiantes desde archivo Excel"
          breadcrumbs={[{ label: "Estudiantes", to: "/estudiantes" }, { label: "Importar" }]}
          actions={
            <Link to="/estudiantes" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft data-icon="inline-start" />
              Volver
            </Link>
          }
        />
        <ImportStudents jobId={jobId} onJobChange={onJobChange} />
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function ImportStudents({
  jobId,
  onJobChange,
}: {
  jobId: string | null;
  onJobChange: (jobId: string | null) => void;
}) {
  const flow = useImportFlow({ jobId, onJobChange, procedures: STUDENT_IMPORT });
  const template = useImportTemplate({
    fetchTemplate,
    filename: STUDENT_IMPORT_TEMPLATE_FILENAME,
  });
  return (
    <StudentImportView
      screen={importScreen(flow)}
      isDownloadingTemplate={template.isPending}
      onDownloadTemplate={template.download}
      onSelect={flow.select}
      onStart={flow.start}
      onReset={flow.reset}
      onRetryJob={flow.retryJob}
    />
  );
}
