import type { Meta, StoryObj } from "@storybook/react-vite";

import { UsernamePreviewBox } from "@/features/users";
import { withRouter } from "@/shared/storybook/with-router";

import { emptyPlatformUserForm } from "../lib/platform-user";
import PlatformUserForm from "./platform-user-form";

const meta = {
  title: "Institutions/PlatformUserForm",
  component: PlatformUserForm,
  tags: ["autodocs"],
  decorators: [
    withRouter,
    (Story) => (
      <div className="w-[48rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    institutionId: "inst-1",
    initialValues: emptyPlatformUserForm(),
    onSubmit: async () => {},
    renderUsernamePreview: () => <UsernamePreviewBox state={{ status: "idle" }} />,
  },
} satisfies Meta<typeof PlatformUserForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** INS-05 with Profesor preselected and the preview waiting for the names and document. */
export const Default: Story = {};

export const WithPreview: Story = {
  args: {
    initialValues: {
      ...emptyPlatformUserForm(),
      firstName: "Juan Carlos",
      lastName: "Pérez García",
      documentNumber: "1101234501",
      email: "juan@colegio.edu.co",
    },
    renderUsernamePreview: () => (
      <UsernamePreviewBox
        state={{ status: "ready", username: "jperez4501", documentTaken: false }}
      />
    ),
  },
};

export const AdminRole: Story = {
  args: { initialValues: { ...emptyPlatformUserForm(), role: "admin" } },
};

/** The institution already has an owner: the refusal shows under the role. */
export const SecondOwnerRefused: Story = {
  args: {
    initialValues: {
      ...emptyPlatformUserForm(),
      firstName: "Ana",
      lastName: "Gómez",
      documentNumber: "1101234501",
      email: "ana@colegio.edu.co",
    },
    onSubmit: async () => {
      throw { code: "CONFLICT", message: "La institución ya tiene un propietario." };
    },
  },
};
