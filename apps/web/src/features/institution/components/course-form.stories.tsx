import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { emptyCourseForm } from "../lib/course-form";
import CourseForm, { type DirectorsProps } from "./course-form";

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

const TEACHERS = [
  { personId: "t1", name: "Ada Lovelace" },
  { personId: "t2", name: "Alan Turing" },
];

const DIRECTORS: DirectorsProps = {
  teachers: TEACHERS,
  status: "ready",
  onSearchChange: () => {},
};

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

/** The server reports the current director as deactivated: still shown, marked inactive, so saving keeps them. */
export const InactiveDirector: Story = {
  args: {
    mode: "edit",
    initialValues: {
      ...emptyCourseForm("2026"),
      campusId: "c1",
      name: "6-1",
      directorPersonId: "gone",
    },
    directors: {
      ...DIRECTORS,
      current: { directorPersonId: "gone", directorName: "Grace Hopper", directorActive: false },
    },
  },
};

/** An active current director beyond the result window stays selected and unmarked. */
export const DirectorOutsideResults: Story = {
  args: {
    mode: "edit",
    initialValues: {
      ...emptyCourseForm("2026"),
      campusId: "c1",
      name: "6-1",
      directorPersonId: "far",
    },
    directors: {
      ...DIRECTORS,
      current: { directorPersonId: "far", directorName: "Zoe Zeta", directorActive: true },
    },
  },
};

/** A search in flight: the field stays usable while the results refresh. */
export const SearchingDirectors: Story = {
  args: { directors: { ...DIRECTORS, status: "searching" } },
};

/** `user.options` failed: the director field is disabled with a notice, the rest still saves. */
export const OptionsUnavailable: Story = {
  args: {
    mode: "edit",
    initialValues: {
      ...emptyCourseForm("2026"),
      campusId: "c1",
      name: "6-1",
      directorPersonId: "t1",
    },
    directors: {
      teachers: [],
      status: "unavailable",
      onSearchChange: () => {},
      current: { directorPersonId: "t1", directorName: "Ada Lovelace", directorActive: true },
    },
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
