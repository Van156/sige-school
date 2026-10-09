import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import ImportResult from "./import-result";

const errors = Array.from({ length: 12 }, (_, index) => ({
  row: index + 2,
  message: `Fila ${index + 2}: Rol inválido "director".`,
}));

const meta = {
  title: "Users/ImportResult",
  component: ImportResult,
  tags: ["autodocs"],
  args: { onReset: () => {}, job: { status: "done", imported: 98, skipped: 0, errors: [] } },
  decorators: [
    withRouter,
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof ImportResult>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllImported: Story = {};

export const WithErrors: Story = {
  args: { job: { status: "done", imported: 88, skipped: 12, errors } },
};

export const Interrupted: Story = {
  args: {
    job: {
      status: "failed",
      imported: 40,
      skipped: 0,
      errors: [{ row: 0, message: "Importación interrumpida" }],
    },
  },
};

/** A stopped job with skipped rows: the reason sits in the callout, row errors in the card. */
export const InterruptedWithRowErrors: Story = {
  args: {
    job: {
      status: "failed",
      imported: 40,
      skipped: 3,
      errors: [
        { row: 4, message: "Fila 4: El documento ya existe." },
        { row: 9, message: "Fila 9: Rol inválido." },
        { row: 0, message: "Importación interrumpida" },
      ],
    },
  },
};
