import type { Meta, StoryObj } from "@storybook/react-vite";

import ImportProgressCard from "./import-progress-card";

const meta = {
  title: "Imports/ImportProgressCard",
  component: ImportProgressCard,
  tags: ["autodocs"],
  args: { processed: 50, total: 120 },
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof ImportProgressCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {};

export const Starting: Story = { args: { processed: 0, total: 0 } };
