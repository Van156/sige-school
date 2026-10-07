import {
  Sidebar,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@base-template/ui/components/sidebar";
import type { Meta, StoryObj } from "@storybook/react-vite";

import SidebarBrand from "./sidebar-brand";

const meta = {
  title: "App/Layout/SidebarBrand",
  component: SidebarBrand,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 240 } },
  },
  args: {
    name: "SIGE",
    subtitle: "Sistema de Gestión Escolar",
    logoSrc: "/logo.png",
  },
  render: (args, { parameters }) => (
    <SidebarProvider defaultOpen={parameters.sidebarOpen !== false}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarBrand {...args} />
        </SidebarHeader>
      </Sidebar>
      <SidebarInset />
    </SidebarProvider>
  ),
} satisfies Meta<typeof SidebarBrand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};

export const Collapsed: Story = { parameters: { sidebarOpen: false } };
