import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { Link } from "@tanstack/react-router";
import { CircleAlert, CircleCheck } from "lucide-react";

import { GENERATION_FAILURE_MESSAGE, isEmptyResult } from "../lib/schedule-generation";
import type { ScheduleGenerationResult } from "../types";

export type GenerationOutcome =
  | { kind: "done"; result: ScheduleGenerationResult; viewCourseId: string | undefined }
  | { kind: "failed" };

/**
 * SCH-12 card "Resultado" (sige/04 §5.4). A run that placed classes shows the success callout, the
 * counts, the skipped courses with their reasons and "Ver Horario"; `assigned = 0` and a failed
 * request show the error callout. Presentational.
 */
export default function GenerationResult({ outcome }: { outcome: GenerationOutcome }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Resultado</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {outcome.kind === "failed" ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Error al generar horario</AlertTitle>
            <AlertDescription>{GENERATION_FAILURE_MESSAGE}</AlertDescription>
          </Alert>
        ) : (
          <DoneBody result={outcome.result} viewCourseId={outcome.viewCourseId} />
        )}
      </CardContent>
    </Card>
  );
}

function DoneBody({
  result,
  viewCourseId,
}: {
  result: ScheduleGenerationResult;
  viewCourseId: string | undefined;
}) {
  const { assigned, conflicts, courses, skipped } = result;
  return (
    <>
      {isEmptyResult(result) ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error al generar horario</AlertTitle>
          <AlertDescription>
            No se pudieron generar horarios. Verifique que existan materias asignadas y salones
            disponibles.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CircleCheck />
          <AlertTitle>Horario generado exitosamente</AlertTitle>
          <AlertDescription>
            <p>
              <strong className="font-medium text-foreground">{assigned}</strong> clases asignadas
              {" · "}
              {conflicts > 0 ? (
                <>
                  <strong className="font-medium text-foreground">{conflicts}</strong> conflictos
                  encontrados
                </>
              ) : (
                "Sin conflictos"
              )}
            </p>
            <p>
              <strong className="font-medium text-foreground">{courses}</strong> grados procesados
            </p>
          </AlertDescription>
        </Alert>
      )}
      {skipped.length > 0 ? (
        <div className="flex flex-col gap-2 text-sm">
          <h3 className="font-medium">Grados omitidos</h3>
          <ul className="flex flex-col gap-1">
            {skipped.map((entry) => (
              <li key={entry.courseId}>
                <span className="font-medium">{entry.courseName}</span>
                <span className="text-muted-foreground">: {entry.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {!isEmptyResult(result) ? (
        <div>
          <Link
            to="/horarios"
            search={viewCourseId ? { courseId: viewCourseId } : {}}
            className={buttonVariants()}
          >
            Ver Horario
          </Link>
        </div>
      ) : null}
    </>
  );
}
