import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";

import {
  ImportFileCard,
  ImportPreviewCard,
  ImportProgressCard,
  ImportResult,
  TemplateDownloadButton,
  type ImportPreviewColumn,
  type ImportScreen,
} from "@/features/imports";
import LoadError from "@/shared/components/feedback/load-error";

import { STUDENT_IMPORT_NOTICE, STUDENT_IMPORT_NOUN } from "../lib/student-import";
import type { StudentImportPreviewRow } from "../types";
import StudentImportFormatCard from "./student-import-format-card";

const PREVIEW_COLUMNS: readonly ImportPreviewColumn<StudentImportPreviewRow>[] = [
  { header: "nombre", cell: (row) => row.nombre },
  { header: "apellido", cell: (row) => row.apellido },
  {
    header: "documento",
    cell: (row) => <span className="font-mono text-xs">{row.documento || "-"}</span>,
  },
  { header: "grado", cell: (row) => row.grado },
];

/**
 * STU-05 body (sige/05 §5.5, STU-R8): "Subir Archivo" with the "Importante" callout, then the
 * server preview with "Cargar Estudiantes" / "Cancelar"; once started, the progress and the
 * result. "Formato Requerido" with "Descargar Plantilla" sits beside it. Presentational: `screen`
 * is the flow's state (`importScreen`).
 */
export default function StudentImportView({
  screen,
  isDownloadingTemplate = false,
  onDownloadTemplate,
  onSelect,
  onStart,
  onReset,
  onRetryJob,
}: {
  screen: ImportScreen<StudentImportPreviewRow>;
  isDownloadingTemplate?: boolean;
  onDownloadTemplate: () => void;
  onSelect: (file: File | null) => void;
  onStart: () => void;
  onReset: () => void;
  onRetryJob: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <ImportBody
          screen={screen}
          onSelect={onSelect}
          onStart={onStart}
          onReset={onReset}
          onRetryJob={onRetryJob}
        />
      </div>
      <StudentImportFormatCard
        download={
          <TemplateDownloadButton
            size="sm"
            isDownloading={isDownloadingTemplate}
            onDownload={onDownloadTemplate}
          />
        }
      />
    </div>
  );
}

function ImportBody({
  screen,
  onSelect,
  onStart,
  onReset,
  onRetryJob,
}: {
  screen: ImportScreen<StudentImportPreviewRow>;
  onSelect: (file: File | null) => void;
  onStart: () => void;
  onReset: () => void;
  onRetryJob: () => void;
}) {
  switch (screen.kind) {
    case "result":
      return (
        <ImportResult
          job={screen.job}
          noun={STUDENT_IMPORT_NOUN}
          resetLabel="Cargar otro archivo"
          listAction={
            <Link to="/estudiantes" className={buttonVariants({ variant: "outline" })}>
              Ver estudiantes
            </Link>
          }
          onReset={onReset}
        />
      );
    case "job-error":
      return (
        <LoadError
          message="No se pudo consultar el avance de la importación."
          onRetry={onRetryJob}
        />
      );
    case "progress":
      return <ImportProgressCard processed={screen.processed} total={screen.total} />;
    case "picker":
      return (
        <>
          <ImportFileCard
            title="Subir Archivo"
            label="Archivo Excel (.xlsx) *"
            hint="Tamaño máximo: 10MB"
            error={screen.fileError}
            isBusy={screen.isBusy}
            onSelect={onSelect}
          >
            <Alert>
              <Info />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>{STUDENT_IMPORT_NOTICE}</AlertDescription>
            </Alert>
          </ImportFileCard>
          {screen.preview ? (
            <ImportPreviewCard
              fileName={screen.preview.fileName}
              preview={screen.preview.data}
              columns={PREVIEW_COLUMNS}
              importLabel="Cargar Estudiantes"
              startError={screen.preview.startError}
              onImport={onStart}
              actions={
                <Link to="/estudiantes" className={buttonVariants({ variant: "outline" })}>
                  Cancelar
                </Link>
              }
            />
          ) : null}
        </>
      );
  }
}
