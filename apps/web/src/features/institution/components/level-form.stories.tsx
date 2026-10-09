import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import LevelForm from "./level-form";

const CAMPUSES = [
  { id: "c1", name: "Sede Principal", isMain: true },
  { id: "c2", name: "Sede Norte", isMain: false },
];

const meta = {
  title: "Institution/LevelForm",
  component: LevelForm,
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
    campuses: CAMPUSES,
    onSubmit: async () => {},
  },
} satisfies Meta<typeof LevelForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};

/** The campus is fixed once the level exists. */
export const Edit: Story = {
  args: {
    mode: "edit",
    initialValues: { campusId: "c2", name: "Sexto", orderNum: "6" },
  },
};

/** The server refuses a repeated name within the campus; the message appears under the field. */
export const NameConflict: Story = {
  args: {
    onSubmit: async () => {
      throw { code: "CONFLICT", message: "Ya existe un nivel con este nombre en la sede." };
    },
    initialValues: { campusId: "c1", name: "Primero", orderNum: "1" },
  },
};

export const SaveFails: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("offline");
    },
    initialValues: { campusId: "c1", name: "Primero", orderNum: "1" },
  },
};
