import type { Meta, StoryObj } from "@storybook/react-vite";

import { UserHowItWorksCard, UserRolesCard } from "./user-help-cards";

const meta = {
  title: "Users/UserHelpCards",
  component: UserHowItWorksCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UserHowItWorksCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HowItWorks: Story = {};

export const Roles: Story = { render: () => <UserRolesCard /> };
