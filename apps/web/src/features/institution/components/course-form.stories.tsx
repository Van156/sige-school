import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { emptyCourseForm } from "../lib/course-form";
import CourseForm from "./course-form";

const CAMPUSES = [
  { id: "c1", name: "Sede Principal", isMain: true },
  { id: "c2", name: "Sede Norte", isMain: false },
];

const LEVELS = [
  {
    id: "l1",
    campusId: "c1",
    campusName: "Sede Principal",
    name: "Sexto",
    orderNum: 6,
    courseCount: 1,
  },
  {
    id: "l2",
    campusId: "c2",
    campusName: "Sede Norte",
    name: "Primero",
    orderNum: 1,
    courseCount: 0,
  },
];

const DIRECTORS = [
  { value: "t1", label: "Ada Lovelace" },
  { value: "t2", label: "Alan Turing" },
];

const meta = {
  title: "Institution/CourseForm",
  component: CourseForm,
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
    initialValues: emptyCourseForm("2026"),
    campuses: CAMPUSES,
    levels: LEVELS,
    directors: DIRECTORS,
    onSubmit: async () => {},
  },
} satisfies Meta<typeof CourseForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};

/** The level select offers only the chosen campus's levels. */
export const Edit: Story = {
  args: {
    mode: "edit",
    initialValues: {
      campusId: "c1",
      levelId: "l1",
      directorPersonId: "t1",
      name: "6-1",
      academicYear: "2026",
      shift: "Tarde",
      maxStudents: "35",
    },
  },
};

/** The current director was deactivated: still shown, marked inactive, so saving keeps them. */
export const InactiveDirector: Story = {
  args: {
    mode: "edit",
    initialValues: {
      ...emptyCourseForm("2026"),
      campusId: "c1",
      name: "6-1",
      directorPersonId: "gone",
    },
    directors: [{ value: "gone", label: "Grace Hopper (inactivo)" }, ...DIRECTORS],
  },
};

export const DirectorNotATeacher: Story = {
  args: {
    initialValues: {
      ...emptyCourseForm("2026"),
      campusId: "c1",
      name: "6-1",
      directorPersonId: "t1",
    },
    onSubmit: async () => {
      throw {
        code: "BAD_REQUEST",
        message: "El director debe ser un profesor activo de la institución.",
      };
    },
  },
};

export const LevelOfAnotherCampus: Story = {
  args: {
    initialValues: { ...emptyCourseForm("2026"), campusId: "c1", levelId: "l1", name: "6-1" },
    onSubmit: async () => {
      throw { code: "BAD_REQUEST", message: "El nivel no pertenece a la sede seleccionada." };
    },
  },
};

export const DuplicateCourse: Story = {
  args: {
    initialValues: { ...emptyCourseForm("2026"), campusId: "c1", name: "6-1" },
    onSubmit: async () => {
      throw {
        code: "CONFLICT",
        message: "Ya existe un grado con la misma sede, nombre, año y jornada.",
      };
    },
  },
};

export const SaveFails: Story = {
  args: {
    initialValues: { ...emptyCourseForm("2026"), campusId: "c1", name: "6-1" },
    onSubmit: async () => {
      throw new Error("offline");
    },
  },
};
