import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import SubjectForm from "./subject-form";

const meta = {
  title: "Institution/SubjectForm",
  component: SubjectForm,
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
  args: {
    mode: "create",
    onSubmit: async () => {},
  },
} satisfies Meta<typeof SubjectForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};

export const Edit: Story = {
  args: { mode: "edit", initialValues: { name: "Matemáticas", code: "MAT" } },
};

/** The server refuses a repeated code; the message appears under "Código". */
export const CodeConflict: Story = {
  args: {
    onSubmit: async () => {
      throw { code: "CONFLICT", message: "Ya existe una asignatura con este código." };
    },
    initialValues: { name: "Matemáticas", code: "MAT" },
  },
};

export const SaveFails: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("offline");
    },
    initialValues: { name: "Matemáticas", code: "" },
  },
};
