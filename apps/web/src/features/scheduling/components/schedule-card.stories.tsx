import { Button } from "@base-template/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import type { Meta, StoryObj } from "@storybook/react-vite";

import ScheduleCard from "./schedule-card";

const MATH = {
  slotId: "s1",
  offeringId: "o1",
  subjectName: "Matemáticas",
  teacherName: "Marcela Ortiz",
  classroomName: "Aula 101",
  courseName: "6-01",
};

const FILLED = {
  title: "Horario del grado 6-01",
  rows: [
    { time: "07:00 - 08:00", isBreak: false, cells: [MATH, null, MATH, null, null] },
    { time: "08:00 - 08:30", isBreak: true, cells: [null, null, null, null, null] },
  ],
};

const meta = {
  title: "Scheduling/ScheduleCard",
  component: ScheduleCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { schedule: FILLED },
} satisfies Meta<typeof ScheduleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ManagerWithFilter: Story = {
  args: {
    onRemove: () => undefined,
    filter: (
      <NativeSelect aria-label="Filtrar por grado" defaultValue="c1">
        <NativeSelectOption value="c1">6-01</NativeSelectOption>
        <NativeSelectOption value="c2">7-01</NativeSelectOption>
      </NativeSelect>
    ),
  },
};

export const TeacherView: Story = {
  args: { showCourse: true, schedule: { ...FILLED, title: "Horario de Marcela Ortiz" } },
};

const EMPTY = {
  title: "Horario del grado 6-01",
  rows: [{ time: "07:00 - 08:00", isBreak: false, cells: [null, null, null, null, null] }],
};

export const Empty: Story = { args: { schedule: EMPTY } };

export const EmptyWithAction: Story = {
  args: { schedule: EMPTY, emptyAction: <Button>Generar Horario Automático</Button> },
};
