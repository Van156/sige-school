import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { emptyClassroomForm } from "../lib/classroom-form";
import ClassroomForm from "./classroom-form";

const CAMPUSES = [
  { id: "c1", name: "Sede Principal", isMain: true },
  { id: "c2", name: "Sede Norte", isMain: false },
];

const FILLED = { ...emptyClassroomForm, campusId: "c1", name: "Aula 101", code: "AULA-101" };

const meta = {
  title: "Scheduling/ClassroomForm",
  component: ClassroomForm,
  tags: ["autodocs"],
  decorators: [
    withRouter,
    (Story) => (
      <div className="w-[44rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    mode: "create",
    initialValues: emptyClassroomForm,
    campuses: CAMPUSES,
    onSubmit: async () => {},
  },
} satisfies Meta<typeof ClassroomForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};

export const Edit: Story = {
  args: {
    mode: "edit",
    initialValues: {
      campusId: "c2",
      name: "Laboratorio de Ciencias",
      code: "LAB-CIENCIAS",
      capacity: "25",
      floor: "2",
      classroomType: "laboratorio",
      building: "B",
      resources: '{\n  "computadoras": 30\n}',
    },
  },
};

/** Text that is not a JSON object blocks the submit with the spec message. */
export const InvalidJson: Story = {
  args: { initialValues: { ...FILLED, resources: "{proyector: true}" } },
};

export const DuplicateCode: Story = {
  args: {
    initialValues: FILLED,
    onSubmit: async () => {
      throw { code: "CONFLICT", message: "Ya existe un salón con este código en la sede." };
    },
  },
};

/** The API refuses a campus change while the classroom has scheduled classes. */
export const CampusLocked: Story = {
  args: {
    mode: "edit",
    initialValues: FILLED,
    onSubmit: async () => {
      throw {
        code: "CONFLICT",
        message: "No se puede cambiar la sede de un salón con clases programadas.",
      };
    },
  },
};

export const SaveFails: Story = {
  args: {
    initialValues: FILLED,
    onSubmit: async () => {
      throw new Error("offline");
    },
  },
};
