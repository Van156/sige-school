import type { Meta, StoryObj } from "@storybook/react-vite";

import { UsernamePreviewBox } from "@/features/users";
import { withRouter } from "@/shared/storybook/with-router";

import { emptyInstitutionForm, institutionToFormValues } from "../lib/institution-form";
import InstitutionForm from "./institution-form";

const meta = {
  title: "Institutions/InstitutionForm",
  component: InstitutionForm,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    mode: "create",
    initialValues: emptyInstitutionForm(new Date("2026-06-01")),
    onSubmit: async () => {},
  },
} satisfies Meta<typeof InstitutionForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Institution profile plus the mandatory rector block. */
export const Create: Story = {};

/** The rector's live "Username auto-generado" box fed by `platformUser.previewUsername`. */
export const CreateWithUsernamePreview: Story = {
  args: {
    renderRectorUsernamePreview: () => (
      <UsernamePreviewBox
        state={{ status: "ready", username: "jperez4501", documentTaken: false }}
      />
    ),
  },
};

export const CreateConflict: Story = {
  args: {
    onSubmit: async () => {
      throw { code: "CONFLICT", message: "Ya existe una institución con este NIT." };
    },
  },
};

/** Profile only: the rector is created once and managed from the institution itself. */
export const Edit: Story = {
  args: {
    mode: "edit",
    initialValues: institutionToFormValues({
      id: "i1",
      name: "Institución Educativa San José",
      slug: "san-jose",
      logo: null,
      email: "contacto@sanjose.edu.co",
      nit: "900123456-7",
      phone: "6012345678",
      address: "Calle 10 # 20-30",
      resolution: null,
      municipality: "Medellín",
      department: "Antioquia",
      academicYear: "2026",
      createdAt: "2026-01-10T10:00:00Z",
      counts: { campuses: 3, students: 0, admins: 2 },
      rector: null,
    }),
  },
};

export const SaveFails: Story = {
  args: {
    ...Edit.args,
    onSubmit: async () => {
      throw new Error("offline");
    },
  },
};
