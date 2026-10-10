import type { Meta, StoryObj } from "@storybook/react-vite";

import ScheduleGenerateForm from "./schedule-generate-form";

const meta = {
  title: "Scheduling/ScheduleGenerateForm",
  component: ScheduleGenerateForm,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  args: {
    campuses: [
      { id: "k1", name: "Sede Principal" },
      { id: "k2", name: "Sede Norte" },
    ],
    courses: [
      { id: "c1", name: "6-01", campusId: "k1" },
      { id: "c2", name: "7-01", campusId: "k2" },
    ],
    isBusy: false,
    onSubmit: () => undefined,
  },
} satisfies Meta<typeof ScheduleGenerateForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A run is checking or running: the button is disabled. */
export const Busy: Story = { args: { isBusy: true } };
