import type { Meta, StoryObj } from "@storybook/react-vite";

import LogoField from "./logo-field";

const SAMPLE_LOGO =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56'><rect width='56' height='56' rx='8' fill='%231d4ed8'/></svg>";

const meta = {
  title: "Institution/LogoField",
  component: LogoField,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[28rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    logo: null,
    onUpload: async () => {},
    onRemove: async () => {},
  },
} satisfies Meta<typeof LogoField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoLogo: Story = {};

export const WithLogo: Story = { args: { logo: SAMPLE_LOGO } };

export const ReadOnly: Story = { args: { logo: SAMPLE_LOGO, disabled: true } };

export const Uploading: Story = { args: { logo: SAMPLE_LOGO, isBusy: true } };
