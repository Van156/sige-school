import type { Meta, StoryObj } from "@storybook/react-vite";

import GenerationProgress from "./generation-progress";

const meta = {
  title: "Scheduling/GenerationProgress",
  component: GenerationProgress,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof GenerationProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
