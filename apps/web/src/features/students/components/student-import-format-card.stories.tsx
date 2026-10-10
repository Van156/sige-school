import type { Meta, StoryObj } from "@storybook/react-vite";

import { TemplateDownloadButton } from "@/features/imports";

import StudentImportFormatCard from "./student-import-format-card";

const meta = {
  title: "Students/StudentImportFormatCard",
  component: StudentImportFormatCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[24rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof StudentImportFormatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { download: <TemplateDownloadButton size="sm" onDownload={() => {}} /> },
};

export const WithoutDownload: Story = {};
