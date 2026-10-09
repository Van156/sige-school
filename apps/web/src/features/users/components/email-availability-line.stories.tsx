import type { Meta, StoryObj } from "@storybook/react-vite";

import EmailAvailabilityLine from "./email-availability-line";

const meta = {
  title: "Users/EmailAvailabilityLine",
  component: EmailAvailabilityLine,
  tags: ["autodocs"],
  args: { availability: { status: "checking" } },
} satisfies Meta<typeof EmailAvailabilityLine>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Checking: Story = {};

export const Available: Story = { args: { availability: { status: "available" } } };

export const Taken: Story = { args: { availability: { status: "taken" } } };

/** The rate limit (30 checks per minute) or a network failure. */
export const Unknown: Story = {
  args: {
    availability: {
      status: "unknown",
      message: "Demasiadas verificaciones. Intenta de nuevo en un momento.",
    },
  },
};

export const Idle: Story = { args: { availability: { status: "idle" } } };
