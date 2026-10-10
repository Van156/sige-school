import type { Meta, StoryObj } from "@storybook/react-vite";

import AssignedGuardiansCard from "./assigned-guardians-card";

const meta = {
  title: "Students/AssignedGuardiansCard",
  component: AssignedGuardiansCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[28rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    onUnlink: () => {},
    guardians: [
      {
        guardianPersonId: "p1",
        name: "Patricia Gómez",
        username: "pgomez",
        relationship: "Madre",
        email: "patricia.gomez@correo.com",
        phone: "3109876543",
      },
      {
        guardianPersonId: "p2",
        name: "Carlos Arango",
        username: "carango",
        relationship: "Tío/a",
        email: null,
        phone: null,
      },
    ],
  },
} satisfies Meta<typeof AssignedGuardiansCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithGuardians: Story = {};

export const Empty: Story = { args: { guardians: [] } };
