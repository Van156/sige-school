import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import InstitutionCreatedNotice from "./institution-created-notice";

const meta = {
  title: "App/Institutions/InstitutionCreatedNotice",
  component: InstitutionCreatedNotice,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    created: {
      institution: { id: "org-1", name: "Colegio Sol", slug: "colegio-sol" },
      rector: { username: "mgomez3456" },
    },
  },
  decorators: [withRouter],
} satisfies Meta<typeof InstitutionCreatedNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The institution exists but the optional logo failed: the notice points to the edit form. */
export const LogoFailed: Story = {
  args: { logoWarning: "No se pudo subir el logo. Puedes subirlo desde Editar Institución." },
};
