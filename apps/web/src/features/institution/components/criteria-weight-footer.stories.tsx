import type { Meta, StoryObj } from "@storybook/react-vite";

import CriteriaWeightFooter from "./criteria-weight-footer";

const meta = {
  title: "Institution/CriteriaWeightFooter",
  component: CriteriaWeightFooter,
  tags: ["autodocs"],
  args: { count: 4, totalWeight: 100 },
} satisfies Meta<typeof CriteriaWeightFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TotalsHundred: Story = {};

export const BelowHundred: Story = { args: { count: 3, totalWeight: 70 } };

export const AboveHundred: Story = { args: { count: 5, totalWeight: 110.5 } };
