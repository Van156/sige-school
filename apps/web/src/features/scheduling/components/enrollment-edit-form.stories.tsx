import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import type { EnrollmentRow } from "../types";
import EnrollmentEditForm from "./enrollment-edit-form";

const ENROLLMENT: EnrollmentRow = {
  id: "e1",
  studentId: "st1",
  studentName: "Ana Zapata",
  document: "1023456789",
  subjectName: "Matemáticas",
  courseId: "c1",
  courseName: "6-01",
  enrollmentDate: "2026-02-02",
  status: "activa",
  finalScore: null,
  statusNote: null,
  isStale: false,
};

const meta = {
  title: "Scheduling/EnrollmentEditForm",
  component: EnrollmentEditForm,
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
  args: { enrollment: ENROLLMENT, onSubmit: async () => {} },
} satisfies Meta<typeof EnrollmentEditForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An active enrollment without score or note; a score outside 1.0–5.0 shows the spec message. */
export const Active: Story = {};

/** A withdrawn enrollment with its final score and reason. */
export const Withdrawn: Story = {
  args: {
    enrollment: {
      ...ENROLLMENT,
      status: "retirada",
      finalScore: 3.8,
      statusNote: "Cambio de grado a 7-01",
      isStale: true,
    },
  },
};

/** The save fails: the form shows the fallback message. */
export const SaveFails: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("offline");
    },
  },
};
