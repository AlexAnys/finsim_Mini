import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { success, notFound, handleServiceError } from "@/lib/api-utils";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { id } = await params;

    // Get the task instance with task details
    const instance = await prisma.taskInstance.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            scoringCriteria: { orderBy: { order: "asc" } },
          },
        },
        class: { select: { id: true, name: true } },
      },
    });
    if (!instance) return notFound("任务实例不存在");

    // Get all submissions with their type-specific data
    const submissions = await prisma.submission.findMany({
      where: { taskInstanceId: id },
      include: {
        student: { select: { id: true, name: true, email: true } },
        simulationSubmission: true,
        quizSubmission: true,
        subjectiveSubmission: true,
      },
      orderBy: { submittedAt: "desc" },
    });

    // Compute stats
    const gradedSubs = submissions.filter(s => s.status === "graded" && s.score !== null);
    const totalSubmissions = submissions.length;
    const gradedCount = gradedSubs.length;
    const avgScore = gradedCount > 0
      ? Math.round(gradedSubs.reduce((sum, s) => sum + Number(s.score || 0), 0) / gradedCount * 10) / 10
      : 0;
    const maxScore = instance.task.scoringCriteria.reduce((sum, c) => sum + c.maxPoints, 0) || 100;

    // Score distribution (buckets: 0-10, 10-20, ..., 90-100)
    const distribution = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}-${(i + 1) * 10}`,
      min: i * 10,
      max: (i + 1) * 10,
      count: 0,
      students: [] as Array<{ id: string; name: string; score: number }>,
    }));

    for (const sub of gradedSubs) {
      // Normalize to 0-100 scale
      const normalized = maxScore > 0 ? Math.round((Number(sub.score!) / maxScore) * 100) : 0;
      const bucketIdx = Math.min(Math.floor(normalized / 10), 9);
      distribution[bucketIdx].count++;
      distribution[bucketIdx].students.push({
        id: sub.student.id,
        name: sub.student.name,
        score: Number(sub.score!),
      });
    }

    // Per-criterion analysis (from evaluation JSON)
    const criteriaStats = instance.task.scoringCriteria.map(criterion => {
      const scores: Array<{ studentId: string; studentName: string; score: number; maxScore: number; comment: string }> = [];

      for (const sub of gradedSubs) {
        // Get evaluation from the type-specific submission
        let evaluation: any = null;
        if (sub.simulationSubmission?.evaluation) evaluation = sub.simulationSubmission.evaluation;
        else if (sub.quizSubmission?.evaluation) evaluation = sub.quizSubmission.evaluation;
        else if (sub.subjectiveSubmission?.evaluation) evaluation = sub.subjectiveSubmission.evaluation;

        if (evaluation?.rubricBreakdown) {
          const breakdown = evaluation.rubricBreakdown.find(
            (b: any) => b.criterionId === criterion.id
          );
          if (breakdown) {
            scores.push({
              studentId: sub.student.id,
              studentName: sub.student.name,
              score: breakdown.score,
              maxScore: breakdown.maxScore || criterion.maxPoints,
              comment: breakdown.comment || "",
            });
          }
        }
      }

      const avgCriterionScore = scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length * 10) / 10
        : 0;

      // Sort by score ascending for weakness ranking
      const weakStudents = [...scores].sort((a, b) => a.score - b.score);

      return {
        criterionId: criterion.id,
        criterionName: criterion.name,
        maxPoints: criterion.maxPoints,
        description: criterion.description,
        avgScore: avgCriterionScore,
        scores,
        weakStudents: weakStudents.slice(0, 10),
      };
    });

    // Sort criteria by average score ascending (weakest dimensions first)
    const weaknessByDimension = [...criteriaStats].sort((a, b) => {
      const aRatio = a.maxPoints > 0 ? a.avgScore / a.maxPoints : 0;
      const bRatio = b.maxPoints > 0 ? b.avgScore / b.maxPoints : 0;
      return aRatio - bRatio;
    });

    return success({
      instance: {
        id: instance.id,
        title: instance.title,
        taskType: instance.taskType,
        status: instance.status,
        className: instance.class.name,
      },
      stats: {
        totalSubmissions,
        gradedCount,
        avgScore,
        maxScore,
        highestScore: gradedSubs.length > 0 ? Math.max(...gradedSubs.map(s => Number(s.score!))) : 0,
        lowestScore: gradedSubs.length > 0 ? Math.min(...gradedSubs.map(s => Number(s.score!))) : 0,
      },
      distribution,
      criteriaStats,
      weaknessByDimension,
      submissions: submissions.map(s => ({
        id: s.id,
        studentId: s.student.id,
        studentName: s.student.name,
        status: s.status,
        score: s.score !== null ? Number(s.score) : null,
        maxScore: s.maxScore !== null ? Number(s.maxScore) : null,
        submittedAt: s.submittedAt,
        gradedAt: s.gradedAt,
      })),
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
