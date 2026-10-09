import type { Meta, StoryObj } from "@storybook/react-vite";

import CriterionWeightHelp from "./criterion-weight-help";

const meta = {
  title: "Institution/CriterionWeightHelp",
  component: CriterionWeightHelp,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: { total: 70 },
} satisfies Meta<typeof CriterionWeightHelp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Complete: Story = { args: { total: 100 } };
