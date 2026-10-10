import { Tabs, TabsContent, TabsList, TabsTrigger } from "@base-template/ui/components/tabs";
import type { ReactNode } from "react";

import {
  isStudentProfileTab,
  STUDENT_PROFILE_TAB_LABELS,
  STUDENT_PROFILE_TABS,
  type StudentProfileTab,
} from "../lib/student-profile";

/**
 * STU-02 tab frame (sige/05 §5.2): "Información", "Horario", "Acudientes". The selected tab is
 * controlled by the caller (it lives in the URL, `?tab=`) and only the selected panel is mounted,
 * so the schedule query runs only when its tab is open. Presentational.
 */
export default function StudentProfileTabs({
  tab,
  onTabChange,
  panels,
}: {
  tab: StudentProfileTab;
  onTabChange: (tab: StudentProfileTab) => void;
  panels: Readonly<Record<StudentProfileTab, ReactNode>>;
}) {
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        if (isStudentProfileTab(next)) {
          onTabChange(next);
        }
      }}
    >
      <TabsList>
        {STUDENT_PROFILE_TABS.map((value) => (
          <TabsTrigger key={value} value={value}>
            {STUDENT_PROFILE_TAB_LABELS[value]}
          </TabsTrigger>
        ))}
      </TabsList>
      {STUDENT_PROFILE_TABS.map((value) => (
        <TabsContent key={value} value={value} className="pt-2">
          {value === tab ? panels[value] : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
