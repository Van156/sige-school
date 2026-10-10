import type { Meta, StoryObj } from "@storybook/react-vite";

import ImportErrorList from "./import-error-list";

const rowErrors = Array.from({ length: 12 }, (_, index) => ({
  row: index + 2,
  message: `Fila ${index + 2}: Falta el documento.`,
}));

const meta = {
  title: "Imports/ImportErrorList",
  component: ImportErrorList,
  tags: ["autodocs"],
  args: { errors: rowErrors.slice(0, 3), count: 3 },
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof ImportErrorList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Few: Story = {};

export const WithMoreErrors: Story = { args: { errors: rowErrors, count: 40 } };

export const JobLevelError: Story = {
  args: { errors: [{ row: 0, message: "Importación interrumpida" }], count: 1 },
};
