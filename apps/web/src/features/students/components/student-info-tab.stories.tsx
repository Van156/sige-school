import type { Meta, StoryObj } from "@storybook/react-vite";

import StudentInfoTab from "./student-info-tab";

const meta = {
  title: "Students/StudentInfoTab",
  component: StudentInfoTab,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    student: {
      campusName: "Sede Principal",
      courseName: "6-01",
      birthDate: "2013-03-14",
      gender: "F",
      bloodType: "O+",
      address: "Calle 10 # 4-25",
      neighborhood: "El Centro",
      stratum: 2,
      eps: "Sanitas",
    },
  },
} satisfies Meta<typeof StudentInfoTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Complete: Story = {};

/** No course reads "Sin curso asignado"; every other empty value "N/A". */
export const Sparse: Story = {
  args: {
    student: {
      campusName: "Sede Rural El Carmen",
      courseName: null,
      birthDate: null,
      gender: null,
      bloodType: null,
      address: null,
      neighborhood: null,
      stratum: null,
      eps: null,
    },
  },
};
