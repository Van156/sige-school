import { Button } from "@base-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";

import StudentScheduleTab from "./student-schedule-tab";

const cell = (subjectName: string, teacherName: string) => ({
  slotId: `${subjectName}-${teacherName}`,
  offeringId: subjectName,
  subjectName,
  teacherName,
  classroomName: "Aula 101",
  courseName: "6-01",
});

const SCHEDULE = {
  title: "Horario de 6-01",
  rows: [
    {
      time: "07:00 - 08:00",
      isBreak: false,
      cells: [
        cell("Matemáticas", "Carlos Rodríguez"),
        cell("Español", "Ana Martínez"),
        null,
        cell("Ciencias", "Luis Gómez"),
        cell("Inglés", "María López"),
      ],
    },
    { time: "08:00 - 08:30", isBreak: true, cells: [null, null, null, null, null] },
    {
      time: "08:30 - 09:30",
      isBreak: false,
      cells: [
        cell("Sociales", "Pedro Díaz"),
        null,
        cell("Matemáticas", "Carlos Rodríguez"),
        null,
        null,
      ],
    },
  ],
};

const meta = {
  title: "Students/StudentScheduleTab",
  component: StudentScheduleTab,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    state: { status: "ready", courseName: "6-01", schedule: SCHEDULE },
    fullScreenLink: (
      <Button variant="outline" size="sm">
        Ver en pantalla completa
      </Button>
    ),
  },
} satisfies Meta<typeof StudentScheduleTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSchedule: Story = {};

export const NoScheduleYet: Story = {
  args: {
    state: {
      status: "ready",
      courseName: "6-02",
      schedule: {
        title: "Horario de 6-02",
        rows: SCHEDULE.rows.map((row) => ({ ...row, cells: [null, null, null, null, null] })),
      },
    },
  },
};

export const WithoutCourse: Story = { args: { state: { status: "no-course" } } };

export const Loading: Story = { args: { state: { status: "loading", courseName: "6-01" } } };

export const LoadFailed: Story = {
  args: { state: { status: "error", courseName: "6-01", onRetry: () => {} } },
};
