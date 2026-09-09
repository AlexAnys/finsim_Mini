/** Numeric summaries are computed from records, never inferred by the language model. */
export interface InsightSubmission {
  submissionId: string;
  studentId: string;
  studentName: string;
  classId: string | null;
  className: string | null;
  courseId: string | null;
  courseTitle: string | null;
  score: number | null;
  maxScore: number | null;
  conceptTags: string[];
}
const mean = (values: number[]) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : null;
const scoreOf = (s: InsightSubmission) => s.score != null && s.maxScore != null && s.maxScore > 0 && s.score >= 0 && s.score <= s.maxScore ? s.score / s.maxScore * 100 : null;

export function weeklyStatistics(submissions: InsightSubmission[]) {
  const classes = new Map<string, { className: string; students: Map<string, number[]> }>();
  const students = new Map<string, number[]>();
  const courses = new Map<string, { courseTitle: string; tags: Map<string, Map<string, { name: string; scores: number[] }>> }>();
  for (const submission of submissions) {
    const score = scoreOf(submission);
    if (score == null) continue;
    students.set(submission.studentId, [...(students.get(submission.studentId) ?? []), score]);
    if (submission.classId) {
      const group = classes.get(submission.classId) ?? { className: submission.className || "未命名班级", students: new Map() };
      group.students.set(submission.studentId, [...(group.students.get(submission.studentId) ?? []), score]);
      classes.set(submission.classId, group);
    }
    if (submission.courseId) {
      const course = courses.get(submission.courseId) ?? { courseTitle: submission.courseTitle || "未命名课程", tags: new Map() };
      for (const tag of new Set(submission.conceptTags)) {
        const taggedStudents = course.tags.get(tag) ?? new Map<string, { name: string; scores: number[] }>();
        const student = taggedStudents.get(submission.studentId) ?? { name: submission.studentName, scores: [] };
        student.scores.push(score);
        taggedStudents.set(submission.studentId, student);
        course.tags.set(tag, taggedStudents);
      }
      courses.set(submission.courseId, course);
    }
  }
  return {
    classDifferences: [...classes].map(([classId, value]) => ({ classId, className: value.className,
      avgScore: mean([...value.students.values()].map((scores) => mean(scores)!)),
      summary: `已公布成绩先按百分制换算，再按学生平均；${value.students.size} 名学生。`,
    })),
    // Legacy API field names retained; UI explicitly describes related-submission low-score rate.
    weakConceptsByCourse: [...courses].map(([courseId, course]) => ({ courseId, courseTitle: course.courseTitle,
      concepts: [...course.tags].map(([tag, tagged]) => {
        const low = [...tagged.values()].filter((student) => mean(student.scores)! < 60);
        return { tag, errorRate: low.length / tagged.size, exampleStudents: low.slice(0, 3).map((student) => student.name) };
      }).filter((tag) => tag.errorRate > 0).sort((a, b) => b.errorRate - a.errorRate).slice(0, 5),
    })).filter((course) => course.concepts.length > 0),
    studentClusters: [
      { label: "均分低于 60", min: 0, max: 60 },
      { label: "均分 60–79", min: 60, max: 80 },
      { label: "均分 80 及以上", min: 80, max: 101 },
    ].map((bucket) => ({ label: bucket.label,
      size: [...students.values()].filter((scores) => mean(scores)! >= bucket.min && mean(scores)! < bucket.max).length,
      characteristics: "按每位学生本周已公布成绩的百分制均分分组。",
    })).filter((bucket) => bucket.size > 0),
  };
}
