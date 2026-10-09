import type { Meta, StoryObj } from "@storybook/react-vite";

import InstitutionDetailView from "./institution-detail-view";

const meta = {
  title: "Institutions/InstitutionDetailView",
  component: InstitutionDetailView,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[32rem]">
        <Story />
      </div>
    ),
  ],
  args: {
    institution: {
      id: "i1",
      name: "Institución Educativa San José",
      slug: "san-jose",
      logo: null,
      email: "contacto@sanjose.edu.co",
      nit: "900123456-7",
      phone: "6012345678",
      address: "Calle 10 # 20-30",
      resolution: "Resolución No. 1234 del 01/01/2025",
      municipality: "Medellín",
      department: "Antioquia",
      academicYear: "2026",
      createdAt: "2026-01-10T10:00:00Z",
      counts: { campuses: 3, students: 0, admins: 2 },
      rector: { userId: "u1", name: "Ada Lovelace", username: "alovelace" },
    },
  },
} satisfies Meta<typeof InstitutionDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Complete: Story = {};

/** Optional fields left blank read "-" and the location "No especificada". */
export const Sparse: Story = {
  args: {
    institution: {
      ...meta.args.institution,
      nit: null,
      phone: null,
      email: null,
      address: null,
      resolution: null,
      municipality: null,
      department: null,
    },
  },
};
