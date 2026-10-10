import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";

import { pickedCourseOptions, studentsOfCourse } from "../lib/student-picker";
import type { PickedStudent } from "../types";

type ChildrenSwitcherProps = {
  mode: "children";
  /** The parent's linked children (`student.pick`). */
  students: readonly PickedStudent[];
  selectedId: string | undefined;
  onSelect: (studentId: string) => void;
};

type StaffSwitcherProps = {
  mode: "staff";
  /** The students in the caller's scope (`student.pick`). */
  students: readonly PickedStudent[];
  selectedId: string | undefined;
  /** `undefined` clears the choice ("Seleccionar estudiante..."). */
  onSelect: (studentId: string | undefined) => void;
  /** The "Filtrar estudiantes por grado" choice; `""` is every course. */
  courseId: string;
  onCourseChange: (courseId: string) => void;
};

export type StudentSwitcherProps = { mode: "self" } | ChildrenSwitcherProps | StaffSwitcherProps;

/**
 * Chooses the student of a per-student screen (sige/05 §5.6). Staff filter by course then pick a
 * student; a parent with two or more children switches with the "Hijo/a:" buttons; a student (or
 * a parent with one child) has nothing to choose, so nothing renders. Presentational: the caller
 * owns `student.pick` and where the choice is stored (usually `?student=`).
 */
export default function StudentSwitcher(props: StudentSwitcherProps) {
  switch (props.mode) {
    case "self":
      return null;
    case "children":
      return <ChildrenSwitcher {...props} />;
    case "staff":
      return <StaffSwitcher {...props} />;
  }
}

function ChildrenSwitcher({ students, selectedId, onSelect }: ChildrenSwitcherProps) {
  if (students.length < 2) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Elegir hijo/a">
      <span className="text-[13px] text-muted-foreground">Hijo/a:</span>
      {students.map((student) => {
        const selected = student.id === selectedId;
        return (
          <Button
            key={student.id}
            size="sm"
            variant={selected ? "default" : "outline"}
            aria-pressed={selected}
            onClick={() => onSelect(student.id)}
          >
            {student.name}
          </Button>
        );
      })}
    </div>
  );
}

function StaffSwitcher({
  students,
  selectedId,
  onSelect,
  courseId,
  onCourseChange,
}: StaffSwitcherProps) {
  const courses = pickedCourseOptions(students);
  const candidates = studentsOfCourse(students, courseId);
  const selected = students.find((student) => student.id === selectedId);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <NativeSelect
        aria-label="Filtrar estudiantes por grado"
        value={courseId}
        onChange={(event) => onCourseChange(event.target.value)}
      >
        <NativeSelectOption value="">Todos los grados</NativeSelectOption>
        {courses.map((course) => (
          <NativeSelectOption key={course.value} value={course.value}>
            {course.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Estudiante"
        value={selected && candidates.includes(selected) ? selected.id : ""}
        onChange={(event) => onSelect(event.target.value || undefined)}
      >
        <NativeSelectOption value="">Seleccionar estudiante...</NativeSelectOption>
        {candidates.map((student) => (
          <NativeSelectOption key={student.id} value={student.id}>
            {student.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {selected ? <Badge variant="outline">{selected.courseName ?? "Sin curso"}</Badge> : null}
    </div>
  );
}
