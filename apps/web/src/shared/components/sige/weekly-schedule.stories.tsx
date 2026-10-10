import type { Meta, StoryObj } from "@storybook/react-vite";
import type { SlotCell, WeeklyScheduleRow } from "@base-template/sige-core";

import WeeklySchedule from "./weekly-schedule";

const cell = (id: string, subjectName: string, teacherName: string | null, courseName = "6-01") =>
  ({
    slotId: id,
    offeringId: `o-${id}`,
    subjectName,
    teacherName,
    classroomName: "Aula 101",
    courseName,
  }) satisfies SlotCell;

const MATH = cell("s1", "Matemáticas", "Marcela Ortiz");
const SCIENCE = cell("s2", "Ciencias Naturales", "Luis Pérez");
const ENGLISH = cell("s3", "Inglés", null);

const ROWS: WeeklyScheduleRow[] = [
  { time: "07:00 - 08:00", isBreak: false, cells: [MATH, SCIENCE, null, MATH, ENGLISH] },
  { time: "08:00 - 09:00", isBreak: false, cells: [SCIENCE, null, MATH, null, MATH] },
  { time: "09:00 - 09:30", isBreak: true, cells: [null, null, null, null, null] },
  { time: "09:30 - 10:30", isBreak: false, cells: [ENGLISH, MATH, SCIENCE, ENGLISH, null] },
];

const meta = {
  title: "Shared/Sige/WeeklySchedule",
  component: WeeklySchedule,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { rows: ROWS },
} satisfies Meta<typeof WeeklySchedule>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Course view: subject, teacher and classroom per cell; breaks flagged "Descanso". */
export const CourseView: Story = {};

/** Teacher view: the course badge tells which grade each class is for. */
export const TeacherView: Story = {
  args: {
    showCourse: true,
    rows: [
      {
        time: "07:00 - 08:00",
        isBreak: false,
        cells: [cell("t1", "Matemáticas", "Marcela Ortiz", "6-01"), null, null, null, null],
      },
      {
        time: "08:00 - 09:00",
        isBreak: false,
        cells: [null, cell("t2", "Matemáticas", "Marcela Ortiz", "7-02"), null, null, null],
      },
    ],
  },
};

/** Managers get a remove button per class. */
export const WithRemove: Story = {
  args: { onRemove: () => undefined },
};

/** A block row with no classes assigned yet. */
export const Empty: Story = {
  args: {
    rows: ROWS.map((row) => ({ ...row, cells: [null, null, null, null, null] })),
  },
};
