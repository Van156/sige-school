import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import AssignmentCreateForm from "./assignment-create-form";

const meta = {
  title: "Scheduling/AssignmentCreateForm",
  component: AssignmentCreateForm,
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
    subjects: [
      { value: "s1", label: "Matemáticas" },
      { value: "s2", label: "Inglés" },
    ],
    teachers: [
      { value: "p1", label: "Marcela Ortiz" },
      { value: "p2", label: "Luis Pérez" },
    ],
    onSubmit: async () => {},
  },
} satisfies Meta<typeof AssignmentCreateForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Submitting empty shows the three "Debes seleccionar..." messages. */
export const Default: Story = {};

/** Interact: pick the three values and submit to see the busy-teacher conflict under "Profesor". */
export const TeacherBusy: Story = {
  args: {
    onSubmit: async () => {
      throw {
        code: "CONFLICT",
        message: "El profesor ya tiene clases en el mismo horario (6-01, Lunes 07:00).",
      };
    },
  },
};

export const NoTeachers: Story = { args: { teachers: [] } };

export const SaveFails: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("offline");
    },
  },
};
