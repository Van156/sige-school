import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import InstitutionCreateForm from "./institution-create-form";

const meta = {
  title: "App/Institutions/InstitutionCreateForm",
  component: InstitutionCreateForm,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { onSubmit: async () => {} },
  decorators: [withRouter],
} satisfies Meta<typeof InstitutionCreateForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
