import { buttonVariants } from "@base-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Link } from "@tanstack/react-router";

import { withRouter } from "@/shared/storybook/with-router";

import GuardianAssignCard from "./guardian-assign-card";

const CANDIDATES = [
  { personId: "p1", name: "Patricia Gómez", username: "pgomez", document: "52123456" },
  { personId: "p2", name: "Carlos Arango", username: "carango", document: "79123456" },
  { personId: "p3", name: "Luz Dary Duque", username: "lduque", document: "43123456" },
];

const meta = {
  title: "Students/GuardianAssignCard",
  component: GuardianAssignCard,
  tags: ["autodocs"],
  decorators: [
    withRouter,
    (Story) => (
      <div className="w-[28rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    candidates: CANDIDATES,
    status: "ready",
    term: "",
    onSearchChange: () => {},
    onSubmit: async () => {},
  },
} satisfies Meta<typeof GuardianAssignCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Guardian accounts left to link: search, relationship and "Asignar Acudiente". */
export const Candidates: Story = {};

/** No guardian account left; the caller may create one in USR-02. */
export const NoGuardiansCanCreate: Story = {
  args: {
    candidates: [],
    createGuardian: (
      <Link
        to="/usuarios/nuevo"
        search={{ role: "parent" }}
        className={buttonVariants({ size: "sm" })}
      >
        Crear acudiente primero
      </Link>
    ),
  },
};

/** No guardian account left and the caller cannot create accounts (coordinator, G-STU-4). */
export const NoGuardiansAskAdmin: Story = { args: { candidates: [] } };

/** The server refused the link (STU-R6). */
export const LinkError: Story = {
  args: { error: "Este acudiente ya está vinculado a este estudiante." },
};

export const NotAGuardian: Story = {
  args: { error: "El usuario seleccionado no es un acudiente." },
};

export const Searching: Story = { args: { status: "searching", term: "pat" } };

export const CandidatesUnavailable: Story = { args: { candidates: [], status: "unavailable" } };

export const SearchFailed: Story = { args: { status: "search-failed", term: "pat" } };
