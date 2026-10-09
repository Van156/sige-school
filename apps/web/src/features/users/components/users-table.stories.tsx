import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { userSearchDefaults } from "../lib/user-list";
import type { UserRow } from "../types";
import UsersTable from "./users-table";

const user = (overrides: Partial<UserRow> & Pick<UserRow, "personId" | "username">): UserRow => ({
  userId: `u-${overrides.personId}`,
  email: null,
  firstName: "Ana",
  lastName: "Gómez",
  name: "Ana Gómez",
  role: "teacher",
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: "2026-01-10T00:00:00.000Z",
  isSelf: false,
  ...overrides,
});

const USERS: UserRow[] = [
  user({
    personId: "p1",
    username: "rector",
    email: "rector@colegio.edu.co",
    firstName: "Luis",
    lastName: "Mora",
    name: "Luis Mora",
    role: "owner",
    isSelf: true,
  }),
  user({ personId: "p2", username: "agomez", email: "ana@colegio.edu.co" }),
  user({
    personId: "p3",
    username: "cperez",
    firstName: "Carlos",
    lastName: "Pérez",
    name: "Carlos Pérez",
    role: "student",
    isActive: false,
  }),
  user({
    personId: "p4",
    username: "mruiz",
    firstName: "Marta",
    lastName: "Ruiz",
    name: "Marta Ruiz",
    role: "coordinator",
  }),
];

const meta = {
  title: "Users/UsersTable",
  component: UsersTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    search: userSearchDefaults,
    onSearchChange: () => {},
    permissions: { canUpdate: true, canDelete: true },
    onToggleActive: () => {},
    onDelete: () => {},
    list: {
      rows: USERS,
      total: USERS.length,
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
      errorMessage: null,
      onRetry: () => {},
    },
  },
} satisfies Meta<typeof UsersTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner and own rows carry no actions (USR-R4). */
export const Manager: Story = {};

export const ReadOnly: Story = { args: { permissions: { canUpdate: false, canDelete: false } } };

export const Loading: Story = {
  args: { list: { ...meta.args.list, rows: undefined, total: undefined, isPending: true } },
};

export const Empty: Story = {
  args: { list: { ...meta.args.list, rows: [], total: 0 } },
};

export const LoadFailed: Story = {
  args: {
    list: {
      ...meta.args.list,
      rows: undefined,
      total: undefined,
      errorMessage: "No se pudieron cargar los usuarios.",
    },
  },
};
