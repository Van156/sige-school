import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { emptyTimeBlockForm } from "../lib/time-block-form";
import TimeBlockForm from "./time-block-form";

const CAMPUSES = [
  { id: "c1", name: "Sede Principal", isMain: true },
  { id: "c2", name: "Sede Norte", isMain: false },
];

const FILLED = { ...emptyTimeBlockForm(3), campusId: "c1", name: "Bloque 3" };

const meta = {
  title: "Scheduling/TimeBlockForm",
  component: TimeBlockForm,
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
    initialValues: emptyTimeBlockForm(),
    campuses: CAMPUSES,
    existing: [
      { campusId: "c1", shift: "Mañana", orderNum: 1 },
      { campusId: "c1", shift: "Mañana", orderNum: 2 },
    ],
    onSubmit: async () => {},
  },
} satisfies Meta<typeof TimeBlockForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** "Orden" follows the chosen campus and jornada until the user types an order. */
export const Create: Story = {};

export const EditBreak: Story = {
  args: {
    mode: "edit",
    initialValues: {
      campusId: "c1",
      name: "Recreo",
      shift: "Mañana",
      startTime: "09:00",
      endTime: "09:30",
      orderNum: "3",
      isBreak: true,
    },
  },
};

export const EndBeforeStart: Story = {
  args: { initialValues: { ...FILLED, startTime: "09:00", endTime: "08:00" } },
};

export const DuplicateName: Story = {
  args: {
    initialValues: FILLED,
    onSubmit: async () => {
      throw {
        code: "CONFLICT",
        message: "Ya existe un bloque con este nombre en la sede y jornada.",
      };
    },
  },
};

export const Overlap: Story = {
  args: {
    initialValues: FILLED,
    onSubmit: async () => {
      throw { code: "CONFLICT", message: "El bloque se superpone con Bloque 2." };
    },
  },
};

/** A block with scheduled classes cannot change campus, jornada or times. */
export const InUse: Story = {
  args: {
    mode: "edit",
    initialValues: FILLED,
    onSubmit: async () => {
      throw {
        code: "CONFLICT",
        message: "No se pueden cambiar los horarios de un bloque con clases programadas.",
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
