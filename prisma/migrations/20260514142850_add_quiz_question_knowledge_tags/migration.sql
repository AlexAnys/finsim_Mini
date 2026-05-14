-- AlterEnum
ALTER TYPE "AsyncJobType" ADD VALUE 'quiz_question_tag';

-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "knowledgeTagIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
