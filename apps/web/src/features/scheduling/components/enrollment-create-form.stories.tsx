import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import EnrollmentCreateForm from "./enrollment-create-form";

const COURSE = {
  id: "c1",
  name: "6-01",
  maxStudents: 35,
  currentStudents: 8,
  offeringCount: 9,
};

const meta = {
  title: "Scheduling/EnrollmentCreateForm",
  component: EnrollmentCreateForm,
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
  args: {
    courses: [
      { value: "c1", label: "6-01" },
      { value: "c2", label: "7-01" },
    ],
    candidates: { status: "idle" },
    onCourseChange: () => {},
    onSubmit: async () => {},
  },
} satisfies Meta<typeof EnrollmentCreateForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Before a course is chosen: "Seleccione un grado primero"; submitting shows both messages. */
export const NoCourse: Story = {};

export const LoadingStudents: Story = { args: { candidates: { status: "loading" } } };

/** The candidates of 6-01 with their current course, and the callout "(9 en 6-01)". */
export const WithCandidates: Story = {
  args: {
    candidates: {
      status: "ready",
      course: COURSE,
      students: [
        { value: "s1", label: "Ana Zapata", hint: "Actualmente: 5-01" },
        { value: "s2", label: "Beto Arias", hint: "Actualmente: Sin grado" },
        { value: "s3", label: "Carla Díaz", hint: "Actualmente: 6-02" },
      ],
    },
  },
};

export const NoCandidates: Story = {
  args: { candidates: { status: "ready", course: COURSE, students: [] } },
};

export const CandidatesFailed: Story = {
  args: { candidates: { status: "error", onRetry: () => {} } },
};
