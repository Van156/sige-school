import type { Meta, StoryObj } from "@storybook/react-vite";

import GuardianCandidateCombobox from "./guardian-candidate-combobox";

const control = {
  id: "guardianPersonId",
  name: "guardianPersonId",
  value: "",
  onBlur: () => {},
  onChange: () => {},
  "aria-invalid": undefined,
  "aria-describedby": undefined,
};

const meta = {
  title: "Students/GuardianCandidateCombobox",
  component: GuardianCandidateCombobox,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[24rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    control,
    status: "ready",
    onSearchChange: () => {},
    candidates: [
      { personId: "p1", name: "Patricia Gómez", username: "pgomez", document: "52123456" },
      { personId: "p2", name: "Carlos Arango", username: "carango", document: "79123456" },
    ],
  },
} satisfies Meta<typeof GuardianCandidateCombobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = { args: { control: { ...control, value: "p1" } } };

export const NoResults: Story = { args: { candidates: [] } };

export const Unavailable: Story = { args: { candidates: [], status: "unavailable" } };
