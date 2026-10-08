import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import CampusForm from "./campus-form";

const meta = {
  title: "Institution/CampusForm",
  component: CampusForm,
  tags: ["autodocs"],
  decorators: [
    withRouter,
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    mode: "create",
    onSubmit: async () => {},
  },
} satisfies Meta<typeof CampusForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};

export const Edit: Story = {
  args: {
    mode: "edit",
    initialValues: {
      name: "Sede Norte",
      code: "SN",
      address: "Carrera 5 # 12-34",
      jornada: "manana",
      isMain: false,
      active: true,
    },
  },
};

/** The server refuses a second main campus; the message appears under the switch. */
export const MainCampusConflict: Story = {
  args: {
    onSubmit: async () => {
      throw {
        code: "CONFLICT",
        message: "Ya existe una sede principal en esta institución.",
      };
    },
    initialValues: {
      name: "Sede Sur",
      code: "",
      address: "",
      jornada: "completa",
      isMain: true,
      active: true,
    },
  },
};

export const SaveFails: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("offline");
    },
    initialValues: {
      name: "Sede Sur",
      code: "",
      address: "",
      jornada: "completa",
      isMain: false,
      active: true,
    },
  },
};
