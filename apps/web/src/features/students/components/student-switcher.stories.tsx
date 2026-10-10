import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import type { PickedStudent } from "../types";
import StudentSwitcher from "./student-switcher";

const student = (
  id: string,
  name: string,
  courseId: string | null,
  courseName: string | null,
): PickedStudent => ({ id, name, document: `10${id}`, courseId, courseName, status: "activo" });

const STUDENTS: PickedStudent[] = [
  student("s1", "Isabella Gómez Herrera", "c6", "6-01"),
  student("s2", "Julián López Rojas", "c6", "6-01"),
  student("s3", "Mateo Ruiz Castro", "c7", "7-01"),
  student("s4", "Valentina Díaz Mora", "c10", "10-01"),
];

const meta = {
  title: "Students/StudentSwitcher",
  component: StudentSwitcher,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { mode: "self" },
} satisfies Meta<typeof StudentSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A student has nothing to choose: the switcher renders nothing. */
export const Self: Story = {};

function StaffDemo({ initialId }: { initialId?: string }) {
  const [courseId, setCourseId] = useState("");
  const [selectedId, setSelectedId] = useState(initialId);
  return (
    <StudentSwitcher
      mode="staff"
      students={STUDENTS}
      courseId={courseId}
      onCourseChange={setCourseId}
      selectedId={selectedId}
      onSelect={setSelectedId}
    />
  );
}

/** Staff before choosing: "Seleccionar estudiante...". */
export const StaffUnselected: Story = { render: () => <StaffDemo /> };

/** Staff with a student chosen: the course badge follows the choice. */
export const StaffSelected: Story = { render: () => <StaffDemo initialId="s3" /> };

function ChildrenDemo({ students }: { students: PickedStudent[] }) {
  const [selectedId, setSelectedId] = useState(students[0]?.id);
  return (
    <StudentSwitcher
      mode="children"
      students={students}
      selectedId={selectedId}
      onSelect={setSelectedId}
    />
  );
}

/** A parent with two children switches with the "Hijo/a:" buttons. */
export const ParentWithChildren: Story = {
  render: () => <ChildrenDemo students={STUDENTS.slice(0, 2)} />,
};

/** A parent with a single child has nothing to switch: nothing renders. */
export const ParentWithOneChild: Story = {
  render: () => <ChildrenDemo students={STUDENTS.slice(0, 1)} />,
};
