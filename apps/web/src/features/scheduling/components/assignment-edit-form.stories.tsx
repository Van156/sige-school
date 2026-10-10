import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import type { AssignmentRow } from "../types";
import AssignmentEditForm from "./assignment-edit-form";

const ASSIGNMENT: AssignmentRow = {
  id: "a1",
  offeringId: "o1",
  teacherPersonId: "p1",
  teacherName: "Marcela Ortiz",
  teacherUsername: "mortiz",
  subjectName: "Matemáticas",
  courseName: "6-01",
  academicYear: "2026",
  assignmentDate: "2026-02-02",
  status: "activo",
  notes: null,
};

const meta = {
  title: "Scheduling/AssignmentEditForm",
  component: AssignmentEditForm,
  tags: ["autodocs"],
  decorators: [
    withRouter,
    (Story) => (
      <div className="w-[36rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: { assignment: ASSIGNMENT, onSubmit: async () => {} },
} satisfies Meta<typeof AssignmentEditForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TemporaryWithNotes: Story = {
  args: {
    assignment: { ...ASSIGNMENT, status: "temporal", notes: "Reemplazo temporal por incapacidad" },
  },
};

export const SaveFails: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("offline");
    },
  },
};
