import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { emptyUserForm, type UserFormValues } from "../lib/user-form";
import EmailAvailabilityLine from "./email-availability-line";
import UserForm from "./user-form";
import UsernamePreviewBox from "./username-preview-box";
import UserSummaryStrip from "./user-summary-strip";

const FILLED: UserFormValues = {
  ...emptyUserForm("teacher"),
  firstName: "Juan Carlos",
  lastName: "Pérez García",
  documentNumber: "1101234501",
};

const meta = {
  title: "Users/UserForm",
  component: UserForm,
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
    initialValues: emptyUserForm(),
    onSubmit: async () => {},
    renderUsernamePreview: () => <UsernamePreviewBox state={{ status: "idle" }} />,
  },
} satisfies Meta<typeof UserForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};

/** `/usuarios/nuevo?role=teacher` preselects the role. */
export const CreatePreselectedRole: Story = {
  args: {
    initialValues: FILLED,
    renderUsernamePreview: () => (
      <UsernamePreviewBox
        state={{ status: "ready", username: "jperez4501", documentTaken: false }}
      />
    ),
    renderEmailStatus: () => <EmailAvailabilityLine availability={{ status: "available" }} />,
  },
};

export const EmailTaken: Story = {
  args: {
    initialValues: { ...FILLED, email: "ana@colegio.edu.co" },
    renderEmailStatus: () => <EmailAvailabilityLine availability={{ status: "taken" }} />,
  },
};

/** The role is read-only and the optional new password appears. */
export const Edit: Story = {
  args: {
    mode: "edit",
    initialValues: { ...FILLED, email: "ana@colegio.edu.co", gender: "F", birthDate: "1990-05-17" },
    header: (
      <UserSummaryStrip
        user={{
          username: "jperez4501",
          email: "ana@colegio.edu.co",
          role: "teacher",
          createdAt: "2026-01-10T15:00:00.000Z",
        }}
      />
    ),
    renderUsernamePreview: undefined,
  },
};

export const DuplicateDocument: Story = {
  args: {
    initialValues: FILLED,
    onSubmit: async () => {
      throw { code: "CONFLICT", message: "Ya existe un usuario con este documento." };
    },
  },
};

export const DuplicateEmail: Story = {
  args: {
    initialValues: { ...FILLED, email: "ana@colegio.edu.co" },
    onSubmit: async () => {
      throw { code: "CONFLICT", message: "Ya existe un usuario con este correo." };
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
