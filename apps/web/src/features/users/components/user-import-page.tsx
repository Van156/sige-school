import { buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import {
  ImportFileCard,
  ImportPreviewCard,
  ImportProgressCard,
  ImportResult,
  TemplateDownloadButton,
  useImportFlow,
  useImportTemplate,
  type ImportPreviewColumn,
  type ImportProcedures,
} from "@/features/imports";
import { ActiveInstitutionGuard } from "@/features/institution";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import type { UserImportPreviewRow } from "../types";
import ImportFormatCard from "./import-format-card";

const USER_IMPORT: ImportProcedures<UserImportPreviewRow> = {
  preview: (input) => orpc.user.importPreview.call(input),
  start: (input) => orpc.user.importStart.call(input),
  invalidate: orpc.user.key(),
};

const PREVIEW_COLUMNS: readonly ImportPreviewColumn<UserImportPreviewRow>[] = [
  { header: "nombres", cell: (row) => row.nombres },
  { header: "apellidos", cell: (row) => row.apellidos },
  { header: "documento", cell: (row) => row.documento },
  { header: "rol", cell: (row) => row.rol },
];

const fetchTemplate = () => orpc.user.importTemplate.call();

/**
 * USR-04 `/usuarios/importar` (container): bulk user import from an `.xlsx`. Pick a file, review
 * the preview, start the import, follow its progress and read the result. Unreachable without
 * `user:import`. The running job id is kept in the URL so a reload resumes it.
 */
export default function UserImportPage({
  jobId,
  onJobChange,
}: {
  /** The running import, from the URL (`?job=`); `null` shows the picker. */
  jobId: string | null;
  onJobChange: (jobId: string | null) => void;
}) {
  return (
    <ActiveInstitutionGuard pageName="sus usuarios">
      <CanGate
        permission="user:import"
        message="No tienes permiso para importar usuarios en esta institución."
      >
        <PageHeader
          title="Importar Usuarios desde Excel"
          description="Carga masiva de usuarios desde archivo Excel"
          breadcrumbs={[{ label: "Usuarios", to: "/usuarios" }, { label: "Importar" }]}
          actions={
            <Link to="/usuarios" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft data-icon="inline-start" />
              Volver
            </Link>
          }
        />
        <ImportUsers jobId={jobId} onJobChange={onJobChange} />
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function ImportUsers({
  jobId,
  onJobChange,
}: {
  jobId: string | null;
  onJobChange: (jobId: string | null) => void;
}) {
  const flow = useImportFlow({ jobId, onJobChange, procedures: USER_IMPORT });
  const template = useImportTemplate({ fetchTemplate, filename: "plantilla-usuarios.xlsx" });

  if (flow.phase === "running" || flow.phase === "finished") {
    if (flow.job?.status === "done" || flow.job?.status === "failed") {
      return (
        <ImportResult
          job={flow.job}
          noun={{ one: "usuario", other: "usuarios" }}
          resetLabel="Importar otro archivo"
          listAction={
            <Link to="/usuarios" className={buttonVariants({ variant: "outline" })}>
              Ver usuarios
            </Link>
          }
          onReset={flow.reset}
        />
      );
    }
    if (flow.jobLoadFailed) {
      return (
        <LoadError
          message="No se pudo consultar el avance de la importación."
          onRetry={flow.retryJob}
        />
      );
    }
    return <ImportProgressCard processed={flow.job?.processed ?? 0} total={flow.job?.total ?? 0} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ImportFileCard
        title="Archivo Excel"
        error={flow.fileError}
        isBusy={flow.phase === "previewing"}
        onSelect={flow.select}
      >
        <div>
          <TemplateDownloadButton
            isDownloading={template.isPending}
            onDownload={template.download}
          />
        </div>
      </ImportFileCard>
      {flow.preview && flow.file ? (
        <ImportPreviewCard
          fileName={flow.file.name}
          preview={flow.preview}
          columns={PREVIEW_COLUMNS}
          importLabel="Importar Usuarios"
          startError={flow.startError}
          onImport={flow.start}
        />
      ) : null}
      <ImportFormatCard />
    </div>
  );
}
