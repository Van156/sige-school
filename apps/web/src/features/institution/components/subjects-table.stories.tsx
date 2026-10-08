import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import type { SubjectRow } from "../types";
import SubjectsTable from "./subjects-table";

const SUBJECTS: SubjectRow[] = [
  { id: "s1", name: "Ciencias Naturales", code: "CN" },
  { id: "s2", name: "Matemáticas", code: "MAT" },
  { id: "s3", name: "Artes", code: null },
];

const meta = {
  title: "Institution/SubjectsTable",
  component: SubjectsTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    subjects: SUBJECTS,
    canManage: true,
    isPending: false,
    errorMessage: null,
    onRetry: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof SubjectsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Manager: Story = {};

/** Coordinators and teachers: no row actions (INS-R1). */
export const ReadOnly: Story = { args: { canManage: false } };

export const Loading: Story = { args: { subjects: [], isPending: true } };

export const LoadFailed: Story = {
  args: { subjects: [], errorMessage: "No se pudieron cargar las asignaturas." },
};
