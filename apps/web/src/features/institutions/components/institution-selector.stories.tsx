import type { Meta, StoryObj } from "@storybook/react-vite";

import type { InstitutionRow } from "../types";
import InstitutionSelector from "./institution-selector";

const INSTITUTIONS: InstitutionRow[] = [
  {
    id: "i1",
    name: "Institución Educativa San José",
    slug: "san-jose",
    logo: null,
    email: "contacto@sanjose.edu.co",
    nit: "900123456-7",
    municipality: "Medellín",
    department: "Antioquia",
    academicYear: "2026",
    createdAt: "2026-01-10T10:00:00Z",
    counts: { campuses: 3, students: 0, admins: 2 },
    rector: { userId: "u1", name: "Ada Lovelace", username: "alovelace" },
  },
  {
    id: "i2",
    name: "Colegio Nuevo Horizonte",
    slug: "nuevo-horizonte",
    logo: null,
    email: null,
    nit: null,
    municipality: null,
    department: null,
    academicYear: "2026",
    createdAt: "2026-02-01T10:00:00Z",
    counts: { campuses: 0, students: 0, admins: 1 },
    rector: null,
  },
];

const meta = {
  title: "Institutions/InstitutionSelector",
  component: InstitutionSelector,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    institutions: INSTITUTIONS,
    selectedId: null,
    onSelect: () => {},
    onSubmit: () => {},
  },
} satisfies Meta<typeof InstitutionSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing picked yet: the submit stays disabled. */
export const Empty: Story = {};

export const Selected: Story = { args: { selectedId: "i1" } };

export const Submitting: Story = { args: { selectedId: "i1", isSubmitting: true } };

/** More institutions match than the screen lists: a notice points to the search. */
export const Truncated: Story = {
  args: { notice: "Mostrando 2 de 130 instituciones. Usa la búsqueda para encontrar otras." },
};
