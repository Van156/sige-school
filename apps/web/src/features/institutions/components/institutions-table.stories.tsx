import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { institutionSearchDefaults } from "../lib/institution-list";
import type { InstitutionRow } from "../types";
import InstitutionsTable from "./institutions-table";

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
  title: "Institutions/InstitutionsTable",
  component: InstitutionsTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    search: institutionSearchDefaults,
    onSearchChange: () => {},
    onView: () => {},
    onDelete: () => {},
    list: {
      rows: INSTITUTIONS,
      total: INSTITUTIONS.length,
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
      errorMessage: null,
      onRetry: () => {},
    },
  },
} satisfies Meta<typeof InstitutionsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: { list: { ...meta.args.list, rows: undefined, total: undefined, isPending: true } },
};

export const LoadFailed: Story = {
  args: {
    list: {
      ...meta.args.list,
      rows: undefined,
      total: undefined,
      errorMessage: "No se pudieron cargar las instituciones.",
    },
  },
};
