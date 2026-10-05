import { FilterSelect } from "./filter-select";
import { fullName } from "../-mock";
import { useGoToScreen } from "../-lib/use-go-to-screen";
import type { TeacherScope } from "../-lib/use-teacher-scope";

/** "Seleccionar docente" control of the teacher metrics; hidden for the teacher role. */
export function TeacherSelect({ screenId, scope }: { screenId: string; scope: TeacherScope }) {
  const goTo = useGoToScreen();
  if (!scope.canSwitch) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-muted-foreground">Docente:</span>
      <FilterSelect
        label="Seleccionar docente"
        value={scope.teacherId === undefined ? "" : String(scope.teacherId)}
        onValueChange={(value) => goTo(screenId, { teacher: value || undefined })}
        options={scope.teachers.map((teacher) => ({
          value: String(teacher.id),
          label: fullName(teacher),
        }))}
        allLabel="Seleccionar docente..."
      />
    </div>
  );
}
