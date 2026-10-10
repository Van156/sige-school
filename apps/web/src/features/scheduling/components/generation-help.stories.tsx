import type { Meta, StoryObj } from "@storybook/react-vite";

import GenerationHelp from "./generation-help";

const meta = {
  title: "Scheduling/GenerationHelp",
  component: GenerationHelp,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GenerationHelp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
