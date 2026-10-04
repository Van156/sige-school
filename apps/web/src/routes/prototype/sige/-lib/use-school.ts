import {
  assignmentStore,
  blockStore,
  campusStore,
  classroomStore,
  enrollmentStore,
  fullName,
  gradeStore,
  parentLinkStore,
  scheduleStore,
  studentStore,
  subjectGradeStore,
  subjectStore,
  useMockCollection,
  userStore,
  type SubjectGradeRecord,
} from "../-mock";
import type { AcademicStudent, DayOfWeek, Grade, User } from "../-mock/types";
import { buildScheduleRows, type ScheduleEntry } from "./schedule-view";

/**
 * Live, institution-scoped view over the editable stores plus name lookups. Every SCH and STU
 * screen reads through this hook so edits made in one screen show up in the others.
 */
export function useSchool(institutionId: number) {
  const users = useMockCollection(userStore);
  const campusList = useMockCollection(campusStore);
  const gradeList = useMockCollection(gradeStore);
  const subjectList = useMockCollection(subjectStore);
  const studentList = useMockCollection(studentStore);
  const subjectGradeList = useMockCollection(subjectGradeStore);
  const classroomList = useMockCollection(classroomStore);
  const blockList = useMockCollection(blockStore);
  const scheduleList = useMockCollection(scheduleStore);
  const enrollmentList = useMockCollection(enrollmentStore);
  const assignmentList = useMockCollection(assignmentStore);
  const parentLinks = useMockCollection(parentLinkStore);

  const campuses = campusList.filter((campus) => campus.institutionId === institutionId);
  const campusIds = new Set(campuses.map((campus) => campus.id));
  const grades = gradeList.filter((grade) => campusIds.has(grade.campusId));
  const gradeIds = new Set(grades.map((grade) => grade.id));
  const subjects = subjectList.filter((subject) => subject.institutionId === institutionId);
  const subjectGrades = subjectGradeList.filter((item) => gradeIds.has(item.gradeId));
  const subjectGradeIds = new Set(subjectGrades.map((item) => item.id));
  const students = studentList.filter((student) => student.institutionId === institutionId);
  const studentIds = new Set(students.map((student) => student.id));
  const teachers = users.filter(
    (user) => user.role === "teacher" && user.institutionId === institutionId,
  );
  const parents = users.filter(
    (user) => user.role === "parent" && user.institutionId === institutionId,
  );
  const classrooms = classroomList.filter((room) => campusIds.has(room.campusId));
  const blocks = blockList.filter((block) => campusIds.has(block.campusId));
  const enrollments = enrollmentList.filter(
    (row) => studentIds.has(row.studentId) && subjectGradeIds.has(row.subjectGradeId),
  );
  const assignments = assignmentList.filter((row) => subjectGradeIds.has(row.subjectGradeId));
  const schedules = scheduleList.filter((row) => subjectGradeIds.has(row.subjectGradeId));

  const userById = new Map(users.map((user) => [user.id, user]));
  const gradeById = new Map(gradeList.map((grade) => [grade.id, grade]));
  const subjectById = new Map(subjectList.map((subject) => [subject.id, subject]));
  const campusById = new Map(campusList.map((campus) => [campus.id, campus]));
  const studentById = new Map(studentList.map((student) => [student.id, student]));
  const subjectGradeById = new Map(subjectGradeList.map((item) => [item.id, item]));
  const classroomById = new Map(classroomList.map((room) => [room.id, room]));

  const userName = (id: number | undefined) => {
    const user = id === undefined ? undefined : userById.get(id);
    return user ? fullName(user) : undefined;
  };
  const userOfStudent = (student: AcademicStudent): User | undefined =>
    userById.get(student.userId);
  const studentName = (studentId: number) => {
    const student = studentById.get(studentId);
    return (student && userName(student.userId)) ?? "Estudiante";
  };
  const subjectNameOf = (item: SubjectGradeRecord) => subjectById.get(item.subjectId)?.name ?? "-";

  /** Schedule entries (resolved names) of the given subject-grade ids. */
  const entriesFor = (ids: ReadonlySet<number>, showCourse: boolean): ScheduleEntry[] =>
    schedules
      .filter((row) => ids.has(row.subjectGradeId))
      .flatMap((row) => {
        const item = subjectGradeById.get(row.subjectGradeId);
        if (!item) return [];
        return [
          {
            dayOfWeek: row.dayOfWeek as DayOfWeek,
            startTime: row.startTime,
            cell: {
              subject: subjectNameOf(item),
              teacher: userName(item.teacherId) ?? "Sin profesor",
              classroom: classroomById.get(row.classroomId)?.name ?? "-",
              course: showCourse ? gradeById.get(item.gradeId)?.name : undefined,
              scheduleId: row.id,
            },
          },
        ];
      });

  const blocksOfGrade = (grade: Grade) =>
    blockList.filter((block) => block.campusId === grade.campusId && block.shift === grade.shift);

  return {
    campuses,
    grades,
    subjects,
    subjectGrades,
    students,
    teachers,
    parents,
    classrooms,
    blocks,
    enrollments,
    assignments,
    schedules,
    parentLinks,
    users,
    userById,
    gradeById,
    subjectById,
    campusById,
    studentById,
    subjectGradeById,
    classroomById,
    userName,
    userOfStudent,
    studentName,
    campusName: (id: number) => campusById.get(id)?.name ?? "-",
    gradeName: (id: number | undefined) => (id === undefined ? undefined : gradeById.get(id)?.name),
    subjectName: (id: number) => subjectById.get(id)?.name ?? "-",
    subjectGradeLabel: (item: SubjectGradeRecord) =>
      `${subjectNameOf(item)} · ${gradeById.get(item.gradeId)?.name ?? "-"}`,
    /** Weekly grid of one course (its campus/shift blocks, breaks included). */
    gradeScheduleRows: (grade: Grade) =>
      buildScheduleRows(
        blocksOfGrade(grade),
        entriesFor(
          new Set(subjectGrades.filter((item) => item.gradeId === grade.id).map((item) => item.id)),
          false,
        ),
      ),
    /** Weekly grid of a teacher: the blocks of every course they teach. */
    teacherScheduleRows: (teacherId: number) => {
      const own = subjectGrades.filter((item) => item.teacherId === teacherId);
      const courseIds = new Set(own.map((item) => item.gradeId));
      const teachingBlocks = grades
        .filter((grade) => courseIds.has(grade.id))
        .flatMap((grade) => blocksOfGrade(grade));
      return buildScheduleRows(
        teachingBlocks,
        entriesFor(new Set(own.map((item) => item.id)), true),
      );
    },
  };
}

export type School = ReturnType<typeof useSchool>;
