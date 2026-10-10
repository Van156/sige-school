import type { Meta, StoryObj } from "@storybook/react-vite";

import ImportFileCard from "./import-file-card";
import TemplateDownloadButton from "./template-download-button";

const meta = {
  title: "Imports/ImportFileCard",
  component: ImportFileCard,
  tags: ["autodocs"],
  args: { title: "Archivo Excel", onSelect: () => {} },
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

/** USR-04 puts "Descargar Plantilla" inside the card. */
export const WithTemplateButton: Story = {
  args: { children: <TemplateDownloadButton onDownload={() => {}} /> },
};

/** STU-05 wording: its own label and size hint. */
export const StudentWording: Story = {
  args: {
    title: "Subir Archivo",
    label: "Archivo Excel (.xlsx) *",
    hint: "Tamaño máximo: 10MB",
  },
};
