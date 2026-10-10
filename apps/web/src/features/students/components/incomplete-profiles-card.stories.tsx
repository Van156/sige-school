import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { incompleteSearchSchema } from "../lib/student-list";
import type { IncompleteStudentRow } from "../types";
import IncompleteProfilesCard from "./incomplete-profiles-card";

const ROWS: IncompleteStudentRow[] = [
  {
    personId: "p1",
    name: "Samuel Torres Vega",
    documentType: "TI",
    documentNumber: "1029876543",
    username: "storres",
    email: null,
  },
  {
    personId: "p2",
    name: "Lucía Herrera Pinto",
    documentType: "RC",
    documentNumber: "1129876544",
    username: "lherrera",
    email: "lucia.herrera@correo.com",
  },
];

const meta = {
  title: "Students/IncompleteProfilesCard",
  component: IncompleteProfilesCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    pendingTotal: ROWS.length,
    search: incompleteSearchSchema.parse({}),
    onSearchChange: () => {},
    canEditUser: true,
    list: {
      rows: ROWS,
      total: ROWS.length,
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
      errorMessage: null,
      onRetry: () => {},
    },
  },
} satisfies Meta<typeof IncompleteProfilesCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An administrator: "Editar usuario" on each row; a placeholder email reads "-". */
export const Pending: Story = {};

/** A coordinator without `user:update`: no row actions. */
export const WithoutUserEdit: Story = { args: { canEditUser: false } };

export const Loading: Story = {
  args: { list: { ...meta.args.list, rows: undefined, total: undefined, isPending: true } },
};

/** A search with no match keeps the card and its search box. */
export const FilteredEmpty: Story = {
  args: {
    search: incompleteSearchSchema.parse({ name: "zzz" }),
    list: { ...meta.args.list, rows: [], total: 0 },
  },
};

export const LoadFailed: Story = {
  args: {
    list: {
      ...meta.args.list,
      rows: undefined,
      total: undefined,
      errorMessage: "No se pudieron cargar los perfiles incompletos.",
    },
  },
};
