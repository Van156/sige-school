import type { Meta, StoryObj } from "@storybook/react-vite";

import TemplateDownloadButton from "./template-download-button";

const meta = {
  title: "Imports/TemplateDownloadButton",
  component: TemplateDownloadButton,
  tags: ["autodocs"],
  args: { onDownload: () => {} },
  parameters: { layout: "centered" },
} satisfies Meta<typeof TemplateDownloadButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { size: "sm" } };

export const Downloading: Story = { args: { isDownloading: true } };
