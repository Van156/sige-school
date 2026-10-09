import type { Meta, StoryObj } from "@storybook/react-vite";

import { UserInfoCard, UserQuickActionsCard } from "./user-edit-cards";

const user = {
  username: "agomez1234",
  email: "ana@colegio.edu.co",
  documentType: "CC",
  documentNumber: "1101234501",
  isActive: true,
  lastLoginAt: "2026-02-03T14:30:00.000Z",
  mustChangePassword: false,
} as const;

const meta = {
  title: "Users/UserEditCards",
  component: UserInfoCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: { user },
} satisfies Meta<typeof UserInfoCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {};

/** A user that never signed in and still has to change the initial password. */
export const InfoNeverSignedIn: Story = {
  args: { user: { ...user, email: null, lastLoginAt: null, mustChangePassword: true } },
};

export const InfoInactive: Story = { args: { user: { ...user, isActive: false } } };

export const QuickActions: Story = {
  render: () => (
    <UserQuickActionsCard isActive onResetPassword={() => {}} onToggleActive={() => {}} />
  ),
};

export const QuickActionsEnable: Story = {
  render: () => (
    <UserQuickActionsCard isActive={false} onResetPassword={() => {}} onToggleActive={() => {}} />
  ),
};
