import { buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { CanGate } from "@/features/access-control";
import { ActiveInstitutionGuard } from "@/features/institution";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { useImportTemplate } from "../hooks/use-import-template";
import { useUserImport } from "../hooks/use-user-import";
import ImportFileCard from "./import-file-card";
import ImportFormatCard from "./import-format-card";
import ImportPreviewCard from "./import-preview-card";
import ImportProgressCard from "./import-progress-card";
import ImportResult from "./import-result";

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
  const flow = useUserImport({ jobId, onJobChange });
  const template = useImportTemplate();

  if (flow.phase === "running" || flow.phase === "finished") {
    if (flow.job?.status === "done" || flow.job?.status === "failed") {
      return <ImportResult job={flow.job} onReset={flow.reset} />;
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
        error={flow.fileError}
        isBusy={flow.phase === "previewing"}
        isDownloading={template.isPending}
        onSelect={flow.select}
        onDownloadTemplate={template.download}
      />
      {flow.preview && flow.file ? (
        <ImportPreviewCard
          fileName={flow.file.name}
          preview={flow.preview}
          startError={flow.startError}
          onImport={flow.start}
        />
      ) : null}
      <ImportFormatCard />
    </div>
  );
}
