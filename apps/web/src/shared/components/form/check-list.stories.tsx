import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import CheckList from "./check-list";

const ITEMS = [
  { value: "c1", label: "6-01", hint: "Sede Principal · Mañana" },
  { value: "c2", label: "6-02", hint: "Sede Principal · Mañana" },
  { value: "c3", label: "7-01", hint: "Sede Norte · Tarde" },
];

const meta = {
  title: "Shared/Form/CheckList",
  component: CheckList,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  args: { legend: "Grados", required: true, items: ITEMS, value: [], onValueChange: () => {} },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value as string[]);
    return <CheckList {...args} value={value} onValueChange={setValue} />;
  },
} satisfies Meta<typeof CheckList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSelection: Story = { args: { value: ["c1", "c3"] } };

export const WithHint: Story = { args: { hint: "Seleccione uno o más grados." } };

export const WithError: Story = { args: { error: "Seleccione al menos un grado." } };

export const Empty: Story = {
  args: { items: [], empty: "No hay grados registrados en la institución." },
};
