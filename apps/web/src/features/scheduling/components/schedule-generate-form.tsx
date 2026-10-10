import { Button } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { Field, FieldLabel } from "@base-template/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { Wand2 } from "lucide-react";
import { useId, useState } from "react";

import {
  coursesOfCampus,
  EMPTY_GENERATION_PARAMS,
  type GenerationCourse,
  type GenerationParams,
} from "../lib/schedule-generation";

/**
 * SCH-12 card "Parámetros" (sige/04 §5.4): "Sede" and "Grado (opcional)", the courses narrowed to
 * the chosen campus. Presentational: `onSubmit` receives the selections ("" is "all"); `isBusy`
 * disables the button while a run is checking or running.
 */
export default function ScheduleGenerateForm({
  campuses,
  courses,
  isBusy,
  onSubmit,
}: {
  campuses: readonly { id: string; name: string }[];
  courses: readonly GenerationCourse[];
  isBusy: boolean;
  onSubmit: (params: GenerationParams) => void;
}) {
  const [params, setParams] = useState<GenerationParams>(EMPTY_GENERATION_PARAMS);
  const campusId = useId();
  const courseId = useId();
  const visibleCourses = coursesOfCampus(courses, params.campusId);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Parámetros</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(params);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={campusId}>Sede</FieldLabel>
              <NativeSelect
                id={campusId}
                className="w-full"
                value={params.campusId}
                onChange={(event) => setParams({ campusId: event.target.value, courseId: "" })}
              >
                <NativeSelectOption value="">Todas las sedes</NativeSelectOption>
                {campuses.map((campus) => (
                  <NativeSelectOption key={campus.id} value={campus.id}>
                    {campus.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor={courseId}>Grado (opcional)</FieldLabel>
              <NativeSelect
                id={courseId}
                className="w-full"
                value={params.courseId}
                onChange={(event) => setParams({ ...params, courseId: event.target.value })}
              >
                <NativeSelectOption value="">Todos los grados</NativeSelectOption>
                {visibleCourses.map((course) => (
                  <NativeSelectOption key={course.id} value={course.id}>
                    {course.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div>
            <Button type="submit" disabled={isBusy}>
              <Wand2 data-icon="inline-start" />
              Generar Horario
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
