import type { Meta, StoryObj } from "@storybook/react-vite";

import ImportPreviewCard from "./import-preview-card";

const rows = [
  { row: 2, nombres: "María", apellidos: "Londoño", documento: "1101234501", rol: "profesor" },
  { row: 3, nombres: "Camilo", apellidos: "Pardo", documento: "1101234502", rol: "estudiante" },
  { row: 4, nombres: "Lucía", apellidos: "Torres", documento: "", rol: "coordinador" },
];

const meta = {
  title: "Users/ImportPreviewCard",
  component: ImportPreviewCard,
  tags: ["autodocs"],
  args: {
    fileName: "usuarios.xlsx",
    onImport: () => {},
    preview: {
      total: 3,
      valid: 2,
      invalid: 1,
      rows: [
        { ...rows[0]!, valid: true, message: null },
        { ...rows[1]!, valid: true, message: null },
        { ...rows[2]!, valid: false, message: "Fila 4: Falta el documento." },
      ],
      errors: [{ row: 4, message: "Fila 4: Falta el documento." }],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[48rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof ImportPreviewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoValidRows: Story = {
  args: {
    preview: {
      total: 1,
      valid: 0,
      invalid: 1,
      rows: [{ ...rows[2]!, valid: false, message: "Fila 4: Falta el documento." }],
      errors: [{ row: 4, message: "Fila 4: Falta el documento." }],
    },
  },
};

export const ImportAlreadyRunning: Story = {
  args: { startError: "Ya hay una importación en curso." },
};
