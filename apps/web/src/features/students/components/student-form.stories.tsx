import type { Meta, StoryObj } from "@storybook/react-vite";

import { UsernamePreviewBox } from "@/features/users";
import { withRouter } from "@/shared/storybook/with-router";

import { emptyStudentForm, type StudentFormValues } from "../lib/student-form";
import ExistingUserBanner from "./existing-user-banner";
import StudentForm from "./student-form";

const CAMPUSES = [
  { id: "campus-1", name: "Sede Principal", isMain: true },
  { id: "campus-2", name: "Sede Rural El Carmen", isMain: false },
];

const COURSES = [
  { id: "course-1", name: "6-01", campusId: "campus-1" },
  { id: "course-2", name: "6-02", campusId: "campus-1" },
  { id: "course-3", name: "3-01", campusId: "campus-2" },
];

const FILLED: StudentFormValues = {
  ...emptyStudentForm(),
  firstName: "Isabella",
  lastName: "Gómez Herrera",
  documentNumber: "1023456789",
  phone: "3001234567",
  birthDate: "2013-03-14",
  gender: "F",
  address: "Calle 10 # 4-25",
  campusId: "campus-1",
  courseId: "course-1",
  neighborhood: "El Centro",
  stratum: "2",
  bloodType: "O+",
  eps: "Sanitas",
  guardianName: "Patricia Gómez",
  guardianPhone: "3109876543",
  guardianEmail: "patricia.gomez@correo.com",
};

const meta = {
  title: "Students/StudentForm",
  component: StudentForm,
  tags: ["autodocs"],
  decorators: [
    withRouter,
    (Story) => (
      <div className="w-[48rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    mode: "create",
    initialValues: emptyStudentForm(),
    campuses: CAMPUSES,
    courses: COURSES,
    cancelTo: "/estudiantes",
    onSubmit: async () => {},
    renderUsernamePreview: () => <UsernamePreviewBox state={{ status: "idle" }} />,
  },
} satisfies Meta<typeof StudentForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `/estudiantes/nuevo`: blank, "Grado" disabled until a campus is chosen. */
export const Create: Story = {};

export const CreateFilled: Story = {
  args: {
    initialValues: FILLED,
    renderUsernamePreview: () => (
      <UsernamePreviewBox
        state={{ status: "ready", username: "igomez6789", documentTaken: false }}
      />
    ),
  },
};

/** Press "Completar Matrícula": the client rules mark the names, document and campus. */
export const CreateValidationErrors: Story = {};

/** Submitting maps the server's duplicate-document conflict onto the document field. */
export const CreateDuplicateDocument: Story = {
  args: {
    initialValues: FILLED,
    onSubmit: async () => {
      throw { code: "CONFLICT", message: "Ya existe un usuario con este documento." };
    },
  },
};

/** `/estudiantes/completar/$personId`: only academic and guardian data, below the login banner. */
export const Complete: Story = {
  args: {
    mode: "complete",
    cancelTo: "/usuarios",
    renderUsernamePreview: undefined,
    header: (
      <ExistingUserBanner
        user={{
          personId: "person-1",
          name: "Mateo Ruiz Castaño",
          documentType: "TI",
          documentNumber: "1098765432",
          username: "mruiz5432",
          email: null,
        }}
      />
    ),
  },
};

/** A course of another campus is refused by the server and lands under "Grado". */
export const CompleteCourseMismatch: Story = {
  args: {
    ...Complete.args,
    initialValues: { ...emptyStudentForm(), campusId: "campus-1", courseId: "course-1" },
    onSubmit: async () => {
      throw { code: "BAD_REQUEST", message: "El grado no pertenece a la sede seleccionada." };
    },
  },
};

/** `/estudiantes/$studentId/editar`: document locked, "Estado" offers only allowed transitions. */
export const Edit: Story = {
  args: {
    mode: "edit",
    initialValues: FILLED,
    renderUsernamePreview: undefined,
  },
};

/** A retired student may only be reactivated (D9); pick another "Grado" to see the STU-R4 help. */
export const EditRetired: Story = {
  args: {
    ...Edit.args,
    initialValues: { ...FILLED, status: "retirado" },
  },
};

/** A course no longer listed (previous academic year) stays selectable for the stored student. */
export const EditPreviousYearCourse: Story = {
  args: {
    ...Edit.args,
    initialValues: { ...FILLED, courseId: "course-2025" },
    currentCourse: { id: "course-2025", name: "5-01 (2025)", campusId: "campus-1" },
  },
};
