import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import GenerationResult from "./generation-result";

const meta = {
  title: "Scheduling/GenerationResult",
  component: GenerationResult,
  tags: ["autodocs"],
  decorators: [
    withRouter,
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: { canViewSchedule: true },
} satisfies Meta<typeof GenerationResult>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithoutConflicts: Story = {
  args: {
    outcome: {
      kind: "done",
      viewCourseId: "c1",
      result: { assigned: 120, conflicts: 0, courses: 6, skipped: [] },
    },
  },
};

export const WithConflictsAndSkipped: Story = {
  args: {
    outcome: {
      kind: "done",
      viewCourseId: "c1",
      result: {
        assigned: 96,
        conflicts: 4,
        courses: 5,
        skipped: [
          { courseId: "c9", courseName: "11-01", reason: "El grado es de jornada sabatina." },
        ],
      },
    },
  },
};

export const NothingAssigned: Story = {
  args: {
    outcome: {
      kind: "done",
      viewCourseId: undefined,
      result: { assigned: 0, conflicts: 0, courses: 1, skipped: [] },
    },
  },
};

/** A custom role with `schedule:generate` but not `schedule:read`: no "Ver Horario". */
export const WithoutScheduleAccess: Story = {
  args: { ...WithoutConflicts.args, canViewSchedule: false },
};

export const RequestFailed: Story = { args: { outcome: { kind: "failed" } } };
