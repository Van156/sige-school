import type { Meta, StoryObj } from "@storybook/react-vite";

import PeriodCountWarning from "./period-count-warning";

const meta = {
  title: "Institution/PeriodCountWarning",
  component: PeriodCountWarning,
  tags: ["autodocs"],
  args: { message: "Este año tiene 2 de 4 periodos." },
} satisfies Meta<typeof PeriodCountWarning>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
