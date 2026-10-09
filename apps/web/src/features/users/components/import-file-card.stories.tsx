import type { Meta, StoryObj } from "@storybook/react-vite";

import ImportFileCard from "./import-file-card";

const meta = {
  title: "Users/ImportFileCard",
  component: ImportFileCard,
  tags: ["autodocs"],
  args: { onSelect: () => {}, onDownloadTemplate: () => {} },
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof ImportFileCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WrongExtension: Story = {
  args: { error: "Solo se permiten archivos Excel (.xlsx)." },
};

export const Busy: Story = { args: { isBusy: true } };

export const DownloadingTemplate: Story = { args: { isDownloading: true } };
