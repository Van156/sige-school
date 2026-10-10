import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { emptyBulkOfferingForm } from "../lib/offering-form";
import OfferingBulkForm from "./offering-bulk-form";

const COURSES = [
  { value: "c1", label: "6-01", hint: "Sede Principal · Mañana" },
  { value: "c2", label: "7-01", hint: "Sede Norte · Tarde" },
];
const SUBJECTS = [
  { value: "s1", label: "Matemáticas", hint: "MAT" },
  { value: "s2", label: "Inglés", hint: "ING" },
];
const TEACHERS = [
  { value: "p1", label: "Marcela Ortiz" },
  { value: "p2", label: "Luis Pérez" },
];

const FILLED = { ...emptyBulkOfferingForm, courseIds: ["c1"], subjectIds: ["s1", "s2"] };

const meta = {
  title: "Scheduling/OfferingBulkForm",
  component: OfferingBulkForm,
  tags: ["autodocs"],
  decorators: [
    withRouter,
    (Story) => (
      <div className="w-[44rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    initialValues: emptyBulkOfferingForm,
    courses: COURSES,
    subjects: SUBJECTS,
    teachers: TEACHERS,
    onSubmit: async () => {},
  },
} satisfies Meta<typeof OfferingBulkForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = { args: { initialValues: { ...FILLED, teacherPersonId: "p1" } } };

/** Submitting without a selection shows the spec messages under each checklist. */
export const NothingSelected: Story = {
  args: {
    onSubmit: async () => {
      throw { code: "BAD_REQUEST", message: "Seleccione al menos un grado." };
    },
  },
};

export const InvalidHours: Story = {
  args: { initialValues: { ...FILLED, hoursPerWeek: "25" } },
};

export const NoCoursesOrSubjects: Story = { args: { courses: [], subjects: [] } };

export const SaveFails: Story = {
  args: {
    initialValues: FILLED,
    onSubmit: async () => {
      throw new Error("offline");
    },
  },
};
