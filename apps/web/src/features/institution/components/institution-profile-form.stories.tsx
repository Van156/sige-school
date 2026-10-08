import type { Meta, StoryObj } from "@storybook/react-vite";

import InstitutionProfileForm from "./institution-profile-form";

const meta = {
  title: "Institution/InstitutionProfileForm",
  component: InstitutionProfileForm,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[44rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    initialValues: {
      name: "Institución Educativa San José",
      nit: "900123456-7",
      phone: "6012345678",
      email: "contacto@sanjose.edu.co",
      address: "Calle 10 # 20-30",
      municipality: "Medellín",
      department: "Antioquia",
      academicYear: "2026",
      resolution: "",
    },
    onSubmit: async () => {},
  },
} satisfies Meta<typeof InstitutionProfileForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {};

/** `institution:read` without `update`: disabled fields, no save button. */
export const ReadOnly: Story = { args: { readOnly: true } };

export const NitTaken: Story = {
  args: {
    onSubmit: async () => {
      throw { code: "CONFLICT", message: "Ya existe una institución con este NIT." };
    },
  },
};

export const SaveFails: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("offline");
    },
  },
};
