import type { Meta, StoryObj } from "@storybook/react-vite";

import UsernamePreviewBox from "./username-preview-box";

const meta = {
  title: "Users/UsernamePreviewBox",
  component: UsernamePreviewBox,
  tags: ["autodocs"],
  args: { state: { status: "idle" } },
} satisfies Meta<typeof UsernamePreviewBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Loading: Story = { args: { state: { status: "loading" } } };

export const Ready: Story = {
  args: { state: { status: "ready", username: "jperez4501", documentTaken: false } },
};

/** The document already belongs to a user of the institution. */
export const DocumentTaken: Story = {
  args: { state: { status: "ready", username: "jperez4501", documentTaken: true } },
};

export const Unavailable: Story = {
  args: { state: { status: "unavailable", documentTaken: false } },
};

export const Failed: Story = { args: { state: { status: "error" } } };
