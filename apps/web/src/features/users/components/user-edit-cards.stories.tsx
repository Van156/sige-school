import { buttonVariants } from "@base-template/ui/components/button";
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

/** A student's account: the academic profile link comes first (the page renders a router link). */
export const QuickActionsStudent: Story = {
  render: () => (
    <UserQuickActionsCard
      isActive
      academicProfileLink={
        <a href="#perfil" className={buttonVariants({ variant: "outline" })}>
          Ver Perfil Académico
        </a>
      }
      onResetPassword={() => {}}
      onToggleActive={() => {}}
    />
  ),
};

/** A student login whose academic profile is still pending (USR-02 path B). */
export const QuickActionsStudentWithoutProfile: Story = {
  render: () => (
    <UserQuickActionsCard
      isActive
      academicProfileLink={
        <a href="#completar" className={buttonVariants({ variant: "outline" })}>
          Completar Perfil Académico
        </a>
      }
      onResetPassword={() => {}}
    />
  ),
};
