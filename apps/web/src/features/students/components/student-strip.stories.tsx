import { Button } from "@base-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowLeft } from "lucide-react";

import StudentStrip from "./student-strip";

const meta = {
  title: "Students/StudentStrip",
  component: StudentStrip,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    student: {
      name: "Isabella Gómez Herrera",
      documentType: "TI",
      documentNumber: "1023456789",
      courseName: "6-01",
      campusName: "Sede Principal",
      status: "activo",
    },
  },
} satisfies Meta<typeof StudentStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {};

/** A student without a course reads "Sin curso". */
export const WithoutCourse: Story = {
  args: { student: { ...meta.args.student, courseName: null } },
};

export const Graduated: Story = {
  args: { student: { ...meta.args.student, courseName: "11-01", status: "graduado" } },
};

export const WithBackAndActions: Story = {
  args: {
    back: (
      <Button variant="outline" size="sm">
        <ArrowLeft data-icon="inline-start" />
        Volver
      </Button>
    ),
    actions: (
      <Button variant="outline" size="sm">
        Ver perfil
      </Button>
    ),
  },
};
