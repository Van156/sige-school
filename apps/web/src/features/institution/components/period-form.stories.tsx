import type { Meta, StoryObj } from "@storybook/react-vite";

import { emptyPeriodForm } from "../lib/period-form";
import { withRouter } from "@/shared/storybook/with-router";

import PeriodForm from "./period-form";

const meta = {
  title: "Institution/PeriodForm",
  component: PeriodForm,
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
    initialValues: emptyPeriodForm("2026", true),
    onSubmit: async () => {},
  },
} satisfies Meta<typeof PeriodForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The first period of an institution starts with the "Periodo Activo" switch on. */
export const CreateFirst: Story = {};

export const CreateNext: Story = { args: { initialValues: emptyPeriodForm("2026", false) } };

export const Edit: Story = {
  args: {
    mode: "edit",
    initialValues: {
      academicYear: "2026",
      orderNum: "2",
      name: "Segundo Periodo",
      shortName: "P2",
      startDate: "2026-04-07",
      endDate: "2026-06-19",
      isActive: false,
    },
  },
};

/** The server reports an overlap; the message appears under both dates. */
export const Overlap: Story = {
  args: {
    initialValues: {
      ...emptyPeriodForm("2026", false),
      name: "Segundo Periodo",
      shortName: "P2",
      orderNum: "2",
      startDate: "2026-03-01",
      endDate: "2026-05-30",
    },
    onSubmit: async () => {
      throw {
        code: "CONFLICT",
        message: "Las fechas se superponen con el periodo Primer Periodo.",
      };
    },
  },
};

export const SaveFails: Story = {
  args: {
    initialValues: {
      ...emptyPeriodForm("2026", false),
      name: "Segundo Periodo",
      shortName: "P2",
      startDate: "2026-04-07",
      endDate: "2026-06-19",
    },
    onSubmit: async () => {
      throw new Error("offline");
    },
  },
};
