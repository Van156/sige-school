import type { Meta, StoryObj } from "@storybook/react-vite";

import StudentGuardiansTab from "./student-guardians-tab";

const meta = {
  title: "Students/StudentGuardiansTab",
  component: StudentGuardiansTab,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    student: {
      guardianName: "Patricia Gómez",
      guardianPhone: "3109876543",
      guardianEmail: "patricia.gomez@correo.com",
      guardians: [
        {
          guardianPersonId: "parent-1",
          name: "Patricia Gómez",
          username: "pgomez1234",
          relationship: "Madre",
          email: "patricia.gomez@correo.com",
          phone: "3109876543",
        },
        {
          guardianPersonId: "parent-2",
          name: "Andrés Herrera",
          username: "aherrera5678",
          relationship: "Padre",
          email: null,
          phone: null,
        },
      ],
    },
  },
} satisfies Meta<typeof StudentGuardiansTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLinkedGuardians: Story = {};

/** No contact on the profile and no linked accounts. */
export const NoGuardians: Story = {
  args: {
    student: { guardianName: null, guardianPhone: null, guardianEmail: null, guardians: [] },
  },
};
