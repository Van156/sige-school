import type { Meta, StoryObj } from "@storybook/react-vite";

import TypicalBlocksHelp from "./typical-blocks-help";

const meta = {
  title: "Scheduling/TypicalBlocksHelp",
  component: TypicalBlocksHelp,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TypicalBlocksHelp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
