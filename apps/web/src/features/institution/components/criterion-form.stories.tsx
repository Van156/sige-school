import type { Meta, StoryObj } from "@storybook/react-vite";

import { emptyCriterionForm } from "../lib/criterion-form";
import { withRouter } from "@/shared/storybook/with-router";

import CriterionForm from "./criterion-form";

const meta = {
  title: "Institution/CriterionForm",
  component: CriterionForm,
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
    initialValues: emptyCriterionForm(1),
    onSubmit: async () => {},
  },
} satisfies Meta<typeof CriterionForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};

export const Edit: Story = {
  args: {
    mode: "edit",
    initialValues: {
      name: "Cognitivo",
      weight: "30",
      description: "Evaluaciones escritas y orales",
      orderNum: "3",
    },
  },
};

export const SaveFails: Story = {
  args: {
    initialValues: { name: "Cognitivo", weight: "30", description: "", orderNum: "3" },
    onSubmit: async () => {
      throw new Error("offline");
    },
  },
};
