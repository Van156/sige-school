import type { Meta, StoryObj } from "@storybook/react-vite";

import ImportFormatCard from "./import-format-card";

const meta = {
  title: "Users/ImportFormatCard",
  component: ImportFormatCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[48rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof ImportFormatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
