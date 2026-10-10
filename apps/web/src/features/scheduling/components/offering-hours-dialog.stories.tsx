import type { Meta, StoryObj } from "@storybook/react-vite";

import OfferingHoursDialog from "./offering-hours-dialog";

const OFFERING = { id: "o1", subjectName: "Matemáticas", courseName: "6-01", hoursPerWeek: 4 };

const meta = {
  title: "Scheduling/OfferingHoursDialog",
  component: OfferingHoursDialog,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { offering: OFFERING, onClose: () => {}, onSubmit: async () => {} },
} satisfies Meta<typeof OfferingHoursDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Hours outside 1-20 block the submit with the spec message. */
export const InvalidHours: Story = {
  args: { offering: { ...OFFERING, hoursPerWeek: 25 } },
};

export const SaveFails: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("offline");
    },
  },
};
