import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import type { StudentProfileTab } from "../lib/student-profile";
import StudentGuardiansTab from "./student-guardians-tab";
import StudentInfoTab from "./student-info-tab";
import StudentProfileTabs from "./student-profile-tabs";
import StudentScheduleTab from "./student-schedule-tab";

const PANELS = {
  info: (
    <StudentInfoTab
      student={{
        campusName: "Sede Principal",
        courseName: "6-01",
        birthDate: "2013-03-14",
        gender: "F",
        bloodType: "O+",
        address: "Calle 10 # 4-25",
        neighborhood: "El Centro",
        stratum: 2,
        eps: "Sanitas",
      }}
    />
  ),
  horario: <StudentScheduleTab state={{ status: "no-course" }} />,
  acudientes: (
    <StudentGuardiansTab
      student={{
        guardianName: "Patricia Gómez",
        guardianPhone: "3109876543",
        guardianEmail: null,
        guardians: [],
      }}
    />
  ),
};

const meta = {
  title: "Students/StudentProfileTabs",
  component: StudentProfileTabs,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { tab: "info", onTabChange: () => {}, panels: PANELS },
  render: function Render(args) {
    const [tab, setTab] = useState<StudentProfileTab>(args.tab);
    return <StudentProfileTabs {...args} tab={tab} onTabChange={setTab} />;
  },
} satisfies Meta<typeof StudentProfileTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Information: Story = {};

export const Schedule: Story = { args: { tab: "horario" } };

export const Guardians: Story = { args: { tab: "acudientes" } };
