import type { Meta, StoryObj } from "@storybook/react-vite";

import { USERS_LOAD_ERROR, userSearchDefaults, type UserRow } from "@/features/users";
import { withRouter } from "@/shared/storybook/with-router";

import PlatformUsersTable from "./platform-users-table";

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
];

const meta = {
  title: "Institutions/PlatformUsersTable",
  component: PlatformUsersTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    search: userSearchDefaults,
    onSearchChange: () => {},
    onEdit: () => {},
    onChangePassword: () => {},
    onToggleActive: () => {},
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
} satisfies Meta<typeof PlatformUsersTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** "Editar" is not offered on the owner row; deactivated users show "Reactivar". */
export const Default: Story = {};

/** An "Editar" is starting the impersonation: every "Editar" waits. */
export const Editing: Story = { args: { isEditing: true } };

export const Loading: Story = {
  args: { list: { ...meta.args.list, rows: undefined, total: undefined, isPending: true } },
};

export const LoadFailed: Story = {
  args: {
    list: {
      ...meta.args.list,
      rows: undefined,
      total: undefined,
      errorMessage: USERS_LOAD_ERROR,
    },
  },
};
