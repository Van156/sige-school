import type { Meta, StoryObj } from "@storybook/react-vite";

import ImpersonationBannerView from "./impersonation-banner-view";

const meta = {
  title: "Admin/ImpersonationBannerView",
  component: ImpersonationBannerView,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    message: "Vista Root: estás gestionando Institución Educativa San José.",
    isStopping: false,
    onStop: () => {},
  },
} satisfies Meta<typeof ImpersonationBannerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ManagingInstitution: Story = {};

export const Stopping: Story = { args: { isStopping: true } };
