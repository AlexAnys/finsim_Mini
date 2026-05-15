--
-- PostgreSQL database dump
--

\restrict GjgmzQjzW96KmqYat5KhAWc7geaaovQh5R9o1cPaYhPdMveCciu0aPtgbB6i8OZ

-- Dumped from database version 16.12
-- Dumped by pg_dump version 16.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: AiRunStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AiRunStatus" AS ENUM (
    'running',
    'succeeded',
    'failed'
);


--
-- Name: AiThinkingLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AiThinkingLevel" AS ENUM (
    'disabled',
    'enabled'
);


--
-- Name: AnnouncementStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnnouncementStatus" AS ENUM (
    'published',
    'draft',
    'archived'
);


--
-- Name: AsyncJobStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AsyncJobStatus" AS ENUM (
    'queued',
    'running',
    'succeeded',
    'failed',
    'canceled'
);


--
-- Name: AsyncJobType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AsyncJobType" AS ENUM (
    'knowledge_source_ingest',
    'task_draft_generate',
    'task_import_parse',
    'submission_grade',
    'ai_work_assistant',
    'analytics_recompute',
    'data_insight_advice'
);


--
-- Name: ContentBlockType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ContentBlockType" AS ENUM (
    'markdown',
    'resource',
    'simulation_config',
    'quiz',
    'subjective',
    'custom'
);


--
-- Name: GroupType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."GroupType" AS ENUM (
    'manual',
    'auto_score_bucket'
);


--
-- Name: ImportJobStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ImportJobStatus" AS ENUM (
    'uploaded',
    'processing',
    'completed',
    'failed'
);


--
-- Name: KnowledgeSourceKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."KnowledgeSourceKind" AS ENUM (
    'pdf',
    'text',
    'docx',
    'zip',
    'image',
    'spreadsheet'
);


--
-- Name: KnowledgeSourceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."KnowledgeSourceStatus" AS ENUM (
    'uploaded',
    'processing',
    'ready',
    'failed',
    'extracting',
    'ocr_required',
    'ocr_processing',
    'ai_summary_failed'
);


--
-- Name: QuizMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."QuizMode" AS ENUM (
    'fixed',
    'adaptive'
);


--
-- Name: QuizQuestionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."QuizQuestionType" AS ENUM (
    'single_choice',
    'multiple_choice',
    'true_false',
    'short_answer'
);


--
-- Name: ReleaseMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReleaseMode" AS ENUM (
    'manual',
    'auto'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'student',
    'teacher',
    'admin'
);


--
-- Name: SlotType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SlotType" AS ENUM (
    'pre',
    'in',
    'post'
);


--
-- Name: StrictnessLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StrictnessLevel" AS ENUM (
    'LENIENT',
    'MODERATE',
    'STRICT',
    'VERY_STRICT'
);


--
-- Name: StudyBuddyMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StudyBuddyMode" AS ENUM (
    'socratic',
    'direct'
);


--
-- Name: StudyBuddyStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StudyBuddyStatus" AS ENUM (
    'pending',
    'answered',
    'error'
);


--
-- Name: SubmissionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubmissionStatus" AS ENUM (
    'submitted',
    'grading',
    'graded',
    'failed'
);


--
-- Name: TaskBuildDraftStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TaskBuildDraftStatus" AS ENUM (
    'draft',
    'queued',
    'processing',
    'ready',
    'failed',
    'published'
);


--
-- Name: TaskInstanceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TaskInstanceStatus" AS ENUM (
    'draft',
    'published',
    'closed',
    'archived'
);


--
-- Name: TaskType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TaskType" AS ENUM (
    'simulation',
    'quiz',
    'subjective'
);


--
-- Name: Visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Visibility" AS ENUM (
    'private',
    'shared',
    'department',
    'public'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AiRun; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiRun" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "toolKey" character varying(80) NOT NULL,
    feature character varying(80) NOT NULL,
    provider character varying(40) NOT NULL,
    model character varying(120) NOT NULL,
    status public."AiRunStatus" DEFAULT 'running'::public."AiRunStatus" NOT NULL,
    "promptVersion" character varying(80),
    "promptHash" character varying(120),
    "inputSize" integer,
    "outputSize" integer,
    "latencyMs" integer,
    error text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AiToolSetting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiToolSetting" (
    id text NOT NULL,
    "teacherId" text NOT NULL,
    "toolKey" character varying(80) NOT NULL,
    model character varying(120),
    thinking public."AiThinkingLevel" DEFAULT 'disabled'::public."AiThinkingLevel" NOT NULL,
    temperature double precision,
    "systemPromptSuffix" text,
    "enableSearch" boolean DEFAULT false NOT NULL,
    strictness character varying(40),
    "outputStyle" character varying(80),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    provider character varying(40)
);


--
-- Name: AllocationItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AllocationItem" (
    id text NOT NULL,
    "sectionId" text NOT NULL,
    label character varying(200) NOT NULL,
    "order" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AllocationSection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AllocationSection" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    label character varying(200) NOT NULL,
    "order" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AnalysisReport; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnalysisReport" (
    id text NOT NULL,
    "taskId" text,
    "taskInstanceId" text,
    "createdBy" text NOT NULL,
    "studentCount" integer NOT NULL,
    report jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "aggregatedAt" timestamp(3) without time zone,
    "commonIssues" jsonb,
    "moodTimeline" jsonb,
    "scopeHash" text,
    "scopeSummary" jsonb
);


--
-- Name: Announcement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Announcement" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    title character varying(500) NOT NULL,
    body text NOT NULL,
    status public."AnnouncementStatus" DEFAULT 'draft'::public."AnnouncementStatus" NOT NULL,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AsyncJob; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AsyncJob" (
    id text NOT NULL,
    type public."AsyncJobType" NOT NULL,
    status public."AsyncJobStatus" DEFAULT 'queued'::public."AsyncJobStatus" NOT NULL,
    "entityType" character varying(80),
    "entityId" character varying(120),
    progress integer DEFAULT 0 NOT NULL,
    input jsonb,
    result jsonb,
    error text,
    attempts integer DEFAULT 0 NOT NULL,
    "maxAttempts" integer DEFAULT 3 NOT NULL,
    "createdBy" text NOT NULL,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Attachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Attachment" (
    id text NOT NULL,
    "subjectiveSubmissionId" text NOT NULL,
    "fileName" character varying(500) NOT NULL,
    "filePath" character varying(1000) NOT NULL,
    "fileSize" integer NOT NULL,
    "contentType" character varying(100) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    action character varying(100) NOT NULL,
    "actorId" text,
    "targetId" text,
    "targetType" character varying(50),
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Chapter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Chapter" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    title character varying(200) NOT NULL,
    "order" integer NOT NULL,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Class; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Class" (
    id text NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50),
    "academicYear" character varying(20),
    "departmentName" character varying(200),
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ContentBlock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContentBlock" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    "chapterId" text NOT NULL,
    "sectionId" text NOT NULL,
    slot public."SlotType" NOT NULL,
    "blockType" public."ContentBlockType" NOT NULL,
    "order" integer NOT NULL,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Course; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Course" (
    id text NOT NULL,
    "courseTitle" character varying(200) NOT NULL,
    "courseCode" character varying(50),
    description text,
    "classId" text NOT NULL,
    "versionId" character varying(20) DEFAULT 'v1'::character varying NOT NULL,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "semesterStartDate" timestamp(3) without time zone
);


--
-- Name: CourseClass; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CourseClass" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    "classId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CourseKnowledgeSource; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CourseKnowledgeSource" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    "chapterId" text,
    "sectionId" text,
    "teacherId" text NOT NULL,
    kind public."KnowledgeSourceKind" DEFAULT 'pdf'::public."KnowledgeSourceKind" NOT NULL,
    "fileName" character varying(500) NOT NULL,
    "filePath" character varying(1000),
    "mimeType" character varying(120) NOT NULL,
    status public."KnowledgeSourceStatus" DEFAULT 'uploaded'::public."KnowledgeSourceStatus" NOT NULL,
    "extractedText" text,
    summary text,
    "conceptTags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "taskId" text,
    "taskInstanceId" text,
    "sourceType" character varying(80),
    "structuredData" jsonb,
    tags text[] DEFAULT ARRAY[]::text[]
);


--
-- Name: CourseTeacher; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CourseTeacher" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    "teacherId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ImportJob; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ImportJob" (
    id text NOT NULL,
    "teacherId" text NOT NULL,
    "taskId" text NOT NULL,
    "fileName" character varying(500) NOT NULL,
    "filePath" character varying(1000) NOT NULL,
    status public."ImportJobStatus" DEFAULT 'uploaded'::public."ImportJobStatus" NOT NULL,
    "totalQuestions" integer,
    "processedQuestions" integer,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: QuizConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuizConfig" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    mode public."QuizMode" NOT NULL,
    "timeLimitMinutes" integer,
    "showCorrectAnswer" boolean DEFAULT false NOT NULL,
    "maxQuestions" integer,
    "startDifficulty" integer,
    "difficultyStep" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: QuizQuestion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuizQuestion" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    type public."QuizQuestionType" NOT NULL,
    prompt text NOT NULL,
    options jsonb,
    "correctOptionIds" character varying(50)[],
    "correctAnswer" text,
    points integer NOT NULL,
    difficulty integer,
    explanation text,
    "order" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: QuizSubmission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuizSubmission" (
    id text NOT NULL,
    "submissionId" text NOT NULL,
    answers jsonb,
    "startedAt" timestamp(3) without time zone,
    "finishedAt" timestamp(3) without time zone,
    "durationSeconds" integer,
    evaluation jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "conceptTags" text[] DEFAULT ARRAY[]::text[]
);


--
-- Name: ScheduleSlot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ScheduleSlot" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    "dayOfWeek" integer NOT NULL,
    "slotIndex" integer NOT NULL,
    "startWeek" integer NOT NULL,
    "endWeek" integer NOT NULL,
    "timeLabel" character varying(50) NOT NULL,
    classroom character varying(100),
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "weekType" character varying(10) DEFAULT 'all'::character varying NOT NULL
);


--
-- Name: ScoringCriterion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ScoringCriterion" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    "maxPoints" integer NOT NULL,
    "order" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Section; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Section" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    "chapterId" text NOT NULL,
    title character varying(200) NOT NULL,
    "order" integer NOT NULL,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SimulationConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SimulationConfig" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    scenario text NOT NULL,
    "openingLine" text NOT NULL,
    "dialogueRequirements" text,
    "studyBuddyContext" text,
    "evaluatorPersona" text,
    "strictnessLevel" public."StrictnessLevel" DEFAULT 'MODERATE'::public."StrictnessLevel" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "systemPrompt" text
);


--
-- Name: SimulationSubmission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SimulationSubmission" (
    id text NOT NULL,
    "submissionId" text NOT NULL,
    transcript jsonb,
    assets jsonb,
    evaluation jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "conceptTags" text[] DEFAULT ARRAY[]::text[]
);


--
-- Name: StudentGroup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudentGroup" (
    id text NOT NULL,
    "teacherId" text NOT NULL,
    "classId" text NOT NULL,
    name character varying(200) NOT NULL,
    type public."GroupType" NOT NULL,
    meta jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StudentGroupMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudentGroupMember" (
    id text NOT NULL,
    "groupId" text NOT NULL,
    "studentId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: StudyBuddyPost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudyBuddyPost" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "taskId" text NOT NULL,
    "taskInstanceId" text,
    title character varying(500) NOT NULL,
    question text NOT NULL,
    mode public."StudyBuddyMode" NOT NULL,
    anonymous boolean NOT NULL,
    status public."StudyBuddyStatus" DEFAULT 'pending'::public."StudyBuddyStatus" NOT NULL,
    "aiReply" text,
    "replyGeneratedAt" timestamp(3) without time zone,
    messages jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isPreview" boolean DEFAULT false NOT NULL
);


--
-- Name: StudyBuddySummary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudyBuddySummary" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "generatedAt" timestamp(3) without time zone NOT NULL,
    "topQuestions" jsonb NOT NULL,
    "knowledgeGaps" jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SubjectiveConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SubjectiveConfig" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    prompt text NOT NULL,
    "allowTextAnswer" boolean DEFAULT true NOT NULL,
    "allowedAttachmentTypes" character varying(20)[],
    "referenceAnswer" text,
    "evaluatorPersona" text,
    "strictnessLevel" public."StrictnessLevel" DEFAULT 'MODERATE'::public."StrictnessLevel" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SubjectiveSubmission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SubjectiveSubmission" (
    id text NOT NULL,
    "submissionId" text NOT NULL,
    "textAnswer" text,
    "extractedText" text,
    evaluation jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "conceptTags" text[] DEFAULT ARRAY[]::text[]
);


--
-- Name: Submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Submission" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "taskId" text NOT NULL,
    "taskType" public."TaskType" NOT NULL,
    status public."SubmissionStatus" DEFAULT 'submitted'::public."SubmissionStatus" NOT NULL,
    score numeric(10,2),
    "maxScore" numeric(10,2),
    "taskInstanceId" text,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "gradedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "releasedAt" timestamp(3) without time zone
);


--
-- Name: Task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Task" (
    id text NOT NULL,
    "taskType" public."TaskType" NOT NULL,
    "taskName" character varying(200) NOT NULL,
    requirements text,
    visibility public."Visibility" DEFAULT 'private'::public."Visibility" NOT NULL,
    "practiceEnabled" boolean DEFAULT false NOT NULL,
    "creatorId" text NOT NULL,
    "courseName" character varying(200),
    "chapterName" character varying(200),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TaskBuildDraft; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TaskBuildDraft" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    "chapterId" text,
    "sectionId" text,
    slot public."SlotType",
    "taskType" public."TaskType" NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    status public."TaskBuildDraftStatus" DEFAULT 'draft'::public."TaskBuildDraftStatus" NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    "sourceIds" text[] DEFAULT ARRAY[]::text[],
    "missingFields" text[] DEFAULT ARRAY[]::text[],
    "draftPayload" jsonb,
    error text,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "asyncJobId" character varying(120)
);


--
-- Name: TaskInstance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TaskInstance" (
    id text NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    "taskId" text NOT NULL,
    "taskType" public."TaskType" NOT NULL,
    "classId" text NOT NULL,
    "groupIds" text[],
    "courseId" text,
    "chapterId" text,
    "sectionId" text,
    slot public."SlotType",
    "dueAt" timestamp(3) without time zone NOT NULL,
    "publishAt" timestamp(3) without time zone,
    "publishedAt" timestamp(3) without time zone,
    status public."TaskInstanceStatus" DEFAULT 'draft'::public."TaskInstanceStatus" NOT NULL,
    "attemptsAllowed" integer,
    "taskSnapshot" jsonb,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "autoReleaseAt" timestamp(3) without time zone,
    "releaseMode" public."ReleaseMode" DEFAULT 'manual'::public."ReleaseMode" NOT NULL
);


--
-- Name: TaskInstanceAnalytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TaskInstanceAnalytics" (
    id text NOT NULL,
    "taskInstanceId" text NOT NULL,
    "taskId" text NOT NULL,
    "submissionCount" integer DEFAULT 0 NOT NULL,
    "avgScore" numeric(10,2),
    "scoreDist" jsonb,
    "quizQuestionStats" jsonb,
    "subjectiveRubricStats" jsonb,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TaskPost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TaskPost" (
    id text NOT NULL,
    "taskInstanceId" text NOT NULL,
    "authorId" text NOT NULL,
    content text NOT NULL,
    "replyToPostId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name character varying(100) NOT NULL,
    role public."Role" NOT NULL,
    "classId" text,
    "avatarUrl" character varying(500),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Data for Name: AiRun; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AiRun" (id, "userId", "toolKey", feature, provider, model, status, "promptVersion", "promptHash", "inputSize", "outputSize", "latencyMs", error, metadata, "createdAt", "updatedAt") FROM stdin;
5dffa2e8-4090-48d4-b195-b14d5425d44e	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	questionAnalysis	questionAnalysis	qwen	qwen3-max	succeeded	v1	150aac2a4b580167309fd640abf4fbf15900b708cd6baf9969476e2f867459fb	21	6	1018	\N	\N	2026-05-01 14:40:24.858	2026-05-01 14:40:25.876
b30e8ef9-2b4c-46f2-922d-9af6e434590f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	qwen	qwen3-max	succeeded	v1	baa0d22f7b3ef35bf569fd6216899c262aabd68f81f419ca0396027acde98599	1602	193	4380	\N	\N	2026-05-01 14:53:28.6	2026-05-01 14:53:32.978
e67b6a97-c2b5-4069-92a8-24dfbd76d16d	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	weeklyInsight	weeklyInsight	qwen	qwen3.5-plus	succeeded	v1	5a4fffbf8cf489c9fb99edf7f3808b991381a70d9be65957e2cf96d0526355f4	3606	2608	97847	\N	\N	2026-05-01 14:55:18.893	2026-05-01 14:56:56.744
7eef18a2-de0a-49ae-a326-2a38f4929501	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	qwen	qwen3-max	succeeded	v1	9abda7b99b9c0063c3a35900207fe28458288ec69efb2f53cf5b6db39ffaae1a	1594	188	4008	\N	\N	2026-05-01 15:23:13.161	2026-05-01 15:23:17.168
f312add8-0fc3-4a5c-ac27-1a2797845736	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	simulationChat	simulation	qwen	qwen3-max	succeeded	v1	15dec4277136788d488016c4536403b6055b2132be01dbeed48a50ec6d9eb064	1565	189	4467	\N	\N	2026-05-02 00:38:05.354	2026-05-02 00:38:09.822
9c7f6767-cda9-4d3b-9210-d849b9faa761	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	qwen	qwen3-max	succeeded	v1	0401cb8262bff2502bb867ecf04fca1313ca03577d270e28e65b20091694bdf0	1603	200	6547	\N	\N	2026-05-02 05:58:18.303	2026-05-02 05:58:24.851
8f143a76-5fe5-46f2-9b85-80d01c98772d	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	weeklyInsight	weeklyInsight	qwen	qwen3.5-plus	succeeded	v1	774bd126c637bba9aa4588304b65eca2de47887ebb346c0a5efcb644ec618389	3606	2633	119024	\N	\N	2026-05-02 06:01:26.038	2026-05-02 06:03:25.063
2b3d66e8-9815-4665-bb17-671179baefe2	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	simulationChat	simulation	qwen	qwen3-max	succeeded	v1	09ab125025b6aca87790e0f274e6dfa9277d18c9d61910d69a4f870808607d2d	1565	211	4917	\N	\N	2026-05-02 07:20:59.646	2026-05-02 07:21:04.562
c6356171-bf8c-4be6-9602-e1588a7e74b8	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	qwen	qwen3-max	succeeded	v1	1048cf5971a1da600b569174cb8e38eb36a1aa62e637f510bb0a78ab50c0e01d	2589	220	4176	\N	\N	2026-05-02 07:22:32.834	2026-05-02 07:22:37.009
85b93156-0b08-469b-96ba-2ca6562a7134	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	qwen	qwen3-max	succeeded	v1	ce80c14085e4662a492583b233736f1eb3f90a5bc8fd3141b88bcc5002f63d88	1502	173	3714	\N	\N	2026-05-02 07:52:30.165	2026-05-02 07:52:33.878
ddc5d38e-18ec-4397-adc9-16fbf9b16723	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	weeklyInsight	weeklyInsight	qwen	qwen3.5-plus	succeeded	v1	774bd126c637bba9aa4588304b65eca2de47887ebb346c0a5efcb644ec618389	3606	1582	120117	\N	\N	2026-05-02 07:53:09.626	2026-05-02 07:55:09.742
0ef65da1-9716-41cb-8b0f-7f30ea5f9ffd	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	lessonPolish	lessonPolish	qwen	qwen3-max	succeeded	v1	f61a31806143c7e3b350f75bd8e92aa5c090d40620a2d1cbe2d62bcfe5504272	711	1659	25496	\N	\N	2026-05-02 07:56:03.792	2026-05-02 07:56:29.288
4cf32305-b681-4e4b-84f6-cf78485e50bb	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	qwen	qwen3-max	succeeded	v1	529f636e7b2e04ed90674cacc87be275936935da3368fbba76c5d451c6983173	4032	2387	27712	\N	\N	2026-05-02 09:19:16.378	2026-05-02 09:19:44.088
f32165d3-2fb0-43fd-87cc-46dbc7ef2aa2	edad1bc2-43ae-4598-8e12-1053ef4eb964	simulationChat	simulation	qwen	qwen3-max	succeeded	v1	56f5bb40bd49b3ebd09a6cf5339ba420b5ce5151aa4977b0b9f7c49e3803cd17	1609	174	3323	\N	\N	2026-05-02 09:33:17.827	2026-05-02 09:33:21.15
df5aac2d-fe5c-4085-bba9-90dc12854037	edad1bc2-43ae-4598-8e12-1053ef4eb964	simulationGrading	evaluation	qwen	qwen3.5-plus	succeeded	v1	8d9223e23ef87770254e633bfb6547902921613d4a923941878e80549be09fa0	1876	1233	244051	\N	\N	2026-05-02 09:33:29.553	2026-05-02 09:37:33.604
e5435ac6-d519-4484-9ede-7ced2b129de4	32575dd0-e927-408b-ba9f-7f003bfd60d6	subjectiveGrade	subjectiveGrade	qwen	qwen3.5-plus	succeeded	v1	377ec3c2dd8c8e4c2cf6dab000b09677f77bbdd56faf44740b0b362c908482a4	1149	1149	83115	\N	\N	2026-05-02 09:38:54.986	2026-05-02 09:40:18.102
73b694a8-65d6-4ffa-83fe-14d7a91fd453	236c3795-f19f-4107-a681-0bc0e1d21d62	subjectiveGrade	subjectiveGrade	qwen	qwen3.5-plus	succeeded	v1	aa15e66f3b0ff36da70369067a74918e8a754dda6f07aaf0dc0ea81b80a9e13b	1192	1139	83720	\N	\N	2026-05-02 09:43:37.752	2026-05-02 09:45:01.472
e329a47d-0cd6-49a5-921a-5494d9c16285	236c3795-f19f-4107-a681-0bc0e1d21d62	quizGrade	quizGrade	qwen	qwen3.5-plus	succeeded	v1	7c5c56478e1a60bfcdb83c270ea5cbe03b807cb0c0ca16f103113bf0b430c2cd	355	55	62853	\N	\N	2026-05-02 09:45:12.886	2026-05-02 09:46:15.739
a4c41a80-0d45-44b9-a2b2-48e2e96c3a21	236c3795-f19f-4107-a681-0bc0e1d21d62	quizGrade	quizGrade	qwen	qwen3.5-plus	succeeded	v1	a678f715601ed4a107adb22c2ef31986a8b19b799506da3668fe6c7cde6c43df	320	101	20964	\N	\N	2026-05-02 09:58:18.515	2026-05-02 09:58:39.479
2025bedb-ac56-4e1a-a119-c8bd218f2242	236c3795-f19f-4107-a681-0bc0e1d21d62	quizGrade	quizGrade	qwen	qwen3.5-plus	succeeded	v1	832dc8c637f34db9c74505421e0cdb378e69bb768a15cb7938a9ef5405013a83	224	55	336912	\N	\N	2026-05-02 09:58:39.491	2026-05-02 10:04:16.404
505bb107-4852-419a-b5b4-a77dfc78fd05	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	qwen	qwen3-max	succeeded	v1	d9f6e14ac60923346b8cc974dc2fb74e4bd8a35f85493f9b0a20338c3d13ecc0	462	240	4752	\N	{"courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceId": "46d57c02-b5bc-494a-a64e-ce67f6486d07", "sourceType": "syllabus", "effectiveModel": "qwen3-max", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "qwen"}	2026-05-02 13:50:04.9	2026-05-02 13:50:09.649
917d033a-6003-4cd8-99c8-bd3a9355bf81	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	964fb292d14f566744adcb63b310a7d9f88341face9f3e266a569b1d36af3c1d	4501	1169	36557	\N	{"source": "data_insight_advice", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "fingerprint": "dbc5za", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-02 17:36:12.865	2026-05-02 17:36:49.421
a8501dad-19c4-48af-a5c7-1dbac2b12f57	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	ddf09c82ec9fdac311a34c5ffc8fd8bd8bb6aaddec28af78c29c7558b88c33d1	4501	1056	42339	\N	{"source": "data_insight_advice", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "fingerprint": "tuc58w", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-02 17:38:37.417	2026-05-02 17:39:19.756
f3bdde3e-920c-4251-b5ec-203a6fea2f17	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	7f81da629b5f026c2819b1f8013d8054bc91c367bc20d4cf570832706c3c7231	1156	488	29147	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 01:19:16.804	2026-05-03 01:19:45.952
350816d1-6756-4e99-875e-5132d8628b97	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	7f81da629b5f026c2819b1f8013d8054bc91c367bc20d4cf570832706c3c7231	1156	474	27360	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 01:20:41.138	2026-05-03 01:21:08.5
b67663d5-01c2-43fd-b025-81b439396939	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	15dec4277136788d488016c4536403b6055b2132be01dbeed48a50ec6d9eb064	1565	180	19098	\N	{"taskId": "a308c7ba-2713-4c2d-9441-c92927e3f9f4", "effectiveModel": "mimo-v2.5-pro", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "f504facb-1d2b-4fcd-b04e-36182cbd88bb", "effectiveProvider": "mimo"}	2026-05-04 08:00:41.111	2026-05-04 08:01:00.209
018f4bbc-b760-456e-baa9-19a127ee1910	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	qwen	qwen3-max	succeeded	v1	50ff5a3228c132a2292116c27ba3a7b29c07979ee6408998a8ec4919e0de9f5b	941	2290	21984	\N	{"parser": "syllabus-outline", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceId": "46d57c02-b5bc-494a-a64e-ce67f6486d07", "sourceType": "syllabus", "effectiveModel": "qwen3-max", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "qwen"}	2026-05-02 13:50:09.664	2026-05-02 13:50:31.649
7ecaf66c-3157-413c-8c1f-acd7ff251930	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	studyBuddy	studyBuddyReply	qwen	qwen3-max	succeeded	v1	0bda8163e58aaf315d54580b5f0057e7de21e53cfceff321c2b4251dda9076cd	392	139	5095	\N	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "preview": true, "effectiveModel": "qwen3-max", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "studyBuddyPostId": "0f0ec308-cc05-4c1a-8e10-eb08181912c9", "effectiveProvider": "qwen"}	2026-05-02 14:07:13.15	2026-05-02 14:07:18.245
f4196319-da59-43ad-b24c-3b4ad1c9563a	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	deepseek	deepseek-chat	failed	v1	8459b113c33d18ba558daaaa32bcc7311a336ce9ddb12227199a50a55293faa5	1597	\N	642	Authentication Fails, Your api key: ****-xxx is invalid	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "deepseek-chat", "settingsSource": "actor", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "effectiveProvider": "deepseek"}	2026-05-02 14:16:32.312	2026-05-02 14:16:32.955
f407e244-b2d9-418f-a54f-fafe12da1ed1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	deepseek	deepseek-chat	failed	v1	88e6864b49f17ebd449f8391f1f721f0809a26b50357ac9fc1cd574a84b8c180	718	\N	184	Authentication Fails, Your api key: ****-xxx is invalid	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "deepseek-chat", "settingsSource": "actor", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "effectiveProvider": "deepseek"}	2026-05-02 14:16:32.964	2026-05-02 14:16:33.147
090eb5f9-ee09-4bc2-bfcd-5a7c656803b4	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	mimo	mimo-v2.5-pro	failed	v1	c87592a4d2311a1fd4cea510dd1d0a1a64e50df2fc434cc395bb424fdbdc5d9f	1652	\N	545	Invalid API Key	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "effectiveProvider": "mimo"}	2026-05-02 14:26:38.28	2026-05-02 14:26:38.824
b6b58820-f172-43d6-9a68-6bb261c38432	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	mimo	mimo-v2.5-pro	failed	v1	ff585d7af1f193e3a1693b2fc3ebe2d97893bf04af748aee1db97cc26c5eb270	773	\N	113	Invalid API Key	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "effectiveProvider": "mimo"}	2026-05-02 14:26:38.834	2026-05-02 14:26:38.947
d27d5041-fe91-42e6-98ec-32a773d07668	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	mimo	mimo-v2.5-pro	failed	v1	d7f38e8ea182d4e28a6116017ebde1a6e67eeaa5485698be274c1d7670c6fa1e	1713	\N	2623	Insufficient account balance	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "effectiveProvider": "mimo"}	2026-05-02 14:32:04.927	2026-05-02 14:32:07.55
1bce84d5-1df9-40b6-a397-d2bf66b2cf04	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	mimo	mimo-v2.5-pro	failed	v1	c864b6e52f797b6fb1f861bee6bb838bcb4944abac2edcb25a389739ca1befe2	834	\N	65	Insufficient account balance	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "effectiveProvider": "mimo"}	2026-05-02 14:32:07.562	2026-05-02 14:32:07.627
5f1120b1-dbf6-4c4a-bd75-349ea22dc353	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	qwen	qwen3-max	succeeded	v1	bd3d8b40b85dcd06297cfce735739932736f7d4977f09eb9d0a6d1c312e17eff	1767	188	3474	\N	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "qwen3-max", "settingsSource": "actor", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "effectiveProvider": "qwen"}	2026-05-02 14:35:09.356	2026-05-02 14:35:12.83
6875366e-b3e7-491f-9f40-adce0e2594a9	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	qwen	qwen3-max	succeeded	v1	d8da19a0cb690104c9e2a328a8de400d731863aae8bf1e462fb1363f8be4b75a	5427	278	4894	\N	{"courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceId": "b6243518-b534-4193-bc5e-3165db5489ca", "sourceType": "syllabus", "effectiveModel": "qwen3-max", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "qwen"}	2026-05-02 15:17:48.419	2026-05-02 15:17:53.314
296991be-4989-4286-896e-3e8822c97a8f	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	qwen	qwen3-max	succeeded	v1	d102ed4b45b2cedc417ebf4b0bfec9364482252a4d2182dda7f00a23df48a266	5906	4611	46263	\N	{"parser": "syllabus-outline", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceId": "b6243518-b534-4193-bc5e-3165db5489ca", "sourceType": "syllabus", "effectiveModel": "qwen3-max", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "qwen"}	2026-05-02 15:17:53.325	2026-05-02 15:18:39.585
5bed199a-f21a-4f3c-8920-c1966e7fb3c1	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	simulationChat	simulation	qwen	qwen3-max	succeeded	v1	c642fce5d939c4398f006a08281a3f6e87a15710ac98a709814b5afc9f47c31c	1664	206	4624	\N	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "qwen3-max", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "effectiveProvider": "qwen"}	2026-05-02 15:47:53.976	2026-05-02 15:47:58.6
67e35859-1fa2-46e4-81f9-90de0dc137cf	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	simulationGrading	evaluation	qwen	qwen3-max	succeeded	v1	67b6f6512a0abf25032ffef5406b76e1f3b76d53063850b6d02e5291c5e3586f	1948	1396	22925	\N	{"effectiveModel": "qwen3-max", "settingsSource": "actor", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "qwen"}	2026-05-02 15:48:07.733	2026-05-02 15:48:30.662
76c0b2b0-681d-4fa5-8e8a-6abf0359e430	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	a04debd6af52732ce8a152d8b4e1e6d6d7c764fc809dd582e5c3cbed856ca9b9	1581	176	15979	\N	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "effectiveProvider": "mimo"}	2026-05-02 16:51:53.36	2026-05-02 16:52:09.339
aaa605ba-ccc2-4b07-98fa-6abdb316f413	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	7f81da629b5f026c2819b1f8013d8054bc91c367bc20d4cf570832706c3c7231	1156	487	28889	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 01:21:22.83	2026-05-03 01:21:51.72
426c622d-fc11-486d-bf16-4bb4cfa9ed75	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	7f81da629b5f026c2819b1f8013d8054bc91c367bc20d4cf570832706c3c7231	1156	494	47637	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 01:34:31.671	2026-05-03 01:35:19.308
46aafe67-1c25-40c7-a86b-93af8f5ded20	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	279ccba400024be65c70a5025732f1b56ee24f22349eda54ee4476844810bf31	2908	2110	34726	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 04:59:22.151	2026-05-03 04:59:56.879
cef99e44-cee1-4b97-ad63-a4df60568962	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	e6f9052cb2b3678cf3c79588cd3e40712705abe6bdd4212f1e2bf9dae4c3e06d	3183	1546	51821	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 05:05:06.138	2026-05-03 05:05:57.961
bbe814b5-537c-4814-bdd0-2a421c900272	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	failed	v1	e6f9052cb2b3678cf3c79588cd3e40712705abe6bdd4212f1e2bf9dae4c3e06d	3183	\N	117174	Expected ',' or ']' after array element in JSON at position 917 (line 44 column 6)	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 05:05:41.192	2026-05-03 05:07:38.369
cfd5a4bd-c6b2-4664-b658-ea2dc79aa5e0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	failed	v1	eb3d4544346e5538b16f568b5ee62e37303d505b79d15e10ea899eaca5d4e927	3190	\N	88898	[\n  {\n    "expected": "array",\n    "code": "invalid_type",\n    "path": [\n      "focusGroups",\n      0,\n      "studentNames"\n    ],\n    "message": "Invalid input: expected array, received string"\n  },\n  {\n    "expected": "array",\n    "code": "invalid_type",\n    "path": [\n      "focusGroups",\n      1,\n      "studentNames"\n    ],\n    "message": "Invalid input: expected array, received string"\n  },\n  {\n    "expected": "array",\n    "code": "invalid_type",\n    "path": [\n      "focusGroups",\n      2,\n      "studentNames"\n    ],\n    "message": "Invalid input: expected array, received string"\n  }\n]	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 05:11:57.263	2026-05-03 05:13:26.161
b1e82786-43ac-4ae9-a7f8-f04286a58b36	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	eb3d4544346e5538b16f568b5ee62e37303d505b79d15e10ea899eaca5d4e927	3190	1685	45895	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 05:13:15.424	2026-05-03 05:14:01.32
175d30aa-eca5-4505-8585-f67c2e46a0ef	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	failed	v1	eb3d4544346e5538b16f568b5ee62e37303d505b79d15e10ea899eaca5d4e927	3190	\N	103740	[\n  {\n    "expected": "array",\n    "code": "invalid_type",\n    "path": [\n      "focusGroups",\n      0,\n      "studentNames"\n    ],\n    "message": "Invalid input: expected array, received string"\n  },\n  {\n    "expected": "array",\n    "code": "invalid_type",\n    "path": [\n      "focusGroups",\n      1,\n      "studentNames"\n    ],\n    "message": "Invalid input: expected array, received string"\n  }\n]	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 05:12:40.62	2026-05-03 05:14:24.363
146ca74c-7c77-4248-afeb-c7347714cc13	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	65dfac05eaa5540590ca6ff618c6503f0de926a43ed70e7a361f7960e4a576ec	2908	1768	43100	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 05:14:56.787	2026-05-03 05:15:39.887
cd97d530-6a61-4344-9d8a-f17aab03e695	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	65dfac05eaa5540590ca6ff618c6503f0de926a43ed70e7a361f7960e4a576ec	2908	1999	35001	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 05:42:30.835	2026-05-03 05:43:05.836
f7d2987f-90eb-4013-b757-939f063f2b60	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	0ba533634825ad740c430c74da6f26d1ae4523979f759f7a6b6ae2b8f3a35878	3882	848	25810	\N	{"source": "data_insight_advice", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "fingerprint": "bq30bd", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-03 07:08:39.447	2026-05-03 07:09:05.255
d408ed6c-e674-4f03-86ff-33ee0feaf06c	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	e0240197ce561887a2bcdb592f90483687e7842bfc135cf867b6bea32cb25d17	1002	1135	25876	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 22:13:24.057	2026-05-03 22:13:49.933
8a2f8b66-cb73-4fa0-9ba4-bdae8680f18f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	9f39bc3b6624147c1151c4d310414c156acad971b8bba48578b53af753e2df49	1002	1469	33167	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-03 22:13:23.829	2026-05-03 22:13:56.997
de3117b1-ac3c-4009-9ab0-6f0f5b2390fc	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6ff926e86e7e24021e2e9f114730a6b32ab96530663d384215542daca9a87f60	1094	420	45294	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-03 22:40:46.374	2026-05-03 22:41:31.669
82d6bb98-6b92-4f55-9ece-8256e79b51d6	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	130b4b22815b535f1416399a2e6e5e469265ec05b2be10109cf7f48ac40d4dfe	3178	1359	38055	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-03 22:41:31.749	2026-05-03 22:42:09.804
1a421a86-6261-47b1-bcf3-5e30e3a64400	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6ff926e86e7e24021e2e9f114730a6b32ab96530663d384215542daca9a87f60	1094	421	50596	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-04 06:05:51.932	2026-05-04 06:06:42.53
b3fbc626-ca1d-4acc-be77-e1a7a229722e	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6ff926e86e7e24021e2e9f114730a6b32ab96530663d384215542daca9a87f60	1094	461	114387	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-04 06:05:52.076	2026-05-04 06:07:46.455
7e617dce-41d6-4ec3-bed9-926c39e94c06	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	quizDraft	quizDraft	mimo	mimo-v2.5-pro	succeeded	v1	4d951f63798878eabdbe6fc447cc40adf971641eaeae35d1ccf885913ec785fb	575	3937	46564	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 00:50:31.815	2026-05-05 00:51:18.381
51717537-ecbc-4806-8b19-36bbfe4e55db	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6774a26bbf6ea84b19dc4b6b40d7be8c0f73cf1eee0d140fae5a6647b3b919a2	3219	1615	39323	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-04 06:07:46.483	2026-05-04 06:08:25.807
903bf4dc-98fc-4dde-ab7c-6a5873054a81	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	8c16f73c077bf7f9408e2a6d97f29f5939dd0b4256b1032279e1a0f4eb0c08c6	50	3	1835	\N	{"probe": "test-connection", "effectiveModel": "mimo-v2.5-pro", "requestedModel": null, "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo", "requestedProvider": "mimo"}	2026-05-13 12:17:14.056	2026-05-13 12:17:15.891
4e723a51-235c-4c78-9de2-3f7da4d7a03a	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	mimo	mimo-v2.5-pro	failed	v1	c55e90edff0c845beb764df3ecf7170cbf8008925511028bc46d618e4c794e7f	4005	\N	80842	[\n  {\n    "origin": "array",\n    "code": "too_small",\n    "minimum": 1,\n    "inclusive": true,\n    "path": [\n      "quiz",\n      "questions"\n    ],\n    "message": "Too small: expected array to have >=1 items"\n  },\n  {\n    "origin": "array",\n    "code": "too_small",\n    "minimum": 1,\n    "inclusive": true,\n    "path": [\n      "subjective",\n      "scoringCriteria"\n    ],\n    "message": "Too small: expected array to have >=1 items"\n  }\n]	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-04 07:41:10.493	2026-05-04 07:42:31.336
1f29d9d9-ab35-43fc-9eee-cda4fe708f9c	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	mimo	mimo-v2.5-pro	failed	v1	3af65dc69bfc8f65eee316adfc4dd04b2447b2444b55230a36893dbecaa0d236	3996	\N	91892	[\n  {\n    "origin": "array",\n    "code": "too_small",\n    "minimum": 1,\n    "inclusive": true,\n    "path": [\n      "subjective",\n      "scoringCriteria"\n    ],\n    "message": "Too small: expected array to have >=1 items"\n  },\n  {\n    "origin": "array",\n    "code": "too_small",\n    "minimum": 1,\n    "inclusive": true,\n    "path": [\n      "simulation",\n      "scoringCriteria"\n    ],\n    "message": "Too small: expected array to have >=1 items"\n  }\n]	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 01:13:11.545	2026-05-05 01:14:43.437
11cdf8f5-7865-497b-adb6-979e07ea4c64	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6ff926e86e7e24021e2e9f114730a6b32ab96530663d384215542daca9a87f60	1094	427	45188	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-04 07:46:29.896	2026-05-04 07:47:15.085
dfc54e09-1908-4f3e-b351-08069dde67fa	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6ff926e86e7e24021e2e9f114730a6b32ab96530663d384215542daca9a87f60	1094	429	39829	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-04 07:51:26.383	2026-05-04 07:52:06.212
ca40c68a-8885-49fb-9a00-e8e4ad696fd8	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	failed	v1	2d75a85ab4f1e9c0953c9c9a39ebdeca1da070e3190264a956e648c0e742c00f	3582	\N	161167	Unexpected end of JSON input	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 01:16:31.016	2026-05-05 01:19:12.184
18e34eab-1cbc-4c2a-9740-823b45c3c81b	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	e0240197ce561887a2bcdb592f90483687e7842bfc135cf867b6bea32cb25d17	1002	1388	28203	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-05 03:01:39.503	2026-05-05 03:02:07.705
15c7139d-a832-48b7-b30a-ac7648fa1fc3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	9f39bc3b6624147c1151c4d310414c156acad971b8bba48578b53af753e2df49	1002	1985	35569	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-05 03:01:39.321	2026-05-05 03:02:14.889
cc8ee33a-48f7-4e89-8357-5cbf1dfc2433	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	importParse	importParse	mimo	mimo-v2.5-pro	failed	v1	400ca02ba345dddfaa7b71c1c27910d4d818dd446a02f864f86470d37c1fbe48	3702	\N	110351	Unexpected end of JSON input	{"tool": "questionBank", "action": "import", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceCount": 1, "questionCount": 1, "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 03:46:44.36	2026-05-05 03:48:34.713
735fdceb-c3a0-4604-92c6-80bec428483e	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	importParse	importParse	mimo	mimo-v2.5-pro	failed	v1	400ca02ba345dddfaa7b71c1c27910d4d818dd446a02f864f86470d37c1fbe48	3702	\N	103374	Unexpected end of JSON input	{"tool": "questionBank", "action": "import", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceCount": 1, "questionCount": 1, "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 03:47:15.399	2026-05-05 03:48:58.775
7e0903d9-b1e7-4abc-b8b5-3b84c318618c	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	importParse	importParse	mimo	mimo-v2.5-pro	failed	v1	400ca02ba345dddfaa7b71c1c27910d4d818dd446a02f864f86470d37c1fbe48	3702	\N	113659	Unexpected end of JSON input	{"tool": "questionBank", "action": "import", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceCount": 1, "questionCount": 1, "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 03:49:05.174	2026-05-05 03:50:58.833
a124d1d2-5215-484b-9054-4dc0a5b1282c	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6ff926e86e7e24021e2e9f114730a6b32ab96530663d384215542daca9a87f60	1094	438	44710	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 07:04:31.326	2026-05-05 07:05:16.037
2bf18913-b33e-4e81-815a-a1594dbd354e	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6ff926e86e7e24021e2e9f114730a6b32ab96530663d384215542daca9a87f60	1094	431	50281	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 07:04:31.474	2026-05-05 07:05:21.752
61dcef78-619e-4d57-9c6d-bb4cb4590630	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6ff926e86e7e24021e2e9f114730a6b32ab96530663d384215542daca9a87f60	1094	432	40008	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 07:04:31.736	2026-05-05 07:05:11.747
e758682d-af07-4e91-b4b5-1f79038a2394	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6ff926e86e7e24021e2e9f114730a6b32ab96530663d384215542daca9a87f60	1094	423	48360	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 07:04:31.641	2026-05-05 07:05:20.003
b471b92e-cb0b-4c44-87f3-1c29d11dc7a4	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	32fbdf6d4a0cf8e8940e3ffcb61018c69f290b0162928963136e620e5f5ec48b	3190	1420	46432	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 07:05:11.83	2026-05-05 07:05:58.262
47b10d07-5269-444d-959b-1adebfe2504e	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	65add58563dc9f46f89193814cfd4708a10fde9728156f9606efd46cc6f75672	3189	1766	97532	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 07:05:21.777	2026-05-05 07:06:59.31
c442856a-f1ec-44d5-915a-6f7d224afb24	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	failed	v1	2d75a85ab4f1e9c0953c9c9a39ebdeca1da070e3190264a956e648c0e742c00f	3582	\N	175195	Expected ',' or ']' after array element in JSON at position 1532 (line 66 column 6)	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 07:05:27.254	2026-05-05 07:08:22.452
1016a372-125b-4dd3-a504-a3d751d0dd90	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	importParse	importParse	mimo	mimo-v2.5-pro	failed	v1	400ca02ba345dddfaa7b71c1c27910d4d818dd446a02f864f86470d37c1fbe48	3702	\N	114862	Unexpected end of JSON input	{"tool": "questionBank", "action": "import", "draftId": "f46ad4bd-d4cd-4300-9be6-c573e750cda5", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceCount": 1, "questionCount": 1, "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 07:12:13.893	2026-05-05 07:14:08.768
82894d8a-3d43-4b50-9785-d8e6b29750ce	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	failed	v1	2d75a85ab4f1e9c0953c9c9a39ebdeca1da070e3190264a956e648c0e742c00f	3582	\N	178731	Expected ',' or ']' after array element in JSON at position 1013 (line 46 column 6)	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 07:11:20.49	2026-05-05 07:14:19.224
d746de0b-1ca1-41de-bfd4-65340002701a	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	importParse	importParse	mimo	mimo-v2.5-pro	failed	v1	400ca02ba345dddfaa7b71c1c27910d4d818dd446a02f864f86470d37c1fbe48	3702	\N	119109	Unexpected end of JSON input	{"tool": "questionBank", "action": "import", "draftId": "f46ad4bd-d4cd-4300-9be6-c573e750cda5", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceCount": 1, "questionCount": 1, "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 07:15:44.388	2026-05-05 07:17:43.5
6de88579-a06b-4db9-ad93-7217f24ea669	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	failed	v1	2d75a85ab4f1e9c0953c9c9a39ebdeca1da070e3190264a956e648c0e742c00f	3582	\N	188879	Unexpected end of JSON input	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 08:21:34.617	2026-05-05 08:24:43.489
f430bee4-4f9d-4046-bea4-8aa3892bb2f8	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	d8da19a0cb690104c9e2a328a8de400d731863aae8bf1e462fb1363f8be4b75a	5427	508	48361	\N	{"courseId": "8f7f653c-9177-44f6-b764-80f7f779b2ef", "sourceId": "778e76c6-0695-44f5-a11e-eb5cd38c695a", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 09:02:54.514	2026-05-05 09:03:42.876
bce57809-3100-4af0-82eb-80d734d601ca	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	mimo	mimo-v2.5-pro	failed	v1	8ede2e10105f5abc259887e59e099b5560af9cee2aa570c2b13a7fa622c2d37b	6366	\N	130549	Expected ',' or ']' after array element in JSON at position 9845 (line 355 column 6)	{"parser": "syllabus-outline", "courseId": "8f7f653c-9177-44f6-b764-80f7f779b2ef", "sourceId": "778e76c6-0695-44f5-a11e-eb5cd38c695a", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 09:03:42.891	2026-05-05 09:05:53.442
3f6e24bb-a79e-4e3e-9e4e-71bee7c5ed66	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	failed	v1	2d75a85ab4f1e9c0953c9c9a39ebdeca1da070e3190264a956e648c0e742c00f	3582	\N	186462	Unexpected end of JSON input	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 09:08:51.885	2026-05-05 09:11:58.346
2cfcf8d9-a135-4766-9a9a-00885e329edd	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	importParse	importParse	mimo	mimo-v2.5-pro	failed	v1	400ca02ba345dddfaa7b71c1c27910d4d818dd446a02f864f86470d37c1fbe48	3702	\N	119178	Unexpected end of JSON input	{"tool": "questionBank", "action": "import", "draftId": "f46ad4bd-d4cd-4300-9be6-c573e750cda5", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceCount": 1, "questionCount": 1, "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 09:12:01.295	2026-05-05 09:14:00.473
2e6aa31a-9757-45a6-bb95-84f1967c0af0	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	importParse	importParse	mimo	mimo-v2.5-pro	failed	v1	400ca02ba345dddfaa7b71c1c27910d4d818dd446a02f864f86470d37c1fbe48	3702	\N	221599	Expected ',' or ']' after array element in JSON at position 10989 (line 274 column 6)	{"tool": "questionBank", "action": "import", "draftId": "f46ad4bd-d4cd-4300-9be6-c573e750cda5", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceCount": 1, "questionCount": 1, "regexPreCount": 1, "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 09:47:52.86	2026-05-05 09:51:34.456
fc1c4111-e944-416b-988b-4e548e30f229	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	172	17943	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 10:56:08.926	2026-05-13 10:56:26.868
1e955b6d-690a-4977-8265-a84ac59a0937	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	169	24059	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 10:56:26.902	2026-05-13 10:56:50.962
4a0ee721-02c3-4d80-a246-ca1719865a04	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	importParse	importParse	mimo	mimo-v2.5-pro	failed	v1	400ca02ba345dddfaa7b71c1c27910d4d818dd446a02f864f86470d37c1fbe48	3702	\N	216463	Expected ',' or ']' after array element in JSON at position 14682 (line 550 column 6)	{"tool": "questionBank", "action": "import", "draftId": "e96eda2b-3de5-441d-a3eb-a775489701d1", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceCount": 1, "questionCount": 1, "regexPreCount": 1, "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 10:23:28.635	2026-05-05 10:27:05.098
e1d40acb-bc0a-420f-8866-3c7317832f94	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	questionAnalysis	questionAnalysis	mimo	mimo-v2.5-pro	succeeded	v1	d64d82c70c8aa483e0bbffac0f999e04da686663a0dcd66ae9dd2992dd772bce	4020	850	68117	\N	{"tool": "questionBank", "action": "checkOptimize", "draftId": "e96eda2b-3de5-441d-a3eb-a775489701d1", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceCount": 1, "questionCount": 1, "regexPreCount": 0, "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 10:27:21.42	2026-05-05 10:28:29.536
a13b6c87-0a38-4a66-b27f-d9c9dd68ad2e	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	0bd7abb871fb9c0eba5fb87c31b2f296d41ca1e61d76aedf787ad80b522af647	4004	4855	221042	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 10:29:14.638	2026-05-05 10:32:55.68
9380f71f-bc1f-4918-8722-c79e5ae8c172	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	succeeded	v1	2d75a85ab4f1e9c0953c9c9a39ebdeca1da070e3190264a956e648c0e742c00f	3582	2369	80739	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 10:31:57.665	2026-05-05 10:33:18.406
bca20b34-56f6-4985-8bd7-21daa22e8954	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	succeeded	v1	0569ec085e8b0c357d4ad52e38d0c46fb1d7b9bb1a6090d4986c4e0ea97aa5ca	4167	2707	98653	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-05 10:53:27.938	2026-05-05 10:55:06.591
1f46e58e-5e07-4389-ae48-1d4723df4de8	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	ea0e9dbec142d0505102353204005d16358f589cadf5beea436cecde1acf454b	2590	289	21669	\N	{"courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "sourceId": "53089e0e-a96a-45b3-8df0-2be28a8bfbff", "sourceType": null, "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-05 12:24:13.554	2026-05-05 12:24:35.223
187c7a82-8ee7-425b-a506-e17be8f9f947	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	197d7b99aac6cd0736adb29fcf7a2d9d0b0a5d6f93b82188d78a5af37067c170	1183	173	32560	\N	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "mimo-v2.5-pro", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "e34afdc0-dc06-4072-aa5c-d1b945de0850", "effectiveProvider": "mimo"}	2026-05-07 01:35:03.188	2026-05-07 01:35:35.749
93a23ecb-4c6d-4739-a18b-5602cc09c606	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	f69dce327fa70eaf4348967aff245ec5f186777f5fc42373ac207f7ebc516557	1317	163	23012	\N	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "mimo-v2.5-pro", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "e34afdc0-dc06-4072-aa5c-d1b945de0850", "effectiveProvider": "mimo"}	2026-05-07 01:38:51.909	2026-05-07 01:39:14.922
78aa0837-dae0-4912-9e19-4cecae12e3ea	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationGrading	evaluation	mimo	mimo-v2.5	succeeded	v1	945c7da02023f4a6889f2fdbb08a43615045bf983d47eee26934aebd14aad3c4	1977	1355	23919	\N	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "submissionId": "a37cb4dc-2fce-4b18-9c04-381bb1d514cb", "effectiveModel": "mimo-v2.5", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "e34afdc0-dc06-4072-aa5c-d1b945de0850", "effectiveProvider": "mimo"}	2026-05-07 01:39:18.484	2026-05-07 01:39:42.403
d7bec417-8fd8-467d-b4af-d300fe17a29d	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	simulationChat	simulation	mimo	mimo-v2.5-pro	failed	v1	d64de1570b4131c45667803a41f3bdb005834c12c24b82806a7433580fcea1fa	1161	\N	727	[{'type': 'literal_error', 'loc': ('body', 'reasoning_effort'), 'msg': "Input should be 'low', 'medium' or 'high'", 'input': 'none', 'ctx': {'expected': "'low', 'medium' or 'high'"}}]	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "mimo-v2.5-pro", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "effectiveProvider": "mimo"}	2026-05-12 08:26:50.286	2026-05-12 08:26:51.012
2ab065d8-f761-45a4-96a5-f151b01672a9	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	simulationChat	simulation	mimo	mimo-v2.5-pro	failed	v1	3f95403964d4660040007d8dd7167e4ad66dbf4b59988e485bc1112d2e802a37	282	\N	167	[{'type': 'literal_error', 'loc': ('body', 'reasoning_effort'), 'msg': "Input should be 'low', 'medium' or 'high'", 'input': 'none', 'ctx': {'expected': "'low', 'medium' or 'high'"}}]	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "mimo-v2.5-pro", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "effectiveProvider": "mimo"}	2026-05-12 08:26:51.043	2026-05-12 08:26:51.209
c6af18e9-1d41-4972-9a8c-212c5fcd9079	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	51d5fff774fb163fd5eba16840f25e64acf156c58062f66ce469230a16a33bcb	1162	179	39908	\N	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "effectiveProvider": "mimo"}	2026-05-12 08:30:27.236	2026-05-12 08:31:07.144
eae5bbeb-40bc-4ff0-841e-3ba6a4228e1a	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	0c2d3e5f3528e38267490c14c8aaef9fd38a40669efd1f822412cb42d4fdd659	1323	186	20386	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 10:55:04.44	2026-05-13 10:55:24.826
71164585-a0fb-4af8-a8b4-fc37395f6daa	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	175	25932	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 10:55:42.846	2026-05-13 10:56:08.783
61169aba-bdaf-478a-a7da-2b08e7762164	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	db13087c636957ed4d0b0cd418649fac1c1dfb1d5d5666969fd45eb4530d0874	1356	142	2659	\N	{"streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 12:17:43.036	2026-05-13 12:17:45.694
9474ecc6-f6da-46bf-943e-1596c91df394	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	169	2993	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 23:46:15.318	2026-05-13 23:46:18.311
e0abd827-dc5e-4c4e-8647-85a3c54d1baa	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	90536a22bbe4fd2501c7297901bab7f4a52f732c540fde43dacf8e2a3580cebc	1137	1891	35941	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 10:57:18.298	2026-05-13 10:57:54.24
5526113e-cd42-4432-be0d-e5c7c2704f52	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	05d08a7d6adb403cec6136ad359941aff59f328d6026370cfad968ed1bcda9ed	1137	2132	41852	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 10:57:18.044	2026-05-13 10:57:59.895
0d72da0a-6e01-4b7a-be03-6cdcaa44d9f9	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	46374d477fed9630e8be57b9dd921dea9b1b10e23550169a8c7cb53d160299ad	657	304	23920	\N	{"courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "ca723c9c-6552-4a6e-9218-a91d517d2b23", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:03:54.544	2026-05-13 11:04:18.463
8020a323-a5e5-4c64-ba2c-f83130ca7daf	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	186	2164	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 23:46:18.398	2026-05-13 23:46:20.561
d28fac9e-afca-44ff-971d-a387721a3a68	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	6e38eedd387910657dcbb760c3a0038de90543958663cec3157df3523c4873e1	1596	6944	53720	\N	{"parser": "syllabus-outline", "courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "ca723c9c-6552-4a6e-9218-a91d517d2b23", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:04:18.475	2026-05-13 11:05:12.195
4a11b890-6b64-40cf-a854-4ec0a589decd	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	adf55aa5ff4d15d7b368b5060f64226ffedc0e8259116b099d4af20e96c06590	1492	2024	41796	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:05:17.486	2026-05-13 11:05:59.297
c16b13b3-1801-4f0e-a089-39581104f593	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	169	2562	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 23:46:20.588	2026-05-13 23:46:23.151
3e7bb3af-751d-46fa-b8ad-808f4a75736e	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	f08188a075c0e29f66b94f5fa0cbeceedc2ea373be5bf561e41ef899af01143c	1503	1928	49949	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:05:59.496	2026-05-13 11:06:49.458
84f15f3d-48e8-46b9-a6d8-143be1b2e2d7	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	11fad824b2323c89219af0de5cb7b67530a4d32d998cc84535c370279b97925b	1492	1597	44929	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:06:49.653	2026-05-13 11:07:34.583
4bfcfea9-6f2c-4302-a0bc-940896eb7bdd	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	succeeded	v1	90311e9f6894af50dd8e67c65d7a2a0091fc665320fa7e13e039d40631fd369e	1974	1683	18235	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-14 06:30:37.407	2026-05-14 06:30:55.645
1ef7c839-f7d3-4979-b85b-e41c13460090	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	36a4204333658d4bf5c4db6385c3012dda95d005a1150e242ea189730458c210	645	213	25035	\N	{"courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "93bfece8-ebf3-4c49-8f8b-339f092b605b", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:07:37.563	2026-05-13 11:08:02.598
02b39627-673d-4680-b853-fa9dc260e4f0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	daca661af764314c2b37e9aa11c48750c81776f43a75ba310c1416486cc2b7b1	1584	4657	46364	\N	{"parser": "syllabus-outline", "courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "93bfece8-ebf3-4c49-8f8b-339f092b605b", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:08:02.611	2026-05-13 11:08:48.975
becea0c8-c36f-4d04-bb9e-4d0a4f36da4f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	ab9d30ec0aafd9f4b4fdb35ec6e8c356079d7960c68f243f8616639c5a375d14	560	222	24331	\N	{"courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "cd2e2dfc-ac9d-481d-b411-85e616a0ee67", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:08:43.829	2026-05-13 11:09:08.16
4748486a-0e3d-49ac-8f46-8c942a166085	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	42c91ca310d9b86adee043ba00c31020d93676dfb99ae89ad96805ecd114b64b	1499	6388	63137	\N	{"parser": "syllabus-outline", "courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "cd2e2dfc-ac9d-481d-b411-85e616a0ee67", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:09:08.182	2026-05-13 11:10:11.319
2aaabfe2-319b-4ca8-87d8-5d834b411b2e	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	46374d477fed9630e8be57b9dd921dea9b1b10e23550169a8c7cb53d160299ad	657	374	29006	\N	{"courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "b97c541b-bad3-4320-8233-3e714c838c11", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:10:03.594	2026-05-13 11:10:32.598
eb982869-25c4-46e1-82ba-a0eca795a247	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	qwen	qwen-plus	succeeded	v1	b3d6a1b3398b297027c2858d03bf391e44db41e60a1fc9ce06f59ea299c451ca	1335	157	2233	\N	{"streaming": true, "effectiveModel": "qwen-plus", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "00000000-0000-4000-8000-00000000a602", "effectiveProvider": "qwen"}	2026-05-13 12:18:27.658	2026-05-13 12:18:29.892
0fd05df8-4972-475e-954b-c5bc4b334ac0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	6e38eedd387910657dcbb760c3a0038de90543958663cec3157df3523c4873e1	1596	5502	56654	\N	{"parser": "syllabus-outline", "courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "b97c541b-bad3-4320-8233-3e714c838c11", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:10:32.608	2026-05-13 11:11:29.262
95244327-c8b5-4e87-9da3-d7b9383bb6b2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	36a4204333658d4bf5c4db6385c3012dda95d005a1150e242ea189730458c210	645	277	23848	\N	{"courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "89e8163c-cb97-4831-9600-cdd799c3a899", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:11:23.971	2026-05-13 11:11:47.819
b1e7db9f-b6bc-4278-ad0f-daf125f1b7de	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	daca661af764314c2b37e9aa11c48750c81776f43a75ba310c1416486cc2b7b1	1584	4577	37292	\N	{"parser": "syllabus-outline", "courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "89e8163c-cb97-4831-9600-cdd799c3a899", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:11:47.826	2026-05-13 11:12:25.119
4eb67b00-8104-4654-abd3-e3fb8ee9eb80	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	ab9d30ec0aafd9f4b4fdb35ec6e8c356079d7960c68f243f8616639c5a375d14	560	225	23558	\N	{"courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "01381fbf-7607-4765-b4fb-96e068b9d25f", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:12:28.926	2026-05-13 11:12:52.485
9fe61dc3-312e-46fb-9cd8-7720da4ccca1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	42c91ca310d9b86adee043ba00c31020d93676dfb99ae89ad96805ecd114b64b	1499	4418	52889	\N	{"parser": "syllabus-outline", "courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "01381fbf-7607-4765-b4fb-96e068b9d25f", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:12:52.495	2026-05-13 11:13:45.386
7e3bf5b6-09fc-41a9-a269-4d0631926fcb	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	46374d477fed9630e8be57b9dd921dea9b1b10e23550169a8c7cb53d160299ad	657	300	28499	\N	{"courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "b015b457-c2d4-46f5-8680-9d05fb7bc4c6", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:13:45.735	2026-05-13 11:14:14.234
767ee5e9-3897-43e4-bc2a-bb53551d09f2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	6e38eedd387910657dcbb760c3a0038de90543958663cec3157df3523c4873e1	1596	4546	62810	\N	{"parser": "syllabus-outline", "courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "b015b457-c2d4-46f5-8680-9d05fb7bc4c6", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:14:14.252	2026-05-13 11:15:17.062
ea44aea9-a7e4-4400-af15-68538da5d36b	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	ab9d30ec0aafd9f4b4fdb35ec6e8c356079d7960c68f243f8616639c5a375d14	560	224	24159	\N	{"courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "8994ad53-bb0d-44e5-997e-2b8b672ca5ce", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:16:11.72	2026-05-13 11:16:35.879
4e69fc04-471a-4939-bd03-a0dd8944f34a	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	42c91ca310d9b86adee043ba00c31020d93676dfb99ae89ad96805ecd114b64b	1499	7146	70793	\N	{"parser": "syllabus-outline", "courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "8994ad53-bb0d-44e5-997e-2b8b672ca5ce", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:16:35.891	2026-05-13 11:17:46.684
8c5903b6-784b-4a1a-803a-2139a26f1725	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	ab9d30ec0aafd9f4b4fdb35ec6e8c356079d7960c68f243f8616639c5a375d14	560	232	24597	\N	{"courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "331a8af8-3df6-4d28-9994-1b2117bb33cd", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:17:23.448	2026-05-13 11:17:48.044
ae9a1f05-7172-4391-b5b6-9382e2351acd	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	42c91ca310d9b86adee043ba00c31020d93676dfb99ae89ad96805ecd114b64b	1499	7249	76753	\N	{"parser": "syllabus-outline", "courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "331a8af8-3df6-4d28-9994-1b2117bb33cd", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:17:48.05	2026-05-13 11:19:04.803
773bd1de-e32d-4182-bc51-f88a32600fbb	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	ab9d30ec0aafd9f4b4fdb35ec6e8c356079d7960c68f243f8616639c5a375d14	560	226	24106	\N	{"courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "133b5b10-4ea7-4a5d-9633-9bb2a89b0121", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:18:55.977	2026-05-13 11:19:20.082
2fef495a-4654-43d6-aba0-9db1872906e0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	42c91ca310d9b86adee043ba00c31020d93676dfb99ae89ad96805ecd114b64b	1499	6192	72755	\N	{"parser": "syllabus-outline", "courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "133b5b10-4ea7-4a5d-9633-9bb2a89b0121", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:19:20.091	2026-05-13 11:20:32.847
56aa4b33-52a9-41c7-92a9-2d076cd6a2aa	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	46374d477fed9630e8be57b9dd921dea9b1b10e23550169a8c7cb53d160299ad	657	249	27581	\N	{"courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "df54c46d-c333-4561-ac8f-69e91b7cf3db", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:20:52.587	2026-05-13 11:21:20.167
ca85b728-9b0e-471e-b3da-1f6fad4b5b1e	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	178	19544	\N	{"streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 12:11:02.619	2026-05-13 12:11:22.164
eac0898b-fb13-433b-8113-7f4730f15e18	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	6e38eedd387910657dcbb760c3a0038de90543958663cec3157df3523c4873e1	1596	6000	65809	\N	{"parser": "syllabus-outline", "courseId": "00000000-0000-4000-8000-00000000a202", "sourceId": "df54c46d-c333-4561-ac8f-69e91b7cf3db", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-13 11:21:20.179	2026-05-13 11:22:25.99
895a1ed6-fad0-4931-ad54-46c2c667f462	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	failed	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	\N	477	Unexpected end of JSON input	{"streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 11:59:36.05	2026-05-13 11:59:36.527
c1e5c335-6933-45dc-9a0b-9557ac1c3be8	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	171	3404	\N	{"streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 12:21:04.709	2026-05-13 12:21:08.115
864d7db8-91f3-43ba-9752-66e54c6ff176	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	failed	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	\N	301	Unexpected end of JSON input	{"streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 11:59:36.555	2026-05-13 11:59:36.856
55d11523-544e-4765-b801-238602d79fad	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	failed	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	\N	163	Unexpected end of JSON input	{"streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 11:59:36.872	2026-05-13 11:59:37.035
c9f0690e-34d5-4388-bc08-70d7ce9c149f	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	163	3012	\N	{"streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 12:21:08.181	2026-05-13 12:21:11.195
ac2e6581-4d4f-4ccf-a69d-8dd510df8e3b	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	failed	v1	97c76ab4a8f087f939ba6f304124aeb4136001becde40eb118c512bbc0824863	1412	\N	253	Unexpected end of JSON input	{"streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 11:59:58.766	2026-05-13 11:59:59.019
42766df5-9274-4898-92c9-65ee254d4759	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	failed	v1	75d09a3c915cd3a6c695c490608c2d8c6ed9ac20b8e8e3d17461b453b5633fe8	1376	\N	536	[{'type': 'literal_error', 'loc': ('body', 'reasoning_effort'), 'msg': "Input should be 'low', 'medium' or 'high'", 'input': 'none', 'ctx': {'expected': "'low', 'medium' or 'high'"}}]	{"effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 12:00:28.672	2026-05-13 12:00:29.208
e393d064-12bf-47aa-b7aa-1d1c2c60b7c7	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	155	2144	\N	{"streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 12:21:11.261	2026-05-13 12:21:13.405
20450af2-4baf-4d2f-ab44-76a6f68f40f7	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	failed	v1	8299d2ce5f45912155fa24191da95d3035390623e394c544118636bd8474294f	592	\N	165	[{'type': 'literal_error', 'loc': ('body', 'reasoning_effort'), 'msg': "Input should be 'low', 'medium' or 'high'", 'input': 'none', 'ctx': {'expected': "'low', 'medium' or 'high'"}}]	{"effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 12:00:29.224	2026-05-13 12:00:29.388
93302d5e-a276-4c74-9457-d55684d6c3a1	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	178	22748	\N	{"streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 12:10:23.542	2026-05-13 12:10:46.3
9ffcad5d-ffd8-4195-9c94-5d6d8343d16b	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	d8da19a0cb690104c9e2a328a8de400d731863aae8bf1e462fb1363f8be4b75a	5427	529	8054	\N	{"courseId": "8f7f653c-9177-44f6-b764-80f7f779b2ef", "sourceId": "778e76c6-0695-44f5-a11e-eb5cd38c695a", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-14 00:10:22.848	2026-05-14 00:10:30.905
b37b3e82-cac4-46a9-8c00-1bf113189a36	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	2fd2b4b2154fad04c48d44eba2ca3052875e6f2f33db98243730ae4236052cb5	1380	164	16204	\N	{"streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "effectiveProvider": "mimo"}	2026-05-13 12:10:46.368	2026-05-13 12:11:02.575
593c929a-5f4e-45f9-b67a-38054c4fba52	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	succeeded	v1	90311e9f6894af50dd8e67c65d7a2a0091fc665320fa7e13e039d40631fd369e	1974	1875	20236	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-14 06:30:07.37	2026-05-14 06:30:27.606
f79266e8-349e-4ccc-8006-c6afdcd578a7	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	succeeded	v1	90311e9f6894af50dd8e67c65d7a2a0091fc665320fa7e13e039d40631fd369e	1974	1909	18937	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-14 06:31:46.199	2026-05-14 06:32:05.138
d21fdf1e-094e-4add-894a-a8dacce3705a	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	8ede2e10105f5abc259887e59e099b5560af9cee2aa570c2b13a7fa622c2d37b	6366	14216	79340	\N	{"parser": "syllabus-outline", "courseId": "8f7f653c-9177-44f6-b764-80f7f779b2ef", "sourceId": "778e76c6-0695-44f5-a11e-eb5cd38c695a", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-14 00:10:30.927	2026-05-14 00:11:50.266
6b71986d-957e-414a-8e5e-c31f2777e13d	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	d8da19a0cb690104c9e2a328a8de400d731863aae8bf1e462fb1363f8be4b75a	5427	499	6466	\N	{"courseId": "8f7f653c-9177-44f6-b764-80f7f779b2ef", "sourceId": "778e76c6-0695-44f5-a11e-eb5cd38c695a", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-14 00:13:16.076	2026-05-14 00:13:22.543
ece45f41-aced-4f67-8290-769db27bc1b2	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	8ede2e10105f5abc259887e59e099b5560af9cee2aa570c2b13a7fa622c2d37b	6366	13120	83175	\N	{"parser": "syllabus-outline", "courseId": "8f7f653c-9177-44f6-b764-80f7f779b2ef", "sourceId": "778e76c6-0695-44f5-a11e-eb5cd38c695a", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-14 00:13:22.551	2026-05-14 00:14:45.741
e127988a-01a4-4351-ba4f-80e86fc085b4	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	d8da19a0cb690104c9e2a328a8de400d731863aae8bf1e462fb1363f8be4b75a	5427	488	6678	\N	{"courseId": "8f7f653c-9177-44f6-b764-80f7f779b2ef", "sourceId": "778e76c6-0695-44f5-a11e-eb5cd38c695a", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-14 00:19:49.161	2026-05-14 00:19:55.839
aaa4307b-3374-4a3e-aa04-8e10096a528e	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	taskDraft	taskDraft	mimo	mimo-v2.5-pro	succeeded	v1	8ede2e10105f5abc259887e59e099b5560af9cee2aa570c2b13a7fa622c2d37b	6366	13220	91215	\N	{"parser": "syllabus-outline", "courseId": "8f7f653c-9177-44f6-b764-80f7f779b2ef", "sourceId": "778e76c6-0695-44f5-a11e-eb5cd38c695a", "sourceType": "syllabus", "effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-14 00:19:55.851	2026-05-14 00:21:27.065
c15c40eb-0541-4414-8ca2-562c51ef3735	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	c608553670c086233c361fd52f0ee7188f241da60ae4fe89a3208a61196765c8	1506	172	4190	\N	{"taskId": "5e69a393-3175-4cef-a92a-c44612593f4d", "streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "effectiveProvider": "mimo"}	2026-05-14 06:31:04.307	2026-05-14 06:31:08.497
7c93fccb-ff9d-4fac-93e8-4a94ee7326cc	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	3d38f9b47a0d5afbc9d244e0c8a75ee9f292b5541b5f2ef0a7952aadd79e8143	1604	213	5706	\N	{"taskId": "5e69a393-3175-4cef-a92a-c44612593f4d", "streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "effectiveProvider": "mimo"}	2026-05-14 06:31:09.831	2026-05-14 06:31:15.537
a8620c8a-e421-4b0c-ae8e-6b8dc0b17b3d	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	355dff53a482f86cc9b78afdd4b5fd2fc385da33a941c44d01e9c2ea2066e7db	1732	202	3755	\N	{"taskId": "5e69a393-3175-4cef-a92a-c44612593f4d", "streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "effectiveProvider": "mimo"}	2026-05-14 06:31:15.745	2026-05-14 06:31:19.499
49efbc20-4bc0-4a86-9faf-acdd20384137	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	studyBuddy	studyBuddyReply	mimo	mimo-v2.5	succeeded	v1	9949cf66e8370673e84c3a145096c2552118c3fb5466a3912418623ec5b1536c	647	41	1166	\N	{"taskId": "5e69a393-3175-4cef-a92a-c44612593f4d", "effectiveModel": "mimo-v2.5", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "effectiveProvider": "mimo"}	2026-05-14 06:31:19.51	2026-05-14 06:31:20.676
37ddec69-84f6-4ba1-820a-96d4939f792b	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	succeeded	v1	90311e9f6894af50dd8e67c65d7a2a0091fc665320fa7e13e039d40631fd369e	1974	1693	15498	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-14 06:32:05.291	2026-05-14 06:32:20.789
7292277b-56a0-40f1-b06d-5334da15ed11	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	succeeded	v1	90311e9f6894af50dd8e67c65d7a2a0091fc665320fa7e13e039d40631fd369e	1974	1938	15512	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-14 06:32:20.9	2026-05-14 06:32:36.421
7d735249-fc56-4d3d-9ba3-bfe544ff199f	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	de1362316f59f832d743e9fb2c7f0eb987e8f5d62323d456fc57f5a988a56bb3	1512	169	3591	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "effectiveProvider": "mimo"}	2026-05-14 06:33:17.886	2026-05-14 06:33:21.477
30750a55-2eed-4084-a85a-0e60435113fb	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	eeeace097f9cb1e4d1d90889e33f2943a6c9aa5edfd5389d9eec52187866bc67	1604	164	9818	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "effectiveProvider": "mimo"}	2026-05-14 06:33:21.614	2026-05-14 06:33:31.432
91dacf12-10b9-4a89-b7b0-cc96a31f73cf	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	c384f50699f95eeb366d754450aee97621848a209ee1e069d697642ec433f6c9	1489	173	3664	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "effectiveProvider": "mimo"}	2026-05-14 06:33:31.489	2026-05-14 06:33:35.155
346bb6e1-58be-4947-8be2-72d1b4c1daf3	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	faafd4a576ce02ea0398fbdf520bb0b2f45ef97df6277108a37616ccf150b4c6	1497	164	5539	\N	{"taskId": "5e69a393-3175-4cef-a92a-c44612593f4d", "streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "teacher", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "effectiveProvider": "mimo"}	2026-05-14 06:33:45.179	2026-05-14 06:33:50.718
c4188e21-b716-403b-838e-49b8a001f59d	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	studyBuddy	studyBuddyReply	mimo	mimo-v2.5	succeeded	v1	5f3443020ababf379cb85d350535cba7ddd28021c6fcd6f5b086ffb1dcd96006	355	398	5184	\N	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "preview": false, "effectiveModel": "mimo-v2.5", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "studyBuddyPostId": "e9abeba0-adb4-4543-9c4f-42a4fd68ad0c", "effectiveProvider": "mimo"}	2026-05-14 06:33:48.552	2026-05-14 06:33:53.737
15861ad9-e7dc-40ce-bb11-e68c8e5215b0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	05d08a7d6adb403cec6136ad359941aff59f328d6026370cfad968ed1bcda9ed	1137	2172	16947	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-14 06:33:48.231	2026-05-14 06:34:05.178
b883193e-4417-4680-b6bb-8c74b04eba71	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	succeeded	v1	90311e9f6894af50dd8e67c65d7a2a0091fc665320fa7e13e039d40631fd369e	1974	1695	18815	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-14 06:34:05.562	2026-05-14 06:34:24.378
7ad9fae4-3300-4e54-aa52-089bc589333b	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	studyBuddy	studyBuddyReply	mimo	mimo-v2.5	succeeded	v1	cd72a25366a062e4b7661fd55f3ebf87ad4b88d7a542e9e915ec2be17ef06164	355	278	4625	\N	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "preview": false, "effectiveModel": "mimo-v2.5", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "studyBuddyPostId": "7567f13e-9c93-47e9-9983-d9a96c5f76a2", "effectiveProvider": "mimo"}	2026-05-14 06:34:22.513	2026-05-14 06:34:27.138
68f035df-d558-43b4-bab1-5a51a3c0a4e0	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	studyBuddy	studyBuddyReply	mimo	mimo-v2.5	succeeded	v1	3f41286b854497e24349c7a367be5d98b16fa8203688d5a5b68472335b110c06	339	337	4021	\N	{"taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "preview": false, "effectiveModel": "mimo-v2.5", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "2e700d5e-fa7e-4f13-b000-03f660414b89", "studyBuddyPostId": "da17db15-a2f0-4bc7-a830-f09dd60eca04", "effectiveProvider": "mimo"}	2026-05-14 06:34:58.861	2026-05-14 06:35:02.881
0dbdf717-7b1d-4e49-a299-b257588a863f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	d0380d6238fd24b46a2e0a56dbab7618f3e1af9f00eadb36f779a43e508aa0b5	1543	159	5432	\N	{"taskId": "5e69a393-3175-4cef-a92a-c44612593f4d", "streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "effectiveProvider": "mimo"}	2026-05-14 06:35:38.047	2026-05-14 06:35:43.478
2652050d-662f-443f-b3fd-52919a4b61d1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	simulation	mimo	mimo-v2.5-pro	succeeded	v1	bc8e3546b4edd9633b5f6fa6d3e63e4dbbbfd90f871fdf95e2032bd8ac08fd52	1670	172	3253	\N	{"taskId": "5e69a393-3175-4cef-a92a-c44612593f4d", "streaming": true, "effectiveModel": "mimo-v2.5-pro", "settingsSource": "actor", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "effectiveProvider": "mimo"}	2026-05-14 06:35:43.572	2026-05-14 06:35:46.824
381bbfa3-5940-4dbe-92f0-7f8e31c38a14	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationGrading	evaluation	mimo	mimo-v2.5	succeeded	v1	769f898fe04b3232f83aefe8c7ea04a95b8d9ba01e46e39150dae91c22fc75d9	1640	1147	7589	\N	{"effectiveModel": "mimo-v2.5", "settingsSource": "actor", "settingsUserId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "effectiveProvider": "mimo"}	2026-05-14 06:35:50.322	2026-05-14 06:35:57.913
58615ada-0264-42c7-9f09-aad8e0faa860	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6ff926e86e7e24021e2e9f114730a6b32ab96530663d384215542daca9a87f60	1094	525	8544	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-14 07:22:33.381	2026-05-14 07:22:41.935
3650b938-23b0-4a62-9205-b246aaec66c4	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6ff926e86e7e24021e2e9f114730a6b32ab96530663d384215542daca9a87f60	1094	530	8776	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-14 07:22:33.606	2026-05-14 07:22:42.381
c6ee48fe-11e1-4e29-b572-673bcc33080c	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6ff926e86e7e24021e2e9f114730a6b32ab96530663d384215542daca9a87f60	1094	522	9525	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-14 07:22:33.321	2026-05-14 07:22:42.844
465cebf3-97fd-43b6-8fbb-21de7f1f5c5c	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	6ff926e86e7e24021e2e9f114730a6b32ab96530663d384215542daca9a87f60	1094	537	9710	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-14 07:22:33.693	2026-05-14 07:22:43.41
840c433c-3b9f-4bfc-a44a-7f686ee845f6	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	d4c05c13e3ab2d116fdc512209c7bc9c0f732e736bf87fcb74241516029df567	3326	2507	27146	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-14 07:22:41.99	2026-05-14 07:23:09.138
2c433442-3806-4cce-88df-45b2fa4abe84	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	insights	insights	mimo	mimo-v2.5-pro	succeeded	v1	710e20659eb57734abbe5253acfbaa2148dcd247597e3153fda3d2c5ea16e8d4	3338	2403	47743	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-14 07:22:43.447	2026-05-14 07:23:31.19
18b28020-d30d-4ce8-986f-6d001b8cefe5	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	weeklyInsight	weeklyInsight	mimo	mimo-v2.5-pro	succeeded	v1	846eb4219c022291e833915fd898f2b40e47b42702eaefb90f5cefcd50456398	1756	1449	20564	\N	{"effectiveModel": "mimo-v2.5-pro", "settingsUserId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "effectiveProvider": "mimo"}	2026-05-14 07:25:22.691	2026-05-14 07:25:43.255
\.


--
-- Data for Name: AiToolSetting; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AiToolSetting" (id, "teacherId", "toolKey", model, thinking, temperature, "systemPromptSuffix", "enableSearch", strictness, "outputStyle", "createdAt", "updatedAt", provider) FROM stdin;
ab62c19c-024b-4355-b2c3-10512fac6d19	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationGrading	mimo-v2.5	disabled	\N	\N	f	\N	\N	2026-05-02 14:33:21.685	2026-05-02 16:22:06.497	mimo
24d57a72-4f53-4a5e-a229-1f5492fe3c91	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulation	mimo-v2.5-pro	disabled	\N	\N	f	balanced	structured	2026-04-30 16:53:55.843	2026-05-02 17:17:30.641	mimo
fc338db9-71f8-4ea7-a7cb-cfc085a70e9b	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	simulationGrading	mimo-v2.5-pro	disabled	\N	\N	f	balanced	structured	2026-05-01 02:20:25.566	2026-05-02 17:17:30.641	mimo
74028f7d-09fd-41f4-aeb7-1093255f813b	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	simulationChat	mimo-v2.5	disabled	\N	\N	f	balanced	structured	2026-05-01 02:20:27.251	2026-05-02 17:17:30.641	mimo
e1606870-7d14-4521-9611-7c863d17c9b7	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	simulationChat	\N	disabled	0.8	\N	f	\N	\N	2026-05-02 13:59:45.803	2026-05-13 12:17:18.235	\N
\.


--
-- Data for Name: AllocationItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AllocationItem" (id, "sectionId", label, "order", "createdAt") FROM stdin;
39472968-97b3-4ea6-b596-74b61a695b8e	04eea8a3-917f-4afc-b854-77f0ef7bdf83	银行存款/货币基金	0	2026-02-21 09:55:53.279
7ecad371-20bb-45ed-adcf-3011775d4089	04eea8a3-917f-4afc-b854-77f0ef7bdf83	债券/债券基金	1	2026-02-21 09:55:53.279
979c6948-a813-4158-a921-3e05fa0ea713	04eea8a3-917f-4afc-b854-77f0ef7bdf83	混合基金	2	2026-02-21 09:55:53.279
2a9dfac8-69e5-4ca6-96fe-b50140d02089	04eea8a3-917f-4afc-b854-77f0ef7bdf83	股票/股票基金	3	2026-02-21 09:55:53.279
e8a38dc9-ce49-414b-8a7a-bebbc36da6d7	04eea8a3-917f-4afc-b854-77f0ef7bdf83	保险产品	4	2026-02-21 09:55:53.279
ee04f3b9-3fe1-4d2d-8063-2b68b7cbb3dc	371e46a2-e62a-46cb-8cd8-2ad1ac0583e7	银行存款/货币基金	0	2026-04-22 06:54:51.498
c3cc9618-5747-4d71-977c-5e9dfff9dcba	371e46a2-e62a-46cb-8cd8-2ad1ac0583e7	债券/债券基金	1	2026-04-22 06:54:51.498
17969213-d2e2-4fdd-8660-0c0c62c86838	371e46a2-e62a-46cb-8cd8-2ad1ac0583e7	混合基金	2	2026-04-22 06:54:51.498
f4949dc1-368d-47f0-a3b9-8c45540b219d	371e46a2-e62a-46cb-8cd8-2ad1ac0583e7	股票/股票基金	3	2026-04-22 06:54:51.498
f0ed4c86-ae72-4b34-ab87-499dc914de74	371e46a2-e62a-46cb-8cd8-2ad1ac0583e7	保险产品	4	2026-04-22 06:54:51.498
f76bd75f-466a-4a24-80ed-0d2f958678c6	e3a75b94-d00d-4c8a-984a-5510d3731eb9	银行存款/货币基金	0	2026-04-29 11:40:04.487
dca9c8a4-f0d9-4231-82f3-5655b0720772	e3a75b94-d00d-4c8a-984a-5510d3731eb9	债券/债券基金	1	2026-04-29 11:40:04.487
cfe5ee21-7259-4562-8a65-4f2e58919a8a	e3a75b94-d00d-4c8a-984a-5510d3731eb9	混合基金	2	2026-04-29 11:40:04.487
749a8e44-fc18-4152-bcc1-edca87390255	e3a75b94-d00d-4c8a-984a-5510d3731eb9	股票/股票基金	3	2026-04-29 11:40:04.487
0448806a-1b69-4497-80e4-2e4ae4b82763	e3a75b94-d00d-4c8a-984a-5510d3731eb9	保险产品	4	2026-04-29 11:40:04.487
a5e275b2-435a-48d2-94c4-70bd50b37b9d	59acf2ec-dd2a-4e20-981d-600854f9241b	紧急备用金	0	2026-04-30 02:50:06.289
97551f5b-1cad-48a5-828d-3bc6fa188c70	59acf2ec-dd2a-4e20-981d-600854f9241b	稳健理财	1	2026-04-30 02:50:06.289
be5a93a5-6480-4856-8b34-db1bff383720	59acf2ec-dd2a-4e20-981d-600854f9241b	成长投资	2	2026-04-30 02:50:06.289
\.


--
-- Data for Name: AllocationSection; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AllocationSection" (id, "taskId", label, "order", "createdAt") FROM stdin;
04eea8a3-917f-4afc-b854-77f0ef7bdf83	50194450-47c2-4cee-b2fa-2aa6b634fb5f	资产配置方案	0	2026-02-21 09:55:53.279
371e46a2-e62a-46cb-8cd8-2ad1ac0583e7	a308c7ba-2713-4c2d-9441-c92927e3f9f4	资产配置方案	0	2026-04-22 06:54:51.498
e3a75b94-d00d-4c8a-984a-5510d3731eb9	77999372-a6e0-4a49-8a01-5e978d08bdb6	资产配置方案	0	2026-04-29 11:40:04.487
59acf2ec-dd2a-4e20-981d-600854f9241b	5e69a393-3175-4cef-a92a-c44612593f4d	资金安排	0	2026-04-30 02:50:06.289
\.


--
-- Data for Name: AnalysisReport; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AnalysisReport" (id, "taskId", "taskInstanceId", "createdBy", "studentCount", report, "createdAt", "aggregatedAt", "commonIssues", "moodTimeline", "scopeHash", "scopeSummary") FROM stdin;
b898607e-8c4c-490e-916a-07eafa27f549	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	1	{"kind": "scope_simulation_insight"}	2026-05-03 01:26:57.343	\N	\N	\N	616e987c394cd95e16dc4c79c7e9de760d29dc65093056adb51ff843c66edea3	{"notice": "样本中未出现得分率低于 60% 的评分维度。", "source": "fallback", "highlights": [{"score": 55, "reason": "张三 在「ANL-2 客户风险评估模拟」中得分 55/100（55%），对话亮点见证据。", "maxScore": 100, "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "taskTitle": "ANL-2 客户风险评估模拟", "transcript": [], "studentName": "张三", "submissionId": "00000000-0000-4000-8000-00000000a704", "taskInstanceId": "00000000-0000-4000-8000-00000000a602", "normalizedScore": 55}], "generatedAt": "2026-05-03T01:26:57.314Z", "commonIssues": [{"title": "暂无低分维度", "evidence": [], "frequency": 0, "description": "当前范围内 simulation 评分均高于 60%，未发现共性低分问题。", "relatedCriterion": "—"}]}
9e740f5a-b34b-4787-8d04-6ec71e0369b6	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	1	{"kind": "scope_simulation_insight"}	2026-05-03 01:29:55.171	\N	\N	\N	616e987c394cd95e16dc4c79c7e9de760d29dc65093056adb51ff843c66edea3	{"notice": "样本中未出现得分率低于 60% 的评分维度。", "source": "fallback", "highlights": [{"score": 55, "reason": "张三 在「ANL-2 客户风险评估模拟」中得分 55/100（55%），对话亮点见证据。", "maxScore": 100, "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "taskTitle": "ANL-2 客户风险评估模拟", "transcript": [], "studentName": "张三", "submissionId": "00000000-0000-4000-8000-00000000a704", "taskInstanceId": "00000000-0000-4000-8000-00000000a602", "normalizedScore": 55}], "generatedAt": "2026-05-03T01:29:55.131Z", "commonIssues": [{"title": "暂无低分维度", "evidence": [], "frequency": 0, "description": "当前范围内 simulation 评分均高于 60%，未发现共性低分问题。", "relatedCriterion": "—"}]}
911a0d79-154a-4b4b-8eb9-b8c9ffd03b90	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	0	{"kind": "scope_simulation_insight"}	2026-05-03 01:36:29.25	\N	\N	\N	735edeea26422d4bd730c61b142fd398ee57c99518883773c7f6f2b8a9aae1da	{"notice": null, "source": "fresh", "highlights": [], "generatedAt": "2026-05-03T01:36:29.239Z", "commonIssues": []}
62bec4fc-faa5-4544-aac3-82865c5cb4b5	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	1	{"kind": "scope_simulation_insight"}	2026-05-03 01:38:58.053	\N	\N	\N	53f2dec1f7ec916cdd3086c6f0acc1a69604a32069a5958a5e0bdf18eda048c5	{"notice": "样本中未出现得分率低于 60% 的评分维度。", "source": "fallback", "highlights": [{"score": 55, "reason": "张三 在「ANL-2 客户风险评估模拟」中得分 55/100（55%），对话亮点见证据。", "maxScore": 100, "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "taskTitle": "ANL-2 客户风险评估模拟", "transcript": [], "studentName": "张三", "submissionId": "00000000-0000-4000-8000-00000000a704", "taskInstanceId": "00000000-0000-4000-8000-00000000a602", "normalizedScore": 55}], "generatedAt": "2026-05-03T01:38:58.017Z", "commonIssues": [{"title": "暂无低分维度", "evidence": [], "frequency": 0, "description": "当前范围内 simulation 评分均高于 60%，未发现共性低分问题。", "relatedCriterion": "—"}]}
51c97e70-a81e-40be-89a2-3b58d42cb428	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	0	{"kind": "scope_simulation_insight"}	2026-05-03 01:40:22.483	\N	\N	\N	91cc6f5f670a709ef8a41ee216889ab251df23467813dfc06848d08277d430a0	{"notice": null, "source": "fresh", "highlights": [], "generatedAt": "2026-05-03T01:40:22.463Z", "commonIssues": []}
a08368c9-51a9-4c09-bb27-71e6367dd00f	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	0	{"kind": "scope_simulation_insight"}	2026-05-03 01:40:22.728	\N	\N	\N	3bd1e41ffbc5a8ed806606748b787df8d54d2bfa0f4d2a6d08087fbedb135c41	{"notice": null, "source": "fresh", "highlights": [], "generatedAt": "2026-05-03T01:40:22.714Z", "commonIssues": []}
d8e320b0-bfbf-4c15-9ad6-f481904d3891	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	1	{"kind": "scope_simulation_insight"}	2026-05-03 01:37:02.61	\N	\N	\N	616e987c394cd95e16dc4c79c7e9de760d29dc65093056adb51ff843c66edea3	{"notice": "样本中未出现得分率低于 60% 的评分维度。", "source": "fallback", "highlights": [{"score": 55, "reason": "张三 在「ANL-2 客户风险评估模拟」中得分 55/100（55%），对话亮点见证据。", "maxScore": 100, "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "taskTitle": "ANL-2 客户风险评估模拟", "transcript": [], "studentName": "张三", "submissionId": "00000000-0000-4000-8000-00000000a704", "taskInstanceId": "00000000-0000-4000-8000-00000000a602", "normalizedScore": 55}], "generatedAt": "2026-05-03T01:37:02.581Z", "commonIssues": [{"title": "暂无低分维度", "evidence": [], "frequency": 0, "description": "当前范围内 simulation 评分均高于 60%，未发现共性低分问题。", "relatedCriterion": "—"}], "teachingAdvice": {"notice": null, "source": "fresh", "nextSteps": [{"step": "立即向未提交学生发送提醒，如李四、赵六、alex等", "evidence": "kpis中riskStudentCount为10，studentInterventionsTop中列出具体学生"}, {"step": "安排'风险与资产配置'章节的复习课或答疑", "evidence": "riskChapters中'风险与资产配置'的avgNormalizedScore为55"}, {"step": "检查并优化'理财基础概念'章节的教学内容", "evidence": "riskChapters中'理财基础概念'的completionRate为0.15"}, {"step": "监控后续作业提交情况，调整教学策略", "evidence": "kpis中completionRate为0.167，submittedStudents为5"}], "focusGroups": [{"group": "未提交作业的学生", "action": "发送个性化提醒并跟进提交情况", "evidence": "studentInterventionsTop中多个学生reason为not_submitted，如李四、赵六、alex等", "studentIds": ["eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "54b6889f-a70b-4f3d-937a-8124c49baa80", "236c3795-f19f-4107-a681-0bc0e1d21d62", "edad1bc2-43ae-4598-8e12-1053ef4eb964", "32575dd0-e927-408b-ba9f-7f003bfd60d6", "db2cbb54-e58f-4a0a-8afe-d7333a592981", "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e"]}, {"group": "学习'风险与资产配置'章节困难的学生", "action": "组织小组讨论或额外辅导", "evidence": "riskChapters中'风险与资产配置'的avgNormalizedScore为55", "studentIds": []}, {"group": "所有学生", "action": "强化'理财基础概念'的基础知识", "evidence": "riskChapters中'理财基础概念'的completionRate为0.15", "studentIds": []}], "generatedAt": "2026-05-03T04:59:22.023Z", "knowledgeGoals": [{"point": "强化'风险与资产配置'章节的教学，因其平均分较低", "evidence": "riskChapters中'风险与资产配置'的avgNormalizedScore为55，低于课程平均61.7"}, {"point": "提高'理财基础概念'章节的完成率和理解", "evidence": "riskChapters中'理财基础概念'的completionRate为0.15，avgNormalizedScore为63.9"}, {"point": "提升整体课程参与度，针对未提交学生", "evidence": "kpis中completionRate为0.167，submittedStudents为5，assignedStudents为30"}, {"point": "关注风险学生群体，提供针对性辅导", "evidence": "kpis中riskStudentCount为10"}], "pedagogyAdvice": [{"method": "采用互动案例教学讲解'风险与资产配置'，以提升分数", "evidence": "riskChapters中'风险与资产配置'的avgNormalizedScore为55"}, {"method": "设置作业截止提醒和跟进机制，提高提交率", "evidence": "kpis中completionRate为0.167，submittedStudents为5"}, {"method": "利用在线讨论和练习巩固'理财基础概念'", "evidence": "riskChapters中'理财基础概念'的completionRate为0.15"}, {"method": "为未提交学生提供一对一辅导或小组支持", "evidence": "kpis中riskStudentCount为10"}]}}
75d5d766-b55a-466f-90ad-a9c910b28fec	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	1	{"kind": "scope_simulation_insight"}	2026-05-03 05:42:30.77	\N	\N	\N	53f2dec1f7ec916cdd3086c6f0acc1a69604a32069a5958a5e0bdf18eda048c5	{"notice": "样本中未出现得分率低于 60% 的评分维度。", "source": "fallback", "highlights": [{"score": 55, "reason": "张三 在「ANL-2 客户风险评估模拟」中得分 55/100（55%），对话亮点见证据。", "maxScore": 100, "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "taskTitle": "ANL-2 客户风险评估模拟", "transcript": [], "studentName": "张三", "submissionId": "00000000-0000-4000-8000-00000000a704", "taskInstanceId": "00000000-0000-4000-8000-00000000a602", "normalizedScore": 55}], "generatedAt": "2026-05-03T05:42:30.770Z", "commonIssues": [{"title": "暂无低分维度", "evidence": [], "frequency": 0, "description": "当前范围内 simulation 评分均高于 60%，未发现共性低分问题。", "relatedCriterion": "—"}], "teachingAdvice": {"notice": null, "source": "fresh", "nextSteps": [{"step": "立即联系未提交学生如李四、赵六，了解障碍并提供支持", "evidence": "studentInterventionsTop中李四、赵六等学生原因为not_submitted"}, {"step": "为'风险与资产配置'章节设计补充教学活动，因其平均分仅55", "evidence": "riskChapters中'风险与资产配置'的avgNormalizedScore为55"}, {"step": "更新课程材料以覆盖'理财基础概念'和'风险与资产配置'两个风险章节", "evidence": "kpis中riskChapterCount为2"}, {"step": "设定明确的提交截止日期并发送提醒，以提升completionRate从0.167", "evidence": "kpis中completionRate为0.167，pendingReleaseCount为0"}], "focusGroups": [{"group": "未提交作业的学生", "action": "发送个性化提醒并安排辅导会议", "evidence": "studentInterventionsTop中这些学生原因为not_submitted，且riskStudentCount为10", "studentIds": ["eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "54b6889f-a70b-4f3d-937a-8124c49baa80", "236c3795-f19f-4107-a681-0bc0e1d21d62", "edad1bc2-43ae-4598-8e12-1053ef4eb964", "32575dd0-e927-408b-ba9f-7f003bfd60d6", "db2cbb54-e58f-4a0a-8afe-d7333a592981", "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e"]}, {"group": "在'风险与资产配置'章节表现较弱的学生", "action": "提供额外练习材料和复习课", "evidence": "riskChapters中'风险与资产配置'的avgNormalizedScore为55，低于整体avgNormalizedScore为61.7", "studentIds": []}], "generatedAt": "2026-05-03T05:42:30.800Z", "knowledgeGoals": [{"point": "强化'风险与资产配置'章节的核心概念，因其平均分仅为55", "evidence": "riskChapters中'风险与资产配置'的avgNormalizedScore为55"}, {"point": "提升'理财基础概念'章节的完成率，当前仅为0.15", "evidence": "riskChapters中'理财基础概念'的completionRate为0.15"}, {"point": "提高整体课程参与度，完成率仅0.167", "evidence": "kpis中completionRate为0.167"}, {"point": "减少风险学生数量，当前为10人", "evidence": "kpis中riskStudentCount为10"}], "pedagogyAdvice": [{"method": "采用案例教学法讲解'风险与资产配置'，以弥补平均分55的不足", "evidence": "riskChapters中'风险与资产配置'的avgNormalizedScore为55"}, {"method": "组织小组讨论促进互动，因assignedStudents为30但submittedStudents仅5", "evidence": "kpis中assignedStudents为30，submittedStudents为5"}, {"method": "为未提交学生提供一对一辅导，如李四、赵六等", "evidence": "studentInterventionsTop中李四、赵六等学生原因为not_submitted"}, {"method": "设置每周进度检查点，以监控completionRate为0.167的低参与度", "evidence": "kpis中completionRate为0.167"}]}}
86efbf90-8dc7-465b-ae5b-8a2383044fbf	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2	{"kind": "scope_simulation_insight"}	2026-05-14 07:22:33.273	\N	\N	\N	7e8eea0b0b55566b725da3816e6c9d27e027408c4e49a3895d0a434448a171fa	{"notice": null, "source": "fresh", "highlights": [{"score": 100, "reason": "alex 在「[QA-V2-202604300250] 客户风险沟通模拟」中得分 100/100（100%），对话亮点见证据。", "maxScore": 100, "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "taskTitle": "[QA-V2-202604300250] 客户风险沟通模拟", "transcript": [{"role": "student", "content": "我先了解一下您的现金流情况：目前每月结余、已有备用金和未来三个月的大额支出是什么？如果短期现金流紧张，不能只追求最高收益，需要先保留应急资金，再考虑稳健配置。"}, {"role": "student", "content": "在这种情况下，我建议先把下个月的大额支出和3到6个月必要支出放在备用金，再把可投资部分放入低波动产品。高收益通常伴随本金波动和流动性风险，若短期要用钱，不适合重仓高风险产品。"}, {"role": "student", "content": "可以折中：先把下个月的大额支出和3到6个月必要支出放在备用金，再把可投资部分分成两层，约60%放在现金和短期低风险产品，30%做稳健理财，最多10%用长期不用的钱尝试成长型投资。这样不会影响短期现金流，也保留少量增值机会。"}], "studentName": "alex", "submissionId": "4145932c-a4a8-4d3d-9916-83c3a973fd0c", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "normalizedScore": 100}, {"score": 88, "reason": "张三 在「[QA-V2-202604300250] 客户风险沟通模拟」中得分 88/100（88%），对话亮点见证据。", "maxScore": 100, "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "taskTitle": "[QA-V2-202604300250] 客户风险沟通模拟", "transcript": [{"role": "student", "content": "我先了解你的收入支出和备用金，再判断风险是否合适。"}], "studentName": "张三", "submissionId": "1e4bcf48-c6a3-4c43-a333-0fa2b556916b", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "normalizedScore": 88}], "generatedAt": "2026-05-14T07:22:33.273Z", "commonIssues": [{"title": "需求澄清能力薄弱", "evidence": [{"score": 51, "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "studentName": "李四", "submissionId": "16ed122e-75da-4390-86c0-6c1668f5dccd", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "rubricCriterion": "需求澄清", "transcriptExcerpt": ""}, {"score": 29, "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "studentName": "王五", "submissionId": "fac13b95-5a52-41cc-a6c5-91dd95944eac", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "rubricCriterion": "需求澄清", "transcriptExcerpt": ""}], "frequency": 2, "description": "学生在模拟对话中未能有效识别和确认客户的核心需求，导致后续沟通偏离重点。", "relatedCriterion": "需求澄清"}, {"title": "风险收益解释不清", "evidence": [{"score": 51, "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "studentName": "李四", "submissionId": "16ed122e-75da-4390-86c0-6c1668f5dccd", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "rubricCriterion": "风险收益解释", "transcriptExcerpt": ""}, {"score": 34, "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "studentName": "王五", "submissionId": "fac13b95-5a52-41cc-a6c5-91dd95944eac", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "rubricCriterion": "风险收益解释", "transcriptExcerpt": ""}], "frequency": 2, "description": "学生对产品或方案的风险与收益解释不够清晰、全面，难以建立客户信任并促成决策。", "relatedCriterion": "风险收益解释"}], "teachingAdvice": {"notice": null, "source": "fresh", "nextSteps": [{"step": "优先发布并讲解“风险与资产配置”章节的学习任务与核心内容。", "evidence": "该章节完成率为0%，平均标准化分数为空，是当前教学进度的空白点。"}, {"step": "本周内完成对未提交学生（如李四、王五、张三等）的首次催交与情况摸底。", "evidence": "学生干预列表中，大量学生原因为“not_submitted”，且班级整体完成率仅为15.9%。"}, {"step": "设计一个包含“需求澄清”和“风险收益解释”环节的综合模拟案例，并在课堂上演练。", "evidence": "这两项能力在常见问题中均被标记为薄弱，需要通过整合性练习来强化。"}, {"step": "分析“投资工具入门”章节高平均分（73分）与低完成率（10%）的原因，考虑是否调整任务难度或激励方式。", "evidence": "该章节平均标准化分数为73分，但完成率仅为10%，实例数为1，表明学习者少但得分高。"}], "skillGoals": [{"point": "提升在模拟对话中澄清客户需求的能力", "evidence": "常见问题“需求澄清能力不足”出现频率为2次，学生在模拟对话中未能有效澄清客户需求。"}, {"point": "增强对客户进行风险收益解释与沟通的实操能力", "evidence": "常见问题“风险收益解释薄弱”出现频率为2次，学生难以建立客户信任并推动决策。"}], "focusGroups": [{"group": "未提交作业学生群体", "action": "进行一对一沟通，了解未提交原因，并提供个性化学习支持与督促。", "evidence": "学生干预列表中，上述学生原因为“not_submitted”，且班级提交学生仅11人，占分配学生69人的比例很低。", "studentIds": ["eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "54b6889f-a70b-4f3d-937a-8124c49baa80", "edad1bc2-43ae-4598-8e12-1053ef4eb964", "32575dd0-e927-408b-ba9f-7f003bfd60d6", "db2cbb54-e58f-4a0a-8afe-d7333a592981", "236c3795-f19f-4107-a681-0bc0e1d21d62"]}, {"group": "在“需求澄清”与“风险收益解释”上表现薄弱的学生", "action": "安排额外的案例分析与角色扮演练习，并提供针对性反馈。", "evidence": "常见问题“需求澄清能力不足”和“风险收益解释薄弱”频率均为2次，影响已提交作业学生的整体表现。", "studentIds": []}], "generatedAt": "2026-05-14T07:22:33.274Z", "knowledgeGoals": [{"point": "理解理财基础概念的核心内涵", "evidence": "风险章节“理财基础概念”完成率仅为20.4%，平均标准化分数为56.4分，表明学生对基础概念掌握不牢。"}, {"point": "掌握风险与资产配置的基本原理", "evidence": "风险章节“风险与资产配置”完成率为0%，平均标准化分数为空，说明该核心知识模块尚未启动学习。"}, {"point": "深化对风险收益权衡关系的理解", "evidence": "常见问题“风险收益解释薄弱”出现频率为2次，学生对产品或方案的风险与收益解释不清晰。"}], "pedagogyAdvice": [{"method": "针对“风险与资产配置”章节开展专题翻转课堂", "evidence": "该章节完成率为0%，平均标准化分数为空，需要通过课堂讲解和互动来启动并强化学习。"}, {"method": "设计并强化“需求澄清”与“风险收益解释”的情景模拟训练", "evidence": "这两项能力在常见问题中均被标记为薄弱，且频率均为2次，需通过反复练习来提升。"}, {"method": "对“理财基础概念”章节进行知识点回顾与巩固练习", "evidence": "该章节完成率仅为20.4%，平均标准化分数为56.4分，是当前得分最低的风险章节。"}, {"method": "发布针对未提交学生的定向提醒与学习资料包", "evidence": "学生干预列表中，李四、王五、张三、赵六、belle、charlie、dexter、alex等多名学生原因为“not_submitted”。"}]}}
67146fb4-a2e1-4793-9c1c-21802a4dc63f	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2	{"kind": "scope_simulation_insight"}	2026-05-14 07:22:33.647	\N	\N	\N	9f725edbbcd6549b5debfeb929b24324180e7ac72b452ca85088770b88fbaac2	{"notice": null, "source": "fresh", "highlights": [{"score": 100, "reason": "alex 在「[QA-V2-202604300250] 客户风险沟通模拟」中得分 100/100（100%），对话亮点见证据。", "maxScore": 100, "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "taskTitle": "[QA-V2-202604300250] 客户风险沟通模拟", "transcript": [{"role": "student", "content": "我先了解一下您的现金流情况：目前每月结余、已有备用金和未来三个月的大额支出是什么？如果短期现金流紧张，不能只追求最高收益，需要先保留应急资金，再考虑稳健配置。"}, {"role": "student", "content": "在这种情况下，我建议先把下个月的大额支出和3到6个月必要支出放在备用金，再把可投资部分放入低波动产品。高收益通常伴随本金波动和流动性风险，若短期要用钱，不适合重仓高风险产品。"}, {"role": "student", "content": "可以折中：先把下个月的大额支出和3到6个月必要支出放在备用金，再把可投资部分分成两层，约60%放在现金和短期低风险产品，30%做稳健理财，最多10%用长期不用的钱尝试成长型投资。这样不会影响短期现金流，也保留少量增值机会。"}], "studentName": "alex", "submissionId": "4145932c-a4a8-4d3d-9916-83c3a973fd0c", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "normalizedScore": 100}, {"score": 88, "reason": "张三 在「[QA-V2-202604300250] 客户风险沟通模拟」中得分 88/100（88%），对话亮点见证据。", "maxScore": 100, "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "taskTitle": "[QA-V2-202604300250] 客户风险沟通模拟", "transcript": [{"role": "student", "content": "我先了解你的收入支出和备用金，再判断风险是否合适。"}], "studentName": "张三", "submissionId": "1e4bcf48-c6a3-4c43-a333-0fa2b556916b", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "normalizedScore": 88}], "generatedAt": "2026-05-14T07:22:33.647Z", "commonIssues": [{"title": "需求澄清能力薄弱", "evidence": [{"score": 51, "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "studentName": "李四", "submissionId": "16ed122e-75da-4390-86c0-6c1668f5dccd", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "rubricCriterion": "需求澄清", "transcriptExcerpt": ""}, {"score": 29, "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "studentName": "王五", "submissionId": "fac13b95-5a52-41cc-a6c5-91dd95944eac", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "rubricCriterion": "需求澄清", "transcriptExcerpt": ""}], "frequency": 2, "description": "学生在模拟对话中未能有效识别、确认或深入挖掘客户的核心需求，导致后续沟通偏离重点。", "relatedCriterion": "需求澄清"}, {"title": "风险收益解释不清", "evidence": [{"score": 51, "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "studentName": "李四", "submissionId": "16ed122e-75da-4390-86c0-6c1668f5dccd", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "rubricCriterion": "风险收益解释", "transcriptExcerpt": ""}, {"score": 34, "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "studentName": "王五", "submissionId": "fac13b95-5a52-41cc-a6c5-91dd95944eac", "taskInstanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "rubricCriterion": "风险收益解释", "transcriptExcerpt": ""}], "frequency": 2, "description": "学生在解释产品或方案的风险与收益时，表述模糊、缺乏逻辑或未能结合客户具体情况，导致客户理解困难。", "relatedCriterion": "风险收益解释"}], "teachingAdvice": {"notice": null, "source": "fresh", "nextSteps": [{"step": "本周内发布关于“需求澄清”与“风险收益解释”技能的专项练习任务", "evidence": "常见问题“需求澄清能力薄弱”和“风险收益解释不清”的频率均为2。"}, {"step": "本周内完成对“风险与资产配置”章节的重点内容讲解或资源推送", "evidence": "风险章节“风险与资产配置”完成率为0。"}, {"step": "本周内向未提交作业的10名学生（如李四、王五等）发送个性化提醒", "evidence": "学生干预名单中有10名学生原因为“not_submitted”。"}, {"step": "评估并发布剩余3个待发布的学习任务或资源", "evidence": "待发布任务数量为3。"}], "skillGoals": [{"point": "提升在模拟对话中有效识别、确认和深入挖掘客户核心需求的能力", "evidence": "常见问题“需求澄清能力薄弱”出现频率为2次，学生未能有效识别客户核心需求。"}, {"point": "能够结合客户具体情况，清晰、有逻辑地解释产品或方案的风险与收益", "evidence": "常见问题“风险收益解释不清”出现频率为2次，学生未能结合客户具体情况解释。"}], "focusGroups": [{"group": "未提交作业学生", "action": "进行一对一提醒与跟进，了解未提交原因并提供支持", "evidence": "学生干预名单中，李四、王五、张三、赵六、belle、charlie、dexter、QA 测试、r2 验证用户、alex等学生原因为“not_submitted”。", "studentIds": ["eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "54b6889f-a70b-4f3d-937a-8124c49baa80", "edad1bc2-43ae-4598-8e12-1053ef4eb964", "32575dd0-e927-408b-ba9f-7f003bfd60d6", "db2cbb54-e58f-4a0a-8afe-d7333a592981", "62235d2c-a740-4db0-93e7-e28251354cba", "77cd55ef-e239-4407-9998-a583386767ff", "236c3795-f19f-4107-a681-0bc0e1d21d62"]}, {"group": "在“理财基础概念”章节表现较弱的学生", "action": "提供该章节的补充学习材料或辅导", "evidence": "风险章节“理财基础概念”平均分56.4，低于课程平均分57.9。", "studentIds": []}], "generatedAt": "2026-05-14T07:22:33.584Z", "knowledgeGoals": [{"point": "理解理财基础概念与投资工具入门的核心定义与区别", "evidence": "风险章节“理财基础概念”完成率仅20.4%，平均分56.4；“投资工具入门”完成率10%，平均分73。"}, {"point": "掌握风险与资产配置的基本原理及其在理财规划中的重要性", "evidence": "风险章节“风险与资产配置”完成率为0，且平均分为空。"}, {"point": "理解风险与收益的权衡关系，并能清晰解释给客户", "evidence": "常见问题“风险收益解释不清”出现频率为2次，学生表述模糊、缺乏逻辑。"}], "pedagogyAdvice": [{"method": "针对“需求澄清”与“风险收益解释”两项薄弱技能，设计专项微案例或角色扮演练习", "evidence": "常见问题“需求澄清能力薄弱”和“风险收益解释不清”的频率均为2。"}, {"method": "对“风险与资产配置”章节进行重点讲解与答疑，因其完成率为0", "evidence": "风险章节“风险与资产配置”完成率为0。"}, {"method": "对“理财基础概念”章节进行复习巩固，因其平均分56.4低于课程平均分57.9", "evidence": "风险章节“理财基础概念”平均分56.4，课程平均标准化分数为57.9。"}, {"method": "发布学习提醒并跟进未提交作业的学生，当前提交学生仅11人，占已分配学生69人的15.9%", "evidence": "提交学生数为11，已分配学生数为69，完成率为15.9%。"}]}}
eef9dc9f-3fff-437f-84b4-448360b8b1cb	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	0	{"kind": "scope_simulation_insight"}	2026-05-14 06:33:47.799	\N	\N	\N	4ef0a9857f90de23d827c98e88f311850fceb713502379ac3c637543a0d82363	{"notice": null, "source": "fresh", "highlights": [], "generatedAt": "2026-05-14T06:33:47.799Z", "commonIssues": [], "teachingAdvice": {"notice": null, "source": "fresh", "nextSteps": [{"step": "发布“理财基础概念”章节的补充学习资料与练习题", "evidence": "该章节完成率仅为0.5，且是唯一的风险章节"}, {"step": "在下次课前，通过邮件或课程平台提醒周八提交作业", "evidence": "学生周八（金融2024B班）因“not_submitted”被列为干预重点"}, {"step": "准备一个简短的课堂回顾，总结“理财基础概念”的关键点", "evidence": "课程整体完成率仅为0.5，需要巩固基础"}, {"step": "规划一次小组作业，主题围绕基础理财规划，以促进协作与应用", "evidence": "已分配学生数为2，已提交学生数为1，小组活动可提升参与度"}], "skillGoals": [{"point": "能够独立完成基础理财需求分析与信息收集", "evidence": "已提交作业的学生数为1，已评分学生数为1，但未提交学生数为1（周八）"}, {"point": "能够撰写简单的个人理财规划初步方案", "evidence": "班级平均标准化分数为90，表明已提交作业的学生具备一定的方案撰写能力"}], "focusGroups": [{"group": "未提交作业学生", "action": "立即联系，了解困难并提供提交支持", "evidence": "周八（金融2024B班）因“not_submitted”被列为干预重点，且已分配学生数为2，已提交学生数为1", "studentIds": ["ee216363-bc2f-4d72-9620-3af0de15a606"]}, {"group": "“理财基础概念”章节学习困难学生", "action": "提供额外辅导材料或安排答疑", "evidence": "风险学生数为1，风险章节数为1，均指向“理财基础概念”章节", "studentIds": ["ee216363-bc2f-4d72-9620-3af0de15a606"]}], "generatedAt": "2026-05-14T06:33:47.918Z", "knowledgeGoals": [{"point": "理解理财规划的基本概念与重要性", "evidence": "风险章节“理财基础概念”完成率仅为0.5，且该章节实例数为1"}, {"point": "掌握个人财务目标设定与风险收益权衡原则", "evidence": "班级平均标准化分数为90，但课程完成率仅为0.5，表明学生可能对概念理解不深"}, {"point": "区分不同金融工具的风险等级与适用场景", "evidence": "风险学生数为1，风险章节数为1，均指向“理财基础概念”章节"}], "pedagogyAdvice": [{"method": "针对“理财基础概念”章节进行专题复习与案例强化", "evidence": "该章节完成率仅为0.5，且是唯一的风险章节"}, {"method": "对未提交作业的学生（周八）进行一对一沟通与进度督促", "evidence": "学生周八（金融2024B班）因“not_submitted”被列为干预重点"}, {"method": "组织小组讨论，分享已提交作业学生的优秀方案思路", "evidence": "已提交并评分的学生为1名，其标准化分数为90，可作为范例"}, {"method": "利用课堂时间进行快速测验，检验学生对核心概念的理解", "evidence": "课程整体完成率仅为0.5，需要即时反馈来评估学习效果"}]}}
95a4b965-04c5-452c-8148-0755435583ca	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	0	{"kind": "scope_simulation_insight"}	2026-05-13 10:57:18.19	\N	\N	\N	9836501de264b95cf6771df55efffce5c2afe43eb4454a1554fbb25824fab069	{"notice": null, "source": "fresh", "highlights": [], "generatedAt": "2026-05-13T10:57:18.190Z", "commonIssues": [], "teachingAdvice": {"notice": null, "source": "fresh", "nextSteps": [{"step": "直接联系周八了解未提交作业的具体原因", "evidence": "周八是唯一标记为'not_submitted'的风险学生"}, {"step": "针对'理财基础概念'章节设计补充学习材料", "evidence": "该章节完成率仅为50%，且为风险章节"}, {"step": "监控作业提交率并设定明确截止日期", "evidence": "提交学生数仅为1，完成率50%，需提高提交率"}, {"step": "评估当前教学方法以提升整体参与度", "evidence": "平均标准化分数高但完成率低，表明方法可能需调整"}], "skillGoals": [{"point": "完成并提交理财规划作业", "evidence": "仅有1名学生提交了作业，而2名学生被分配任务"}, {"point": "应用理财概念进行实际案例分析", "evidence": "学生周八未提交作业，表明实践技能待提升"}, {"point": "撰写个人理财建议报告", "evidence": "已提交学生的平均标准化分数为90，但提交学生数仅为1"}], "focusGroups": [{"group": "未提交作业学生", "action": "发送提醒并了解具体困难", "evidence": "周八因'not_submitted'被标记，且作业提交学生数仅为1", "studentIds": ["ee216363-bc2f-4d72-9620-3af0de15a606"]}, {"group": "基础概念薄弱学生", "action": "安排额外复习课或一对一辅导", "evidence": "风险章节'理财基础概念'完成率仅为50%，且周八是未提交学生", "studentIds": ["ee216363-bc2f-4d72-9620-3af0de15a606"]}, {"group": "全班学生", "action": "鼓励相互学习和小组讨论", "evidence": "班级数量为1，共2名学生，完成率低需整体提升", "studentIds": []}], "generatedAt": "2026-05-13T10:57:18.193Z", "knowledgeGoals": [{"point": "理解理财基础概念的核心要素", "evidence": "章节'理财基础概念'的完成率仅为50%"}, {"point": "掌握个人理财规划的基本原理", "evidence": "课程整体完成率为50%"}, {"point": "认识到风险与收益的权衡在理财中的应用", "evidence": "风险章节计数为1，指向'理财基础概念'"}, {"point": "提升对理财工具和策略的认知深度", "evidence": "平均标准化分数为90，但仅1名学生提交作业"}], "pedagogyAdvice": [{"method": "增加互动式教学活动以提升参与度", "evidence": "课程完成率仅为50%，表明学生参与度不足"}, {"method": "提供个性化辅导给未提交学生", "evidence": "学生周八因未提交作业被标记为风险学生"}, {"method": "使用案例研究强化'理财基础概念'教学", "evidence": "该章节完成率仅为50%，且为风险章节"}, {"method": "定期检查学习进度并给予反馈", "evidence": "有1个风险章节和1个风险学生，完成率低"}]}}
\.


--
-- Data for Name: Announcement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Announcement" (id, "courseId", title, body, status, "createdBy", "createdAt", "updatedAt") FROM stdin;
d2eb16fc-791b-40af-ac5a-50ed6113cf78	940bbe23-6172-40bf-bc7f-b22a1840a1de	欢迎来到个人理财规划课程	同学们好！本学期我们将系统学习个人理财规划的相关知识。课程包含模拟对话、测验和报告写作三种任务类型，请按时完成各项作业。如有问题请随时在学习伙伴中提问。	published	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.318	2026-02-21 09:55:53.318
d242848c-abce-4193-a6a4-9ff9823269e5	940bbe23-6172-40bf-bc7f-b22a1840a1de	第一周作业提醒	请大家本周完成理财基础知识随堂测验，测验时间为30分钟，可以尝试两次。	published	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.323	2026-02-21 09:55:53.323
444c226e-9db8-4bd7-aff4-4313c912e228	940bbe23-6172-40bf-bc7f-b22a1840a1de	111	111	published	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-22 10:17:44.821	2026-02-22 10:17:44.821
dd62d0e1-1f58-49f5-b1c0-6ccf75a9ab79	e6fc049c-756f-4442-86da-35a6cdbadd6e	欢迎来到个人理财规划课程	同学们好！本学期我们将系统学习个人理财规划的相关知识。课程包含模拟对话、测验和报告写作三种任务类型，请按时完成各项作业。如有问题请随时在学习伙伴中提问。	published	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.52	2026-04-22 06:54:51.52
571a8a5e-c79f-4324-9d39-089a77b69090	e6fc049c-756f-4442-86da-35a6cdbadd6e	第一周作业提醒	请大家本周完成理财基础知识随堂测验，测验时间为30分钟，可以尝试两次。	published	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.521	2026-04-22 06:54:51.521
df7a6fdd-99ac-419c-b43a-53483a4d50bb	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	欢迎来到个人理财规划课程	同学们好！本学期我们将系统学习个人理财规划的相关知识。课程包含模拟对话、测验和报告写作三种任务类型，请按时完成各项作业。如有问题请随时在学习伙伴中提问。	published	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.529	2026-04-29 11:40:04.529
a0ef541f-cc2d-41e0-8951-5db3ae19af2f	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	第一周作业提醒	请大家本周完成理财基础知识随堂测验，测验时间为30分钟，可以尝试两次。	published	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.533	2026-04-29 11:40:04.533
\.


--
-- Data for Name: AsyncJob; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AsyncJob" (id, type, status, "entityType", "entityId", progress, input, result, error, attempts, "maxAttempts", "createdBy", "startedAt", "completedAt", "createdAt", "updatedAt") FROM stdin;
5b8f8dd7-db09-455b-bcdb-9230c591019e	ai_work_assistant	succeeded	AiWorkAssistant	\N	100	{"text": "课程：个人理财基础。教学目标：学生能够解释预算、储蓄、风险与收益的关系。课堂活动：让学生比较三种储蓄方案。请优化成适合中职学生的教案建议。", "files": [], "toolKey": "lessonPolish", "strictness": "balanced", "outputStyle": "structured", "enableSearch": false, "teacherRequest": "语言更口语化，给出可直接使用的课堂提问。"}	{"title": "教案完善（离线占位）", "summary": "AI 服务暂不可用，系统已完成材料识别。请稍后重试或检查 AI 设置。", "cautions": ["AI_PROVIDER_NOT_CONFIGURED: mimo"], "fallback": true, "sections": [{"heading": "已识别材料", "examples": [], "diagnosis": "已读取 69 个字符。教师需求：语言更口语化，给出可直接使用的课堂提问。", "suggestions": ["检查上传材料是否完整", "在 AI 设置中确认模型和账号额度", "必要时缩短材料后重试"]}], "actionItems": ["稍后重新生成", "确认 OCR/AI provider 配置"], "fileReports": [], "gradingTable": [], "searchStatus": "disabled"}	\N	1	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-01 06:23:57.091	2026-05-01 06:23:57.14	2026-05-01 06:23:57.056	2026-05-01 06:23:57.141
1f1000bf-a2f9-4698-abb2-c02790168770	submission_grade	failed	Submission	17045c66-06a3-4d1f-866d-4dfe0cab7a51	20	{"submissionId": "17045c66-06a3-4d1f-866d-4dfe0cab7a51"}	\N	AI_PROVIDER_NOT_CONFIGURED: mimo	1	3	236c3795-f19f-4107-a681-0bc0e1d21d62	2026-05-01 05:17:41.011	2026-05-01 05:17:41.195	2026-05-01 05:17:40.993	2026-05-01 05:17:41.196
7f146c3e-ff50-4d77-9d8b-69cfdab5f863	knowledge_source_ingest	succeeded	CourseKnowledgeSource	53089e0e-a96a-45b3-8df0-2be28a8bfbff	100	{"sourceId": "53089e0e-a96a-45b3-8df0-2be28a8bfbff"}	{"status": "ready", "sourceId": "53089e0e-a96a-45b3-8df0-2be28a8bfbff", "textLength": 2332}	\N	1	3	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-05 12:23:54.692	2026-05-05 12:24:35.245	2026-05-05 12:23:54.681	2026-05-05 12:24:35.245
d14189e4-eddd-41d3-ac4a-3e73dfee3872	submission_grade	failed	Submission	17045c66-06a3-4d1f-866d-4dfe0cab7a51	20	{"retriedBy": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "submissionId": "17045c66-06a3-4d1f-866d-4dfe0cab7a51"}	\N	AI_PROVIDER_NOT_CONFIGURED: mimo	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-01 05:20:55.708	2026-05-01 05:20:55.807	2026-05-01 05:20:55.701	2026-05-01 05:20:55.808
05a00a38-07ad-4484-93d0-4bd1d9793ee8	knowledge_source_ingest	succeeded	CourseKnowledgeSource	46402ca6-2edd-4f6c-8e20-b65c85587449	100	{"sourceId": "46402ca6-2edd-4f6c-8e20-b65c85587449"}	{"status": "ai_summary_failed", "sourceId": "46402ca6-2edd-4f6c-8e20-b65c85587449", "textLength": 2966}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-01 05:46:35.368	2026-05-01 05:46:35.46	2026-05-01 05:46:35.358	2026-05-01 05:46:35.462
0157f186-9e50-4c41-99b2-4f15351893e7	ai_work_assistant	succeeded	AiWorkAssistant	\N	100	{"text": "教案主题：复利和72法则。课时45分钟，目标学生为大一非金融专业。请帮我完善教学目标、活动设计和课堂提问话术。", "files": [], "toolKey": "lessonPolish", "strictness": "balanced", "outputStyle": "structured", "enableSearch": false, "teacherRequest": ""}	{"title": "复利与72法则教案完善建议", "summary": "原教案缺乏明确可测的教学目标、结构化课堂活动及引导性提问话术，需补充以适配非金融专业大一学生认知水平。", "cautions": ["72法则的适用范围（通常适用于6%–10%利率）需明确说明，避免学生误用于极端利率", "非金融专业学生可能缺乏指数函数基础，避免深入数学推导，侧重数值估算与现实意义", "需教师补充材料/来源：真实银行储蓄产品利率或学生熟悉的理财APP截图作为案例素材"], "fallback": false, "sections": [{"heading": "教学目标", "examples": ["学生能在给定年利率下，使用72法则估算本金翻倍所需年数（误差≤1年）。", "学生能口头解释复利与单利的核心区别，并举例说明复利在长期储蓄中的优势。"], "diagnosis": "目标表述模糊，未区分认知层次（如理解 vs 应用），也未体现非金融专业学生的实际应用场景。", "suggestions": ["采用ABCD目标编写法（对象Audience、行为Behavior、条件Condition、程度Degree）", "聚焦‘解释’‘估算’‘比较’等可观察行为动词", "关联生活场景（如储蓄、信用卡利息、投资起步）"]}, {"heading": "课堂活动设计", "examples": ["【情境】展示两个同学存钱案例：A每年存1万共5年（单利3%），B一次性存5万（复利6%），10年后谁更多？让学生先猜再算。", "【探究】分组用计算器验证不同利率（4%、6%、8%）下本金翻倍时间，归纳72法则的近似规律。", "【迁移】讨论‘为什么信用卡欠款增长快？’引导学生用复利思维分析高利率债务风险。"], "diagnosis": "缺少互动性和阶梯式任务，难以维持非专业学生注意力；缺乏从具体到抽象的认知过渡。", "suggestions": ["设计3阶段活动：情境导入 → 规则探究 → 应用迁移", "嵌入小组计算任务与快速投票（如使用手机小程序或举牌）", "对比单利与复利的累积曲线图，强化直观感受"]}, {"heading": "课堂提问话术", "examples": ["‘如果你有1万元，年收益5%，你觉得多久能变成2万？先凭直觉猜一个数。’", "‘我们算出来是14.4年，但72÷5≈14.4，这是巧合吗？试试换6%看看。’", "‘72法则在利率20%时还准吗？为什么这时候误差变大了？’"], "diagnosis": "提问多为封闭式或直接给出公式，缺乏引导性、阶梯性和认知冲突设计。", "suggestions": ["使用‘预测—验证—反思’提问链", "加入反例或极端情况引发思考（如负利率、超高利率）", "避免直接问‘什么是复利’，转而问‘如果银行说利息滚进去再生息，这意味着什么？’"]}], "actionItems": ["根据建议重写3条可测量的教学目标", "设计一个10分钟小组探究活动（含任务卡和数据表）", "准备3组递进式提问话术用于关键概念引入"], "fileReports": [], "gradingTable": [], "searchStatus": "disabled"}	\N	1	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-02 07:56:03.759	2026-05-02 07:56:29.294	2026-05-02 07:56:03.733	2026-05-02 07:56:29.295
2f43ed56-3c66-4a55-b2cf-677ee306465c	analytics_recompute	succeeded	AnalyticsV2Diagnosis	e6fc049c-756f-4442-86da-35a6cdbadd6e	100	{"range": null, "classId": null, "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "taskType": null, "chapterId": null, "sectionId": null, "scorePolicy": null, "taskInstanceId": null}	{"kpis": {"passRate": 0.444, "attemptCount": 10, "instanceCount": 9, "completionRate": 0.145, "gradedStudents": 9, "submissionCount": 10, "assignedStudents": 69, "submittedStudents": 10, "avgNormalizedScore": 62.7, "medianNormalizedScore": 58}, "scope": {"range": "term", "classId": null, "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "taskType": null, "chapterId": null, "sectionId": null, "courseTitle": "个人理财规划", "generatedAt": "2026-05-01T06:50:10.705Z", "scorePolicy": "latest", "taskInstanceId": null}, "trends": {"range": "term", "classTrend": [{"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "className": "金融2024A班", "instanceCount": 9, "completionRate": 0.145, "assignedStudents": 69, "latestActivityAt": "2026-05-01T05:17:40.926Z", "submittedStudents": 10, "avgNormalizedScore": 62.7}], "generatedAt": "2026-05-01T06:50:10.705Z", "chapterTrend": [{"order": 0, "title": "理财基础概念", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "instanceCount": 7, "completionRate": 0.184, "latestActivityAt": "2026-04-30T08:52:12.856Z", "avgNormalizedScore": 62.7}, {"order": 1, "title": "投资工具入门", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "instanceCount": 1, "completionRate": 0.1, "latestActivityAt": "2026-05-01T05:17:40.926Z", "avgNormalizedScore": null}, {"order": 2, "title": "风险与资产配置", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1", "instanceCount": 1, "completionRate": 0, "latestActivityAt": "2026-04-22T06:54:51.515Z", "avgNormalizedScore": null}], "studentGrowth": [{"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": 48, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "improvement": 7, "studentName": "王五", "attemptCount": 3, "selectedScore": 41.7, "firstSubmittedAt": "2026-04-30T00:36:06.158Z", "latestSubmittedAt": "2026-04-30T02:06:06.158Z", "completedInstances": 3}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": 62, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "improvement": 3, "studentName": "李四", "attemptCount": 3, "selectedScore": 58.3, "firstSubmittedAt": "2026-04-30T00:28:06.158Z", "latestSubmittedAt": "2026-04-30T01:58:06.158Z", "completedInstances": 3}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": 90, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "improvement": -2, "studentName": "张三", "attemptCount": 3, "selectedScore": 88, "firstSubmittedAt": "2026-04-30T00:20:06.158Z", "latestSubmittedAt": "2026-04-30T01:50:06.158Z", "completedInstances": 3}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "improvement": null, "studentName": "alex", "attemptCount": 1, "selectedScore": null, "firstSubmittedAt": null, "latestSubmittedAt": null, "completedInstances": 0}]}, "actionItems": [{"type": "low_completion", "title": "个人理财基础概念测验 完成率偏低", "metric": 0, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b"}, {"type": "low_completion", "title": "深度测试 完成率偏低", "metric": 0, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a"}, {"type": "low_completion", "title": "PDF导入测验 完成率偏低", "metric": 0, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb"}, {"type": "low_completion", "title": "个人投资组合分析报告 完成率偏低", "metric": 0.1, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe"}, {"type": "low_completion", "title": "理财基础知识随堂测验 完成率偏低", "metric": 0, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74"}, {"type": "low_completion", "title": "客户理财咨询模拟练习 完成率偏低", "metric": 0, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1", "instanceId": "f504facb-1d2b-4fcd-b04e-36182cbd88bb"}, {"type": "weak_concept", "title": "风险承受能力 需要关注", "metric": 2, "severity": "medium"}, {"type": "weak_concept", "title": "风险收益权衡 需要关注", "metric": 2, "severity": "medium"}], "filterOptions": {"classes": [{"id": "deedd844-e302-4b20-903d-d9b1d0e12439", "name": "金融2024A班"}], "chapters": [{"id": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "order": 0, "title": "理财基础概念"}, {"id": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "order": 1, "title": "投资工具入门"}, {"id": "c80664af-66db-4127-bd6a-46bb15513be1", "order": 2, "title": "风险与资产配置"}], "sections": [{"id": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "order": 0, "title": "什么是个人理财", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443"}, {"id": "65053639-55f2-44bd-9f44-65a6d7d60bb3", "order": 1, "title": "财务目标设定", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443"}, {"id": "43e8371f-14b4-476d-9afe-20613d0c9485", "order": 2, "title": "收支管理", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443"}, {"id": "43058dc8-2254-4403-9c01-4d968546cb01", "order": 0, "title": "银行存款与理财", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb"}, {"id": "fa7a864c-0bd5-4bd2-8a76-293910c0a161", "order": 1, "title": "基金投资基础", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb"}, {"id": "4a2eddb9-b30f-44e9-b902-4ddaf64690b2", "order": 2, "title": "股票投资入门", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb"}, {"id": "d4a078e7-6fab-4101-9163-36d3168a2c73", "order": 0, "title": "风险认知与评估", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1"}, {"id": "765148b3-8a2d-42cd-93a3-46b47360f280", "order": 1, "title": "资产配置策略", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1"}], "taskTypes": [{"count": 5, "label": "测验", "value": "quiz"}, {"count": 2, "label": "模拟对话", "value": "simulation"}, {"count": 2, "label": "主观题", "value": "subjective"}], "taskInstances": [{"id": "449ae28c-8913-43f5-adda-dc296885071b", "title": "个人理财基础概念测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a"}, {"id": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "title": "[QA-V2-202604300250] 客户风险沟通模拟", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "simulation", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a"}, {"id": "57c9940b-4d55-4760-9697-2d88d1c40933", "title": "[QA-V2-202604300250] 家庭预算分析报告", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "subjective", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a"}, {"id": "b7ca71ef-7239-4844-b0bd-29e1b444be61", "title": "[QA-V2-202604300250] 风险收益基础测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a"}, {"id": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "title": "深度测试", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a"}, {"id": "7db59a62-e806-44c6-b102-e767f61ed8bb", "title": "PDF导入测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a"}, {"id": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "title": "个人投资组合分析报告", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "subjective", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "className": "金融2024A班", "sectionId": "fa7a864c-0bd5-4bd2-8a76-293910c0a161"}, {"id": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "title": "理财基础知识随堂测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "43e8371f-14b4-476d-9afe-20613d0c9485"}, {"id": "f504facb-1d2b-4fcd-b04e-36182cbd88bb", "title": "客户理财咨询模拟练习", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "simulation", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1", "className": "金融2024A班", "sectionId": "765148b3-8a2d-42cd-93a3-46b47360f280"}]}, "weeklyInsight": {"mode": "local_fallback", "label": "本地生成/待 AI 增强", "risks": [{"id": "risk-low-completion", "title": "存在未完成风险", "detail": "个人理财基础概念测验 完成率偏低，建议先确认学生是否知道提交入口、截止时间和补交通道。", "evidence": "完成率 0%", "severity": "high"}, {"id": "risk-weak-concept", "title": "共性薄弱点已出现", "detail": "风险承受能力 需要关注，适合用板书或例题把关键步骤重新拆开。", "evidence": "2 人次相关信号", "severity": "medium"}, {"id": "risk-student-intervention", "title": "部分学生需要单独跟进", "detail": "干预名单中包含未完成、低掌握或退步学生，建议按原因分组处理。", "evidence": "未完成 50 人次，低掌握 0 人次，退步 0 人次", "severity": "high"}], "highlights": [{"id": "overall-progress", "title": "整体进度已汇总", "detail": "当前范围覆盖 9 个实例，完成率 14.5%，归一化均分 62.7%。", "evidence": "10/69 人次完成，9 人次已评分", "severity": "info"}, {"id": "strongest-chapter", "title": "理财基础概念 掌握较好", "detail": "该章节均分 62.7%，可作为后续讲评中的正向样例来源。", "evidence": "9/49 人次完成", "severity": "info"}], "generatedAt": "2026-05-01T06:50:10.705Z", "recommendations": [{"id": "recommend-completion-followup", "title": "先补齐未完成学生", "detail": "按班级点名跟进未完成名单，给出明确补交时间，并在下一节课前检查是否补齐。", "evidence": "低完成率会影响后续掌握度判断", "severity": "high"}, {"id": "recommend-quiz-review", "title": "针对低正确率题目讲评", "detail": "优先讲评 Q0，让学生说明选择依据，再补充一题同考点变式。", "evidence": "正确率 33.3%，得分率 33.3%", "severity": "medium"}, {"id": "recommend-rubric-review", "title": "用评分维度对齐作答标准", "detail": "围绕“风险收益解释”展示一份达标样例和一份待修改样例，帮助学生看清得分要求。", "evidence": "低分 2 人，平均得分率 57.1%", "severity": "medium"}, {"id": "recommend-student-groups", "title": "分组推进学生干预", "detail": "未完成学生先补交，低掌握学生做订正和二次练习，退步学生单独询问最近学习卡点。", "evidence": "50 条干预记录", "severity": "medium"}]}, "quizDiagnostics": [{"order": 0, "prompt": "家庭理财中，风险承受能力主要用于判断什么？", "weakTags": ["风险承受能力", "现金流管理"], "questionId": "68703099-8392-4bd2-85f7-97977bc1db0d", "correctRate": 0.333, "avgScoreRate": 33.3, "unansweredRate": 0}, {"order": 1, "prompt": "简述紧急备用金在个人理财中的作用。", "weakTags": ["风险承受能力", "现金流管理"], "questionId": "22679edc-b728-4fca-9218-70241082652d", "correctRate": 0.333, "avgScoreRate": 63.3, "unansweredRate": 0.333}], "dataQualityFlags": [{"id": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11:out-of-assignment-submissions", "title": "存在非分配学生提交", "detail": "部分提交不属于该任务实例的班级或分组学生，已从诊断统计中排除；请核对测试账号或班级绑定。", "metric": 1, "category": "assignment", "entityId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "rawValue": "1 次提交", "severity": "warning", "entityType": "instance", "entityLabel": "[QA-V2-202604300250] 客户风险沟通模拟 · 金融2024A班"}, {"id": "57c9940b-4d55-4760-9697-2d88d1c40933:out-of-assignment-submissions", "title": "存在非分配学生提交", "detail": "部分提交不属于该任务实例的班级或分组学生，已从诊断统计中排除；请核对测试账号或班级绑定。", "metric": 1, "category": "assignment", "entityId": "57c9940b-4d55-4760-9697-2d88d1c40933", "rawValue": "1 次提交", "severity": "warning", "entityType": "instance", "entityLabel": "[QA-V2-202604300250] 家庭预算分析报告 · 金融2024A班"}, {"id": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe:sample-too-small", "title": "样本量较小", "detail": "当前范围内有效提交少于 3 人，均分、题目正确率和 rubric 低分率更适合做个案参考，不宜直接下班级结论。", "metric": 1, "category": "sample", "entityId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "severity": "info", "entityType": "instance", "entityLabel": "个人投资组合分析报告 · 金融2024A班"}], "chapterDiagnostics": [{"title": "理财基础概念", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "weaknesses": [{"tag": "风险承受能力", "count": 2}, {"tag": "风险收益权衡", "count": 2}, {"tag": "客户需求澄清", "count": 2}, {"tag": "现金流管理", "count": 2}, {"tag": "预算管理", "count": 2}, {"tag": "资产配置", "count": 2}], "instanceCount": 7, "completionRate": 0.184, "assignedStudents": 49, "submittedStudents": 9, "avgNormalizedScore": 62.7}, {"title": "投资工具入门", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "weaknesses": [], "instanceCount": 1, "completionRate": 0.1, "assignedStudents": 10, "submittedStudents": 1, "avgNormalizedScore": null}, {"title": "风险与资产配置", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1", "weaknesses": [], "instanceCount": 1, "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null}], "chapterClassHeatmap": [{"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "chapterTitle": "理财基础概念", "completionRate": 0.184, "assignedStudents": 49, "submittedStudents": 9, "avgNormalizedScore": 62.7}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "className": "金融2024A班", "chapterTitle": "投资工具入门", "completionRate": 0.1, "assignedStudents": 10, "submittedStudents": 1, "avgNormalizedScore": null}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1", "className": "金融2024A班", "chapterTitle": "风险与资产配置", "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null}], "instanceDiagnostics": [{"title": "个人理财基础概念测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": null, "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "weaknesses": [], "attemptCount": 0, "chapterTitle": "理财基础概念", "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null, "medianNormalizedScore": null}, {"title": "[QA-V2-202604300250] 客户风险沟通模拟", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": 0.333, "taskType": "simulation", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "instanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "weaknesses": [{"tag": "风险收益权衡", "count": 2}, {"tag": "客户需求澄清", "count": 2}, {"tag": "资产配置", "count": 2}], "attemptCount": 3, "chapterTitle": "理财基础概念", "completionRate": 1, "assignedStudents": 3, "submittedStudents": 3, "avgNormalizedScore": 62.7, "medianNormalizedScore": 58}, {"title": "[QA-V2-202604300250] 家庭预算分析报告", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": 0.667, "taskType": "subjective", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "instanceId": "57c9940b-4d55-4760-9697-2d88d1c40933", "weaknesses": [{"tag": "现金流管理", "count": 2}, {"tag": "预算管理", "count": 2}], "attemptCount": 3, "chapterTitle": "理财基础概念", "completionRate": 1, "assignedStudents": 3, "submittedStudents": 3, "avgNormalizedScore": 65.3, "medianNormalizedScore": 62}, {"title": "[QA-V2-202604300250] 风险收益基础测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": 0.333, "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "instanceId": "b7ca71ef-7239-4844-b0bd-29e1b444be61", "weaknesses": [{"tag": "风险承受能力", "count": 2}, {"tag": "现金流管理", "count": 2}], "attemptCount": 3, "chapterTitle": "理财基础概念", "completionRate": 1, "assignedStudents": 3, "submittedStudents": 3, "avgNormalizedScore": 60, "medianNormalizedScore": 55}, {"title": "深度测试", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": null, "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "weaknesses": [], "attemptCount": 0, "chapterTitle": "理财基础概念", "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null, "medianNormalizedScore": null}, {"title": "PDF导入测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": null, "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "weaknesses": [], "attemptCount": 0, "chapterTitle": "理财基础概念", "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null, "medianNormalizedScore": null}, {"title": "个人投资组合分析报告", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": null, "taskType": "subjective", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "className": "金融2024A班", "sectionId": "fa7a864c-0bd5-4bd2-8a76-293910c0a161", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "weaknesses": [], "attemptCount": 1, "chapterTitle": "投资工具入门", "completionRate": 0.1, "assignedStudents": 10, "submittedStudents": 1, "avgNormalizedScore": null, "medianNormalizedScore": null}, {"title": "理财基础知识随堂测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": null, "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "43e8371f-14b4-476d-9afe-20613d0c9485", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "weaknesses": [], "attemptCount": 0, "chapterTitle": "理财基础概念", "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null, "medianNormalizedScore": null}, {"title": "客户理财咨询模拟练习", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": null, "taskType": "simulation", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1", "className": "金融2024A班", "sectionId": "765148b3-8a2d-42cd-93a3-46b47360f280", "instanceId": "f504facb-1d2b-4fcd-b04e-36182cbd88bb", "weaknesses": [], "attemptCount": 0, "chapterTitle": "风险与资产配置", "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null, "medianNormalizedScore": null}], "studentInterventions": [{"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "王五", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "张三", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "赵六", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "alex", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "belle", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "32575dd0-e927-408b-ba9f-7f003bfd60d6", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "charlie", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "db2cbb54-e58f-4a0a-8afe-d7333a592981", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "dexter", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "62235d2c-a740-4db0-93e7-e28251354cba", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "QA 测试", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "77cd55ef-e239-4407-9998-a583386767ff", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "r2 验证用户", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "王五", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "张三", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "赵六", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "alex", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "belle", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "32575dd0-e927-408b-ba9f-7f003bfd60d6", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "charlie", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "db2cbb54-e58f-4a0a-8afe-d7333a592981", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "dexter", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "62235d2c-a740-4db0-93e7-e28251354cba", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "QA 测试", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "77cd55ef-e239-4407-9998-a583386767ff", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "r2 验证用户", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "王五", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "张三", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "赵六", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "alex", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "belle", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "32575dd0-e927-408b-ba9f-7f003bfd60d6", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "charlie", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "db2cbb54-e58f-4a0a-8afe-d7333a592981", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "dexter", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "62235d2c-a740-4db0-93e7-e28251354cba", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "QA 测试", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "77cd55ef-e239-4407-9998-a583386767ff", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "r2 验证用户", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "王五", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "张三", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "赵六", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "belle", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "32575dd0-e927-408b-ba9f-7f003bfd60d6", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "charlie", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "db2cbb54-e58f-4a0a-8afe-d7333a592981", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "dexter", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "62235d2c-a740-4db0-93e7-e28251354cba", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "QA 测试", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "77cd55ef-e239-4407-9998-a583386767ff", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "r2 验证用户", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "王五", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "张三", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "赵六", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "alex", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "belle", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "32575dd0-e927-408b-ba9f-7f003bfd60d6", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "charlie", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "db2cbb54-e58f-4a0a-8afe-d7333a592981", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "dexter", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "62235d2c-a740-4db0-93e7-e28251354cba", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "QA 测试", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "77cd55ef-e239-4407-9998-a583386767ff", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "r2 验证用户", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "f504facb-1d2b-4fcd-b04e-36182cbd88bb", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "客户理财咨询模拟练习", "selectedScore": null}], "simulationDiagnostics": [{"criterionId": "4634e35f-1e8b-4cc2-a20f-ca92bb6503ab", "avgScoreRate": 57.1, "weakStudents": [{"studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "studentName": "李四"}, {"studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "studentName": "王五"}], "criterionName": "风险收益解释", "lowScoreCount": 2, "sampleComments": ["风险收益解释 需要加强", "风险收益解释 需要加强"]}, {"criterionId": "f25293a6-b51f-46b4-8f14-3202fd59f4da", "avgScoreRate": 57.1, "weakStudents": [{"studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "studentName": "李四"}, {"studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "studentName": "王五"}], "criterionName": "需求澄清", "lowScoreCount": 2, "sampleComments": ["需求澄清 需要加强", "需求澄清 需要加强"]}, {"criterionId": "65723ff6-df90-4214-ad5e-758c04c22a81", "avgScoreRate": 62.2, "weakStudents": [{"studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "studentName": "李四"}, {"studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "studentName": "王五"}], "criterionName": "建议可执行性", "lowScoreCount": 2, "sampleComments": ["建议可执行性 基本达标", "建议可执行性 维度较弱"]}, {"criterionId": "83e07f7e-5295-4f1c-afcb-6ce974ec6183", "avgScoreRate": 70, "weakStudents": [{"studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "studentName": "王五"}], "criterionName": "收支识别", "lowScoreCount": 1, "sampleComments": ["收支识别 维度较弱"]}, {"criterionId": "9bebad25-3669-41b7-ae57-6826d66047be", "avgScoreRate": 75.6, "weakStudents": [], "criterionName": "行动建议", "lowScoreCount": 0, "sampleComments": []}]}	\N	1	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-01 06:50:10.635	2026-05-01 06:50:10.835	2026-05-01 06:50:10.57	2026-05-01 06:50:10.847
e449d095-8a44-4891-bd23-2d4a474d310f	knowledge_source_ingest	succeeded	CourseKnowledgeSource	a67de771-1a52-40dd-9e88-234eba4245be	100	{"sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}	{"status": "ready", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be", "textLength": 2331}	\N	1	3	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-02 07:22:12.796	2026-05-02 07:22:37.023	2026-05-02 07:22:12.781	2026-05-02 07:22:37.024
3bdb14f2-80a5-48d3-af29-f94f9eb4af94	analytics_recompute	succeeded	AnalyticsV2Diagnosis	e6fc049c-756f-4442-86da-35a6cdbadd6e	100	{"range": null, "classId": null, "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "taskType": null, "chapterId": null, "sectionId": null, "scorePolicy": null, "taskInstanceId": null}	{"kpis": {"passRate": 0.444, "attemptCount": 10, "instanceCount": 9, "completionRate": 0.145, "gradedStudents": 9, "submissionCount": 10, "assignedStudents": 69, "submittedStudents": 10, "avgNormalizedScore": 62.7, "medianNormalizedScore": 58}, "scope": {"range": "term", "classId": null, "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "taskType": null, "chapterId": null, "sectionId": null, "courseTitle": "个人理财规划", "generatedAt": "2026-05-01T06:51:03.070Z", "scorePolicy": "latest", "taskInstanceId": null}, "trends": {"range": "term", "classTrend": [{"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "className": "金融2024A班", "instanceCount": 9, "completionRate": 0.145, "assignedStudents": 69, "latestActivityAt": "2026-05-01T05:17:40.926Z", "submittedStudents": 10, "avgNormalizedScore": 62.7}], "generatedAt": "2026-05-01T06:51:03.070Z", "chapterTrend": [{"order": 0, "title": "理财基础概念", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "instanceCount": 7, "completionRate": 0.184, "latestActivityAt": "2026-04-30T08:52:12.856Z", "avgNormalizedScore": 62.7}, {"order": 1, "title": "投资工具入门", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "instanceCount": 1, "completionRate": 0.1, "latestActivityAt": "2026-05-01T05:17:40.926Z", "avgNormalizedScore": null}, {"order": 2, "title": "风险与资产配置", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1", "instanceCount": 1, "completionRate": 0, "latestActivityAt": "2026-04-22T06:54:51.515Z", "avgNormalizedScore": null}], "studentGrowth": [{"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": 48, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "improvement": 7, "studentName": "王五", "attemptCount": 3, "selectedScore": 41.7, "firstSubmittedAt": "2026-04-30T00:36:06.158Z", "latestSubmittedAt": "2026-04-30T02:06:06.158Z", "completedInstances": 3}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": 62, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "improvement": 3, "studentName": "李四", "attemptCount": 3, "selectedScore": 58.3, "firstSubmittedAt": "2026-04-30T00:28:06.158Z", "latestSubmittedAt": "2026-04-30T01:58:06.158Z", "completedInstances": 3}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": 90, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "improvement": -2, "studentName": "张三", "attemptCount": 3, "selectedScore": 88, "firstSubmittedAt": "2026-04-30T00:20:06.158Z", "latestSubmittedAt": "2026-04-30T01:50:06.158Z", "completedInstances": 3}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "improvement": null, "studentName": "alex", "attemptCount": 1, "selectedScore": null, "firstSubmittedAt": null, "latestSubmittedAt": null, "completedInstances": 0}]}, "actionItems": [{"type": "low_completion", "title": "个人理财基础概念测验 完成率偏低", "metric": 0, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b"}, {"type": "low_completion", "title": "深度测试 完成率偏低", "metric": 0, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a"}, {"type": "low_completion", "title": "PDF导入测验 完成率偏低", "metric": 0, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb"}, {"type": "low_completion", "title": "个人投资组合分析报告 完成率偏低", "metric": 0.1, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe"}, {"type": "low_completion", "title": "理财基础知识随堂测验 完成率偏低", "metric": 0, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74"}, {"type": "low_completion", "title": "客户理财咨询模拟练习 完成率偏低", "metric": 0, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1", "instanceId": "f504facb-1d2b-4fcd-b04e-36182cbd88bb"}, {"type": "weak_concept", "title": "风险承受能力 需要关注", "metric": 2, "severity": "medium"}, {"type": "weak_concept", "title": "风险收益权衡 需要关注", "metric": 2, "severity": "medium"}], "filterOptions": {"classes": [{"id": "deedd844-e302-4b20-903d-d9b1d0e12439", "name": "金融2024A班"}], "chapters": [{"id": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "order": 0, "title": "理财基础概念"}, {"id": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "order": 1, "title": "投资工具入门"}, {"id": "c80664af-66db-4127-bd6a-46bb15513be1", "order": 2, "title": "风险与资产配置"}], "sections": [{"id": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "order": 0, "title": "什么是个人理财", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443"}, {"id": "65053639-55f2-44bd-9f44-65a6d7d60bb3", "order": 1, "title": "财务目标设定", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443"}, {"id": "43e8371f-14b4-476d-9afe-20613d0c9485", "order": 2, "title": "收支管理", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443"}, {"id": "43058dc8-2254-4403-9c01-4d968546cb01", "order": 0, "title": "银行存款与理财", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb"}, {"id": "fa7a864c-0bd5-4bd2-8a76-293910c0a161", "order": 1, "title": "基金投资基础", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb"}, {"id": "4a2eddb9-b30f-44e9-b902-4ddaf64690b2", "order": 2, "title": "股票投资入门", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb"}, {"id": "d4a078e7-6fab-4101-9163-36d3168a2c73", "order": 0, "title": "风险认知与评估", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1"}, {"id": "765148b3-8a2d-42cd-93a3-46b47360f280", "order": 1, "title": "资产配置策略", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1"}], "taskTypes": [{"count": 5, "label": "测验", "value": "quiz"}, {"count": 2, "label": "模拟对话", "value": "simulation"}, {"count": 2, "label": "主观题", "value": "subjective"}], "taskInstances": [{"id": "449ae28c-8913-43f5-adda-dc296885071b", "title": "个人理财基础概念测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a"}, {"id": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "title": "[QA-V2-202604300250] 客户风险沟通模拟", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "simulation", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a"}, {"id": "57c9940b-4d55-4760-9697-2d88d1c40933", "title": "[QA-V2-202604300250] 家庭预算分析报告", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "subjective", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a"}, {"id": "b7ca71ef-7239-4844-b0bd-29e1b444be61", "title": "[QA-V2-202604300250] 风险收益基础测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a"}, {"id": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "title": "深度测试", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a"}, {"id": "7db59a62-e806-44c6-b102-e767f61ed8bb", "title": "PDF导入测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a"}, {"id": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "title": "个人投资组合分析报告", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "subjective", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "className": "金融2024A班", "sectionId": "fa7a864c-0bd5-4bd2-8a76-293910c0a161"}, {"id": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "title": "理财基础知识随堂测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "43e8371f-14b4-476d-9afe-20613d0c9485"}, {"id": "f504facb-1d2b-4fcd-b04e-36182cbd88bb", "title": "客户理财咨询模拟练习", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "simulation", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1", "className": "金融2024A班", "sectionId": "765148b3-8a2d-42cd-93a3-46b47360f280"}]}, "weeklyInsight": {"mode": "local_fallback", "label": "本地生成/待 AI 增强", "risks": [{"id": "risk-low-completion", "title": "存在未完成风险", "detail": "个人理财基础概念测验 完成率偏低，建议先确认学生是否知道提交入口、截止时间和补交通道。", "evidence": "完成率 0%", "severity": "high"}, {"id": "risk-weak-concept", "title": "共性薄弱点已出现", "detail": "风险承受能力 需要关注，适合用板书或例题把关键步骤重新拆开。", "evidence": "2 人次相关信号", "severity": "medium"}, {"id": "risk-student-intervention", "title": "部分学生需要单独跟进", "detail": "干预名单中包含未完成、低掌握或退步学生，建议按原因分组处理。", "evidence": "未完成 50 人次，低掌握 0 人次，退步 0 人次", "severity": "high"}], "highlights": [{"id": "overall-progress", "title": "整体进度已汇总", "detail": "当前范围覆盖 9 个实例，完成率 14.5%，归一化均分 62.7%。", "evidence": "10/69 人次完成，9 人次已评分", "severity": "info"}, {"id": "strongest-chapter", "title": "理财基础概念 掌握较好", "detail": "该章节均分 62.7%，可作为后续讲评中的正向样例来源。", "evidence": "9/49 人次完成", "severity": "info"}], "generatedAt": "2026-05-01T06:51:03.070Z", "recommendations": [{"id": "recommend-completion-followup", "title": "先补齐未完成学生", "detail": "按班级点名跟进未完成名单，给出明确补交时间，并在下一节课前检查是否补齐。", "evidence": "低完成率会影响后续掌握度判断", "severity": "high"}, {"id": "recommend-quiz-review", "title": "针对低正确率题目讲评", "detail": "优先讲评 Q0，让学生说明选择依据，再补充一题同考点变式。", "evidence": "正确率 33.3%，得分率 33.3%", "severity": "medium"}, {"id": "recommend-rubric-review", "title": "用评分维度对齐作答标准", "detail": "围绕“风险收益解释”展示一份达标样例和一份待修改样例，帮助学生看清得分要求。", "evidence": "低分 2 人，平均得分率 57.1%", "severity": "medium"}, {"id": "recommend-student-groups", "title": "分组推进学生干预", "detail": "未完成学生先补交，低掌握学生做订正和二次练习，退步学生单独询问最近学习卡点。", "evidence": "50 条干预记录", "severity": "medium"}]}, "quizDiagnostics": [{"order": 0, "prompt": "家庭理财中，风险承受能力主要用于判断什么？", "weakTags": ["风险承受能力", "现金流管理"], "questionId": "68703099-8392-4bd2-85f7-97977bc1db0d", "correctRate": 0.333, "avgScoreRate": 33.3, "unansweredRate": 0}, {"order": 1, "prompt": "简述紧急备用金在个人理财中的作用。", "weakTags": ["风险承受能力", "现金流管理"], "questionId": "22679edc-b728-4fca-9218-70241082652d", "correctRate": 0.333, "avgScoreRate": 63.3, "unansweredRate": 0.333}], "dataQualityFlags": [{"id": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11:out-of-assignment-submissions", "title": "存在非分配学生提交", "detail": "部分提交不属于该任务实例的班级或分组学生，已从诊断统计中排除；请核对测试账号或班级绑定。", "metric": 1, "category": "assignment", "entityId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "rawValue": "1 次提交", "severity": "warning", "entityType": "instance", "entityLabel": "[QA-V2-202604300250] 客户风险沟通模拟 · 金融2024A班"}, {"id": "57c9940b-4d55-4760-9697-2d88d1c40933:out-of-assignment-submissions", "title": "存在非分配学生提交", "detail": "部分提交不属于该任务实例的班级或分组学生，已从诊断统计中排除；请核对测试账号或班级绑定。", "metric": 1, "category": "assignment", "entityId": "57c9940b-4d55-4760-9697-2d88d1c40933", "rawValue": "1 次提交", "severity": "warning", "entityType": "instance", "entityLabel": "[QA-V2-202604300250] 家庭预算分析报告 · 金融2024A班"}, {"id": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe:sample-too-small", "title": "样本量较小", "detail": "当前范围内有效提交少于 3 人，均分、题目正确率和 rubric 低分率更适合做个案参考，不宜直接下班级结论。", "metric": 1, "category": "sample", "entityId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "severity": "info", "entityType": "instance", "entityLabel": "个人投资组合分析报告 · 金融2024A班"}], "chapterDiagnostics": [{"title": "理财基础概念", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "weaknesses": [{"tag": "风险承受能力", "count": 2}, {"tag": "风险收益权衡", "count": 2}, {"tag": "客户需求澄清", "count": 2}, {"tag": "现金流管理", "count": 2}, {"tag": "预算管理", "count": 2}, {"tag": "资产配置", "count": 2}], "instanceCount": 7, "completionRate": 0.184, "assignedStudents": 49, "submittedStudents": 9, "avgNormalizedScore": 62.7}, {"title": "投资工具入门", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "weaknesses": [], "instanceCount": 1, "completionRate": 0.1, "assignedStudents": 10, "submittedStudents": 1, "avgNormalizedScore": null}, {"title": "风险与资产配置", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1", "weaknesses": [], "instanceCount": 1, "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null}], "chapterClassHeatmap": [{"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "chapterTitle": "理财基础概念", "completionRate": 0.184, "assignedStudents": 49, "submittedStudents": 9, "avgNormalizedScore": 62.7}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "className": "金融2024A班", "chapterTitle": "投资工具入门", "completionRate": 0.1, "assignedStudents": 10, "submittedStudents": 1, "avgNormalizedScore": null}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1", "className": "金融2024A班", "chapterTitle": "风险与资产配置", "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null}], "instanceDiagnostics": [{"title": "个人理财基础概念测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": null, "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "weaknesses": [], "attemptCount": 0, "chapterTitle": "理财基础概念", "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null, "medianNormalizedScore": null}, {"title": "[QA-V2-202604300250] 客户风险沟通模拟", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": 0.333, "taskType": "simulation", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "instanceId": "c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11", "weaknesses": [{"tag": "风险收益权衡", "count": 2}, {"tag": "客户需求澄清", "count": 2}, {"tag": "资产配置", "count": 2}], "attemptCount": 3, "chapterTitle": "理财基础概念", "completionRate": 1, "assignedStudents": 3, "submittedStudents": 3, "avgNormalizedScore": 62.7, "medianNormalizedScore": 58}, {"title": "[QA-V2-202604300250] 家庭预算分析报告", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": 0.667, "taskType": "subjective", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "instanceId": "57c9940b-4d55-4760-9697-2d88d1c40933", "weaknesses": [{"tag": "现金流管理", "count": 2}, {"tag": "预算管理", "count": 2}], "attemptCount": 3, "chapterTitle": "理财基础概念", "completionRate": 1, "assignedStudents": 3, "submittedStudents": 3, "avgNormalizedScore": 65.3, "medianNormalizedScore": 62}, {"title": "[QA-V2-202604300250] 风险收益基础测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": 0.333, "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "instanceId": "b7ca71ef-7239-4844-b0bd-29e1b444be61", "weaknesses": [{"tag": "风险承受能力", "count": 2}, {"tag": "现金流管理", "count": 2}], "attemptCount": 3, "chapterTitle": "理财基础概念", "completionRate": 1, "assignedStudents": 3, "submittedStudents": 3, "avgNormalizedScore": 60, "medianNormalizedScore": 55}, {"title": "深度测试", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": null, "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "weaknesses": [], "attemptCount": 0, "chapterTitle": "理财基础概念", "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null, "medianNormalizedScore": null}, {"title": "PDF导入测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": null, "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "weaknesses": [], "attemptCount": 0, "chapterTitle": "理财基础概念", "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null, "medianNormalizedScore": null}, {"title": "个人投资组合分析报告", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": null, "taskType": "subjective", "chapterId": "3e7e8bac-c2a8-4da8-9065-87c2d77a32bb", "className": "金融2024A班", "sectionId": "fa7a864c-0bd5-4bd2-8a76-293910c0a161", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "weaknesses": [], "attemptCount": 1, "chapterTitle": "投资工具入门", "completionRate": 0.1, "assignedStudents": 10, "submittedStudents": 1, "avgNormalizedScore": null, "medianNormalizedScore": null}, {"title": "理财基础知识随堂测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": null, "taskType": "quiz", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "className": "金融2024A班", "sectionId": "43e8371f-14b4-476d-9afe-20613d0c9485", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "weaknesses": [], "attemptCount": 0, "chapterTitle": "理财基础概念", "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null, "medianNormalizedScore": null}, {"title": "客户理财咨询模拟练习", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": null, "taskType": "simulation", "chapterId": "c80664af-66db-4127-bd6a-46bb15513be1", "className": "金融2024A班", "sectionId": "765148b3-8a2d-42cd-93a3-46b47360f280", "instanceId": "f504facb-1d2b-4fcd-b04e-36182cbd88bb", "weaknesses": [], "attemptCount": 0, "chapterTitle": "风险与资产配置", "completionRate": 0, "assignedStudents": 10, "submittedStudents": 0, "avgNormalizedScore": null, "medianNormalizedScore": null}], "studentInterventions": [{"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "王五", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "张三", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "赵六", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "alex", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "belle", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "32575dd0-e927-408b-ba9f-7f003bfd60d6", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "charlie", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "db2cbb54-e58f-4a0a-8afe-d7333a592981", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "dexter", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "62235d2c-a740-4db0-93e7-e28251354cba", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "QA 测试", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "77cd55ef-e239-4407-9998-a583386767ff", "instanceId": "449ae28c-8913-43f5-adda-dc296885071b", "improvement": null, "studentName": "r2 验证用户", "attemptCount": 0, "instanceTitle": "个人理财基础概念测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "王五", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "张三", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "赵六", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "alex", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "belle", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "32575dd0-e927-408b-ba9f-7f003bfd60d6", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "charlie", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "db2cbb54-e58f-4a0a-8afe-d7333a592981", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "dexter", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "62235d2c-a740-4db0-93e7-e28251354cba", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "QA 测试", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "77cd55ef-e239-4407-9998-a583386767ff", "instanceId": "a7d9b380-49fd-4ce2-9d95-000935ac0c5a", "improvement": null, "studentName": "r2 验证用户", "attemptCount": 0, "instanceTitle": "深度测试", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "王五", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "张三", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "赵六", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "alex", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "belle", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "32575dd0-e927-408b-ba9f-7f003bfd60d6", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "charlie", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "db2cbb54-e58f-4a0a-8afe-d7333a592981", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "dexter", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "62235d2c-a740-4db0-93e7-e28251354cba", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "QA 测试", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "77cd55ef-e239-4407-9998-a583386767ff", "instanceId": "7db59a62-e806-44c6-b102-e767f61ed8bb", "improvement": null, "studentName": "r2 验证用户", "attemptCount": 0, "instanceTitle": "PDF导入测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "王五", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "张三", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "赵六", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "belle", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "32575dd0-e927-408b-ba9f-7f003bfd60d6", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "charlie", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "db2cbb54-e58f-4a0a-8afe-d7333a592981", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "dexter", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "62235d2c-a740-4db0-93e7-e28251354cba", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "QA 测试", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "77cd55ef-e239-4407-9998-a583386767ff", "instanceId": "a5d8f119-e3cd-426f-8ea9-e57f77608ffe", "improvement": null, "studentName": "r2 验证用户", "attemptCount": 0, "instanceTitle": "个人投资组合分析报告", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "王五", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "张三", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "赵六", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "alex", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "belle", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "32575dd0-e927-408b-ba9f-7f003bfd60d6", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "charlie", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "db2cbb54-e58f-4a0a-8afe-d7333a592981", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "dexter", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "62235d2c-a740-4db0-93e7-e28251354cba", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "QA 测试", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "77cd55ef-e239-4407-9998-a583386767ff", "instanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "improvement": null, "studentName": "r2 验证用户", "attemptCount": 0, "instanceTitle": "理财基础知识随堂测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "f504facb-1d2b-4fcd-b04e-36182cbd88bb", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "客户理财咨询模拟练习", "selectedScore": null}], "simulationDiagnostics": [{"criterionId": "4634e35f-1e8b-4cc2-a20f-ca92bb6503ab", "avgScoreRate": 57.1, "weakStudents": [{"studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "studentName": "李四"}, {"studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "studentName": "王五"}], "criterionName": "风险收益解释", "lowScoreCount": 2, "sampleComments": ["风险收益解释 需要加强", "风险收益解释 需要加强"]}, {"criterionId": "f25293a6-b51f-46b4-8f14-3202fd59f4da", "avgScoreRate": 57.1, "weakStudents": [{"studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "studentName": "李四"}, {"studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "studentName": "王五"}], "criterionName": "需求澄清", "lowScoreCount": 2, "sampleComments": ["需求澄清 需要加强", "需求澄清 需要加强"]}, {"criterionId": "65723ff6-df90-4214-ad5e-758c04c22a81", "avgScoreRate": 62.2, "weakStudents": [{"studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "studentName": "李四"}, {"studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "studentName": "王五"}], "criterionName": "建议可执行性", "lowScoreCount": 2, "sampleComments": ["建议可执行性 基本达标", "建议可执行性 维度较弱"]}, {"criterionId": "83e07f7e-5295-4f1c-afcb-6ce974ec6183", "avgScoreRate": 70, "weakStudents": [{"studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "studentName": "王五"}], "criterionName": "收支识别", "lowScoreCount": 1, "sampleComments": ["收支识别 维度较弱"]}, {"criterionId": "9bebad25-3669-41b7-ae57-6826d66047be", "avgScoreRate": 75.6, "weakStudents": [], "criterionName": "行动建议", "lowScoreCount": 0, "sampleComments": []}]}	\N	1	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-01 06:51:03.012	2026-05-01 06:51:03.34	2026-05-01 06:51:02.944	2026-05-01 06:51:03.351
176a19b2-d1d6-477f-a3f8-b128cb4371bf	knowledge_source_ingest	failed	CourseKnowledgeSource	3595d2bc-2dac-4024-8f13-0e14f3c13cfe	20	{"sourceId": "3595d2bc-2dac-4024-8f13-0e14f3c13cfe"}	\N	DOCUMENT_OCR_REQUIRED	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-14 06:38:53.803	2026-05-14 06:38:54.498	2026-05-14 06:38:53.787	2026-05-14 06:38:54.498
fc8e0275-4130-4c82-9e29-bdb913b8be6a	submission_grade	succeeded	Submission	32b9381c-8b6c-44cd-93ce-1d18b1049020	100	{"submissionId": "32b9381c-8b6c-44cd-93ce-1d18b1049020"}	{"score": "25", "status": "graded", "maxScore": "100", "submissionId": "32b9381c-8b6c-44cd-93ce-1d18b1049020"}	\N	1	3	edad1bc2-43ae-4598-8e12-1053ef4eb964	2026-05-02 09:33:29.512	2026-05-02 09:37:33.659	2026-05-02 09:33:29.5	2026-05-02 09:37:33.661
a3f8382a-3779-4c3d-a2d5-1ba390409b72	submission_grade	succeeded	Submission	17045c66-06a3-4d1f-866d-4dfe0cab7a51	100	{"retriedBy": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "submissionId": "17045c66-06a3-4d1f-866d-4dfe0cab7a51"}	{"score": "73", "status": "graded", "maxScore": "100", "submissionId": "17045c66-06a3-4d1f-866d-4dfe0cab7a51"}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-02 09:43:37.719	2026-05-02 09:45:01.509	2026-05-02 09:43:37.71	2026-05-02 09:45:01.51
38aedc94-a223-4a03-8c0e-59d31e6a6b58	submission_grade	succeeded	Submission	899deebd-fb2f-42d2-8c78-05883e61294a	100	{"submissionId": "899deebd-fb2f-42d2-8c78-05883e61294a"}	{"score": "20", "status": "graded", "maxScore": "100", "submissionId": "899deebd-fb2f-42d2-8c78-05883e61294a"}	\N	1	3	32575dd0-e927-408b-ba9f-7f003bfd60d6	2026-05-02 09:38:54.919	2026-05-02 09:40:18.133	2026-05-02 09:38:54.909	2026-05-02 09:40:18.134
7717c4d2-e3f0-4495-a980-949b6c9a0b3b	submission_grade	succeeded	Submission	ce7f935d-5ed0-4af0-9aeb-53a527de372c	100	{"submissionId": "ce7f935d-5ed0-4af0-9aeb-53a527de372c"}	{"score": "0", "status": "graded", "maxScore": "24", "submissionId": "ce7f935d-5ed0-4af0-9aeb-53a527de372c"}	\N	1	3	236c3795-f19f-4107-a681-0bc0e1d21d62	2026-05-02 09:45:12.845	2026-05-02 09:46:15.766	2026-05-02 09:45:12.839	2026-05-02 09:46:15.767
d016a43d-9a7c-49da-8d57-ac62d763256f	submission_grade	succeeded	Submission	4a3f639d-ab10-4d2c-bd74-9ac0f7cf5c4e	100	{"submissionId": "4a3f639d-ab10-4d2c-bd74-9ac0f7cf5c4e"}	{"score": "0", "status": "graded", "maxScore": "100", "submissionId": "4a3f639d-ab10-4d2c-bd74-9ac0f7cf5c4e"}	\N	1	3	236c3795-f19f-4107-a681-0bc0e1d21d62	2026-05-02 09:58:18.476	2026-05-02 10:04:16.449	2026-05-02 09:58:18.469	2026-05-02 10:04:16.45
54fbebf1-29e7-4178-8bf5-bb64ddd2e08d	knowledge_source_ingest	succeeded	CourseKnowledgeSource	46d57c02-b5bc-494a-a64e-ce67f6486d07	100	{"sourceId": "46d57c02-b5bc-494a-a64e-ce67f6486d07"}	{"status": "ready", "sourceId": "46d57c02-b5bc-494a-a64e-ce67f6486d07", "textLength": 190}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-02 13:50:04.82	2026-05-02 13:50:31.674	2026-05-02 13:50:04.805	2026-05-02 13:50:31.675
f1a88d1b-1105-4c6c-a770-dd1e72c2d827	knowledge_source_ingest	succeeded	CourseKnowledgeSource	b6243518-b534-4193-bc5e-3165db5489ca	100	{"sourceId": "b6243518-b534-4193-bc5e-3165db5489ca"}	{"status": "ready", "sourceId": "b6243518-b534-4193-bc5e-3165db5489ca", "textLength": 5163}	\N	1	3	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-02 15:17:48.237	2026-05-02 15:18:39.608	2026-05-02 15:17:48.23	2026-05-02 15:18:39.609
cf341ba7-5534-4bbd-909c-c11af8ca7828	data_insight_advice	succeeded	DataInsightAdvice	e6fc049c-756f-4442-86da-35a6cdbadd6e	100	{"courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "fingerprint": "6tke9w", "taskInstanceId": "b7ca71ef-7239-4844-b0bd-29e1b444be61"}	{"summary": "学生在风险收益基础测验中整体表现不佳，平均分60，通过率仅33.3%，两名学生分数低于60，且特定知识点掌握不足。", "fingerprint": "dbc5za", "focusGroups": ["低分学生王五和李四，需重点关注其知识短板", "在Q0和Q1上表现不佳的全体学生，需集体强化学习"], "generatedAt": "2026-05-02T17:36:49.436Z", "nextActions": ["安排复习课专项讲解Q0和Q1知识点，确保学生掌握", "为王五和李四提供一对一辅导，针对风险收益匹配与现金流解释", "更新教学材料，增加相关练习和案例，以强化薄弱环节"], "evidenceRefs": [{"id": "student:d6be46c1-1c04-46a7-a3ae-b493d25d4414", "label": "王五 · 金融2024A班", "detail": "支撑关注低分学生群体，需提供额外辅导以提升成绩。"}, {"id": "student:eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "label": "李四 · 金融2024A班", "detail": "支撑关注低分学生群体，需提供额外辅导以提升成绩。"}, {"id": "issue:quiz-68703099-8392-4bd2-85f7-97977bc1db0d", "label": "Q0 家庭理财中，风险承受能力主要用于判断什么？", "detail": "支撑知识目标中强化风险承受能力概念，因2名学生表现不佳。"}, {"id": "issue:quiz-22679edc-b728-4fca-9218-70241082652d", "label": "Q1 简述紧急备用金在个人理财中的作用。", "detail": "支撑知识目标中理解紧急备用金作用，因2名学生表现不佳。"}], "knowledgeGoals": ["强化风险承受能力概念的理解，以解决Q0问题", "深化紧急备用金在个人理财中的作用，以解决Q1问题", "加强风险收益匹配与现金流解释的教学，基于学生摘录反馈"], "teachingMethods": ["采用案例分析法讲解风险收益匹配，结合实际理财场景", "组织小组讨论紧急备用金的实际应用，提升学生参与度", "提供针对性练习和即时反馈，聚焦薄弱知识点"]}	\N	1	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-02 17:36:12.803	2026-05-02 17:36:49.44	2026-05-02 17:36:12.792	2026-05-02 17:36:49.441
6172a64b-f0e2-4cef-aaf1-9170afae4215	data_insight_advice	succeeded	DataInsightAdvice	e6fc049c-756f-4442-86da-35a6cdbadd6e	100	{"courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "fingerprint": "tuc58w", "taskInstanceId": "b7ca71ef-7239-4844-b0bd-29e1b444be61"}	{"summary": "学生在风险收益基础测验中完成率高但通过率低，平均分60，主要问题集中在风险承受能力和紧急备用金概念的理解上。", "fingerprint": "tuc58w", "focusGroups": ["风险学生王五和李四，需要额外辅导"], "generatedAt": "2026-05-02T17:39:19.763Z", "nextActions": ["安排针对风险承受能力和紧急备用金概念的复习课", "为王五和李四提供一对一辅导或补充学习材料"], "evidenceRefs": [{"id": "issue:quiz-68703099-8392-4bd2-85f7-97977bc1db0d", "label": "Q0 家庭理财中，风险承受能力主要用于判断什么？", "detail": "2名学生在此题表现不佳，表明该知识点需要加强教学，支撑知识目标建议。"}, {"id": "issue:quiz-22679edc-b728-4fca-9218-70241082652d", "label": "Q1 简述紧急备用金在个人理财中的作用。", "detail": "2名学生在此题表现不佳，表明该知识点需要强化，支撑知识目标建议。"}, {"id": "student:d6be46c1-1c04-46a7-a3ae-b493d25d4414", "label": "王五 · 金融2024A班", "detail": "得分35%，属于低分风险学生，需要重点关注，支撑关注群体和下一步动作。"}, {"id": "student:eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "label": "李四 · 金融2024A班", "detail": "得分55%，属于低分风险学生，需要额外辅导，支撑关注群体和下一步动作。"}], "knowledgeGoals": ["加强风险承受能力在家庭理财中判断应用的教学", "强化紧急备用金在个人理财中作用的理解"], "teachingMethods": ["针对Q0和Q1的薄弱环节进行专题讲解和案例分析", "采用互动教学方法，如小组讨论，以加深对风险收益匹配的理解"]}	\N	1	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-02 17:38:37.364	2026-05-02 17:39:19.767	2026-05-02 17:38:37.362	2026-05-02 17:39:19.768
7ccd30c2-f909-4432-b61b-30dc70ce2042	submission_grade	succeeded	Submission	a37cb4dc-2fce-4b18-9c04-381bb1d514cb	100	{"submissionId": "a37cb4dc-2fce-4b18-9c04-381bb1d514cb"}	{"score": "56", "status": "graded", "maxScore": "100", "submissionId": "a37cb4dc-2fce-4b18-9c04-381bb1d514cb"}	\N	1	3	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	2026-05-07 01:39:18.425	2026-05-07 01:39:42.466	2026-05-07 01:39:18.405	2026-05-07 01:39:42.467
64a34f6d-fc4b-4451-8add-8eed619b3c0c	analytics_recompute	succeeded	AnalyticsV2Diagnosis	00000000-0000-4000-8000-00000000a201	100	{"range": null, "classIds": ["deedd844-e302-4b20-903d-d9b1d0e12439"], "courseId": "00000000-0000-4000-8000-00000000a201", "taskType": null, "chapterId": null, "sectionId": null, "scorePolicy": null, "taskInstanceId": null}	{"kpis": {"passRate": 0.5, "attemptCount": 6, "instanceCount": 3, "completionRate": 0.167, "gradedStudents": 4, "submissionCount": 6, "assignedStudents": 30, "submittedStudents": 5, "avgNormalizedScore": 61.7, "medianNormalizedScore": 58.4}, "scope": {"range": "term", "classIds": ["deedd844-e302-4b20-903d-d9b1d0e12439"], "courseId": "00000000-0000-4000-8000-00000000a201", "taskType": null, "chapterId": null, "sectionId": null, "courseTitle": "个人理财规划", "generatedAt": "2026-05-02T17:48:00.192Z", "scorePolicy": "latest", "taskInstanceId": null}, "trends": {"range": "term", "classTrend": [{"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "className": "金融2024A班", "instanceCount": 3, "completionRate": 0.167, "assignedStudents": 30, "latestActivityAt": "2026-04-29T11:40:04.563Z", "submittedStudents": 5, "avgNormalizedScore": 61.7}], "generatedAt": "2026-05-02T17:48:00.192Z", "chapterTrend": [{"order": 0, "title": "理财基础概念", "chapterId": "00000000-0000-4000-8000-00000000a301", "instanceCount": 2, "completionRate": 0.15, "latestActivityAt": "2026-04-29T11:40:04.563Z", "avgNormalizedScore": 63.9}, {"order": 1, "title": "风险与资产配置", "chapterId": "00000000-0000-4000-8000-00000000a302", "instanceCount": 1, "completionRate": 0.2, "latestActivityAt": "2026-04-29T11:40:04.563Z", "avgNormalizedScore": 55}], "studentGrowth": [{"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": 75, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "improvement": -20, "studentName": "张三", "attemptCount": 3, "selectedScore": 65, "firstSubmittedAt": "2026-04-20T08:00:00.000Z", "latestSubmittedAt": "2026-04-22T08:00:00.000Z", "completedInstances": 2}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "improvement": null, "studentName": "王五", "attemptCount": 1, "selectedScore": null, "firstSubmittedAt": null, "latestSubmittedAt": null, "completedInstances": 0}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": 56.7, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "improvement": null, "studentName": "赵六", "attemptCount": 1, "selectedScore": 56.7, "firstSubmittedAt": "2026-04-23T08:00:00.000Z", "latestSubmittedAt": "2026-04-23T08:00:00.000Z", "completedInstances": 1}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": 60, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "improvement": null, "studentName": "李四", "attemptCount": 1, "selectedScore": 60, "firstSubmittedAt": "2026-04-20T08:10:00.000Z", "latestSubmittedAt": "2026-04-20T08:10:00.000Z", "completedInstances": 1}]}, "actionItems": [{"type": "low_completion", "title": "ANL-2 客户风险评估模拟 完成率偏低", "metric": 0.2, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "00000000-0000-4000-8000-00000000a302", "instanceId": "00000000-0000-4000-8000-00000000a602"}, {"type": "low_score", "title": "ANL-2 客户风险评估模拟 平均分偏低", "metric": 55, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "medium", "chapterId": "00000000-0000-4000-8000-00000000a302", "instanceId": "00000000-0000-4000-8000-00000000a602"}, {"type": "low_completion", "title": "ANL-2 资产配置简答 完成率偏低", "metric": 0.1, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "00000000-0000-4000-8000-00000000a301", "instanceId": "00000000-0000-4000-8000-00000000a603"}, {"type": "low_score", "title": "ANL-2 资产配置简答 平均分偏低", "metric": 56.7, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "medium", "chapterId": "00000000-0000-4000-8000-00000000a301", "instanceId": "00000000-0000-4000-8000-00000000a603"}, {"type": "low_completion", "title": "ANL-2 复利测验 完成率偏低", "metric": 0.2, "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "severity": "high", "chapterId": "00000000-0000-4000-8000-00000000a301", "instanceId": "00000000-0000-4000-8000-00000000a601"}, {"type": "weak_concept", "title": "风险评估 需要关注", "metric": 1, "severity": "medium"}, {"type": "weak_concept", "title": "现金流 需要关注", "metric": 1, "severity": "medium"}], "filterOptions": {"classes": [{"id": "deedd844-e302-4b20-903d-d9b1d0e12439", "name": "金融2024A班"}], "chapters": [{"id": "00000000-0000-4000-8000-00000000a301", "order": 0, "title": "理财基础概念"}, {"id": "00000000-0000-4000-8000-00000000a302", "order": 1, "title": "风险与资产配置"}], "sections": [{"id": "00000000-0000-4000-8000-00000000a401", "order": 0, "title": "复利与现金流", "chapterId": "00000000-0000-4000-8000-00000000a301"}, {"id": "00000000-0000-4000-8000-00000000a402", "order": 0, "title": "风险识别", "chapterId": "00000000-0000-4000-8000-00000000a302"}], "taskTypes": [{"count": 1, "label": "测验", "value": "quiz"}, {"count": 1, "label": "模拟对话", "value": "simulation"}, {"count": 1, "label": "主观题", "value": "subjective"}], "taskInstances": [{"id": "00000000-0000-4000-8000-00000000a602", "title": "ANL-2 客户风险评估模拟", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "simulation", "chapterId": "00000000-0000-4000-8000-00000000a302", "className": "金融2024A班", "sectionId": "00000000-0000-4000-8000-00000000a402"}, {"id": "00000000-0000-4000-8000-00000000a603", "title": "ANL-2 资产配置简答", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "subjective", "chapterId": "00000000-0000-4000-8000-00000000a301", "className": "金融2024A班", "sectionId": "00000000-0000-4000-8000-00000000a401"}, {"id": "00000000-0000-4000-8000-00000000a601", "title": "ANL-2 复利测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "taskType": "quiz", "chapterId": "00000000-0000-4000-8000-00000000a301", "className": "金融2024A班", "sectionId": "00000000-0000-4000-8000-00000000a401"}]}, "weeklyInsight": {"mode": "local_fallback", "label": "本地生成/待 AI 增强", "risks": [{"id": "risk-low-completion", "title": "存在未完成风险", "detail": "ANL-2 客户风险评估模拟 完成率偏低，建议先确认学生是否知道提交入口、截止时间和补交通道。", "evidence": "完成率 20%", "severity": "high"}, {"id": "risk-low-score", "title": "存在低掌握风险", "detail": "ANL-2 客户风险评估模拟 平均分偏低，说明部分学生还没有稳定掌握本轮任务要求。", "evidence": "均分 55%", "severity": "medium"}, {"id": "risk-weak-concept", "title": "共性薄弱点已出现", "detail": "风险评估 需要关注，适合用板书或例题把关键步骤重新拆开。", "evidence": "1 人次相关信号", "severity": "medium"}, {"id": "risk-student-intervention", "title": "部分学生需要单独跟进", "detail": "干预名单中包含未完成、低掌握或退步学生，建议按原因分组处理。", "evidence": "未完成 25 人次，低掌握 2 人次，退步 0 人次", "severity": "high"}], "highlights": [{"id": "overall-progress", "title": "整体进度已汇总", "detail": "当前范围覆盖 3 个实例，完成率 16.7%，归一化均分 61.7%。", "evidence": "5/30 人次完成，4 人次已评分", "severity": "info"}, {"id": "strongest-chapter", "title": "理财基础概念 掌握较好", "detail": "该章节均分 63.9%，可作为后续讲评中的正向样例来源。", "evidence": "3/20 人次完成", "severity": "info"}], "generatedAt": "2026-05-02T17:48:00.192Z", "recommendations": [{"id": "recommend-completion-followup", "title": "先补齐未完成学生", "detail": "按班级点名跟进未完成名单，给出明确补交时间，并在下一节课前检查是否补齐。", "evidence": "低完成率会影响后续掌握度判断", "severity": "high"}, {"id": "recommend-short-reteach", "title": "安排短讲评和再练习", "detail": "用 10-15 分钟复盘共性错误，再布置一道同类型小练习，优先观察低掌握学生是否能独立完成。", "evidence": "均分或章节掌握度低于 60%", "severity": "medium"}, {"id": "recommend-student-groups", "title": "分组推进学生干预", "detail": "未完成学生先补交，低掌握学生做订正和二次练习，退步学生单独询问最近学习卡点。", "evidence": "27 条干预记录", "severity": "medium"}]}, "quizDiagnostics": [], "dataQualityFlags": [{"id": "00000000-0000-4000-8000-00000000a602:sample-too-small", "title": "样本量较小", "detail": "当前范围内有效提交少于 3 人，均分、题目正确率和 rubric 低分率更适合做个案参考，不宜直接下班级结论。", "metric": 2, "category": "sample", "entityId": "00000000-0000-4000-8000-00000000a602", "severity": "info", "entityType": "instance", "entityLabel": "ANL-2 客户风险评估模拟 · 金融2024A班"}, {"id": "00000000-0000-4000-8000-00000000a603:sample-too-small", "title": "样本量较小", "detail": "当前范围内有效提交少于 3 人，均分、题目正确率和 rubric 低分率更适合做个案参考，不宜直接下班级结论。", "metric": 1, "category": "sample", "entityId": "00000000-0000-4000-8000-00000000a603", "severity": "info", "entityType": "instance", "entityLabel": "ANL-2 资产配置简答 · 金融2024A班"}, {"id": "00000000-0000-4000-8000-00000000a601:multiple-attempts", "title": "存在多次提交", "detail": "该实例有 1 名学生多次提交；当前成绩口径使用“最近一次”，练习效果请同时看最高分、提升幅度和尝试次数。", "metric": 1, "category": "attempt", "entityId": "00000000-0000-4000-8000-00000000a601", "severity": "info", "entityType": "instance", "entityLabel": "ANL-2 复利测验 · 金融2024A班"}, {"id": "00000000-0000-4000-8000-00000000a601:sample-too-small", "title": "样本量较小", "detail": "当前范围内有效提交少于 3 人，均分、题目正确率和 rubric 低分率更适合做个案参考，不宜直接下班级结论。", "metric": 2, "category": "sample", "entityId": "00000000-0000-4000-8000-00000000a601", "severity": "info", "entityType": "instance", "entityLabel": "ANL-2 复利测验 · 金融2024A班"}], "chapterDiagnostics": [{"title": "理财基础概念", "chapterId": "00000000-0000-4000-8000-00000000a301", "weaknesses": [], "instanceCount": 2, "completionRate": 0.15, "assignedStudents": 20, "submittedStudents": 3, "avgNormalizedScore": 63.9}, {"title": "风险与资产配置", "chapterId": "00000000-0000-4000-8000-00000000a302", "weaknesses": [{"tag": "风险评估", "count": 1}, {"tag": "现金流", "count": 1}], "instanceCount": 1, "completionRate": 0.2, "assignedStudents": 10, "submittedStudents": 2, "avgNormalizedScore": 55}], "chapterClassHeatmap": [{"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "chapterId": "00000000-0000-4000-8000-00000000a302", "className": "金融2024A班", "chapterTitle": "风险与资产配置", "completionRate": 0.2, "assignedStudents": 10, "submittedStudents": 2, "avgNormalizedScore": 55}, {"classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "chapterId": "00000000-0000-4000-8000-00000000a301", "className": "金融2024A班", "chapterTitle": "理财基础概念", "completionRate": 0.15, "assignedStudents": 20, "submittedStudents": 3, "avgNormalizedScore": 63.9}], "instanceDiagnostics": [{"title": "ANL-2 客户风险评估模拟", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": 0, "taskType": "simulation", "chapterId": "00000000-0000-4000-8000-00000000a302", "className": "金融2024A班", "sectionId": "00000000-0000-4000-8000-00000000a402", "instanceId": "00000000-0000-4000-8000-00000000a602", "weaknesses": [{"tag": "风险评估", "count": 1}, {"tag": "现金流", "count": 1}], "attemptCount": 2, "chapterTitle": "风险与资产配置", "completionRate": 0.2, "assignedStudents": 10, "submittedStudents": 2, "avgNormalizedScore": 55, "medianNormalizedScore": 55}, {"title": "ANL-2 资产配置简答", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": 0, "taskType": "subjective", "chapterId": "00000000-0000-4000-8000-00000000a301", "className": "金融2024A班", "sectionId": "00000000-0000-4000-8000-00000000a401", "instanceId": "00000000-0000-4000-8000-00000000a603", "weaknesses": [], "attemptCount": 1, "chapterTitle": "理财基础概念", "completionRate": 0.1, "assignedStudents": 10, "submittedStudents": 1, "avgNormalizedScore": 56.7, "medianNormalizedScore": 56.7}, {"title": "ANL-2 复利测验", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "passRate": 1, "taskType": "quiz", "chapterId": "00000000-0000-4000-8000-00000000a301", "className": "金融2024A班", "sectionId": "00000000-0000-4000-8000-00000000a401", "instanceId": "00000000-0000-4000-8000-00000000a601", "weaknesses": [], "attemptCount": 3, "chapterTitle": "理财基础概念", "completionRate": 0.2, "assignedStudents": 10, "submittedStudents": 2, "avgNormalizedScore": 67.5, "medianNormalizedScore": 67.5}], "studentInterventions": [{"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "00000000-0000-4000-8000-00000000a602", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "ANL-2 客户风险评估模拟", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "instanceId": "00000000-0000-4000-8000-00000000a602", "improvement": null, "studentName": "赵六", "attemptCount": 0, "instanceTitle": "ANL-2 客户风险评估模拟", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "instanceId": "00000000-0000-4000-8000-00000000a602", "improvement": null, "studentName": "alex", "attemptCount": 0, "instanceTitle": "ANL-2 客户风险评估模拟", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "instanceId": "00000000-0000-4000-8000-00000000a602", "improvement": null, "studentName": "belle", "attemptCount": 0, "instanceTitle": "ANL-2 客户风险评估模拟", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "32575dd0-e927-408b-ba9f-7f003bfd60d6", "instanceId": "00000000-0000-4000-8000-00000000a602", "improvement": null, "studentName": "charlie", "attemptCount": 0, "instanceTitle": "ANL-2 客户风险评估模拟", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "db2cbb54-e58f-4a0a-8afe-d7333a592981", "instanceId": "00000000-0000-4000-8000-00000000a602", "improvement": null, "studentName": "dexter", "attemptCount": 0, "instanceTitle": "ANL-2 客户风险评估模拟", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "62235d2c-a740-4db0-93e7-e28251354cba", "instanceId": "00000000-0000-4000-8000-00000000a602", "improvement": null, "studentName": "QA 测试", "attemptCount": 0, "instanceTitle": "ANL-2 客户风险评估模拟", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "77cd55ef-e239-4407-9998-a583386767ff", "instanceId": "00000000-0000-4000-8000-00000000a602", "improvement": null, "studentName": "r2 验证用户", "attemptCount": 0, "instanceTitle": "ANL-2 客户风险评估模拟", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "eb623313-3cc8-4da2-ac8f-0a1d5cd656bb", "instanceId": "00000000-0000-4000-8000-00000000a603", "improvement": null, "studentName": "李四", "attemptCount": 0, "instanceTitle": "ANL-2 资产配置简答", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "instanceId": "00000000-0000-4000-8000-00000000a603", "improvement": null, "studentName": "王五", "attemptCount": 0, "instanceTitle": "ANL-2 资产配置简答", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "instanceId": "00000000-0000-4000-8000-00000000a603", "improvement": null, "studentName": "张三", "attemptCount": 0, "instanceTitle": "ANL-2 资产配置简答", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "instanceId": "00000000-0000-4000-8000-00000000a603", "improvement": null, "studentName": "alex", "attemptCount": 0, "instanceTitle": "ANL-2 资产配置简答", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "instanceId": "00000000-0000-4000-8000-00000000a603", "improvement": null, "studentName": "belle", "attemptCount": 0, "instanceTitle": "ANL-2 资产配置简答", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "32575dd0-e927-408b-ba9f-7f003bfd60d6", "instanceId": "00000000-0000-4000-8000-00000000a603", "improvement": null, "studentName": "charlie", "attemptCount": 0, "instanceTitle": "ANL-2 资产配置简答", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "db2cbb54-e58f-4a0a-8afe-d7333a592981", "instanceId": "00000000-0000-4000-8000-00000000a603", "improvement": null, "studentName": "dexter", "attemptCount": 0, "instanceTitle": "ANL-2 资产配置简答", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "62235d2c-a740-4db0-93e7-e28251354cba", "instanceId": "00000000-0000-4000-8000-00000000a603", "improvement": null, "studentName": "QA 测试", "attemptCount": 0, "instanceTitle": "ANL-2 资产配置简答", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "77cd55ef-e239-4407-9998-a583386767ff", "instanceId": "00000000-0000-4000-8000-00000000a603", "improvement": null, "studentName": "r2 验证用户", "attemptCount": 0, "instanceTitle": "ANL-2 资产配置简答", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "d6be46c1-1c04-46a7-a3ae-b493d25d4414", "instanceId": "00000000-0000-4000-8000-00000000a601", "improvement": null, "studentName": "王五", "attemptCount": 0, "instanceTitle": "ANL-2 复利测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "instanceId": "00000000-0000-4000-8000-00000000a601", "improvement": null, "studentName": "赵六", "attemptCount": 0, "instanceTitle": "ANL-2 复利测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "instanceId": "00000000-0000-4000-8000-00000000a601", "improvement": null, "studentName": "alex", "attemptCount": 0, "instanceTitle": "ANL-2 复利测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "instanceId": "00000000-0000-4000-8000-00000000a601", "improvement": null, "studentName": "belle", "attemptCount": 0, "instanceTitle": "ANL-2 复利测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "32575dd0-e927-408b-ba9f-7f003bfd60d6", "instanceId": "00000000-0000-4000-8000-00000000a601", "improvement": null, "studentName": "charlie", "attemptCount": 0, "instanceTitle": "ANL-2 复利测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "db2cbb54-e58f-4a0a-8afe-d7333a592981", "instanceId": "00000000-0000-4000-8000-00000000a601", "improvement": null, "studentName": "dexter", "attemptCount": 0, "instanceTitle": "ANL-2 复利测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "62235d2c-a740-4db0-93e7-e28251354cba", "instanceId": "00000000-0000-4000-8000-00000000a601", "improvement": null, "studentName": "QA 测试", "attemptCount": 0, "instanceTitle": "ANL-2 复利测验", "selectedScore": null}, {"reason": "not_submitted", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": null, "className": "金融2024A班", "studentId": "77cd55ef-e239-4407-9998-a583386767ff", "instanceId": "00000000-0000-4000-8000-00000000a601", "improvement": null, "studentName": "r2 验证用户", "attemptCount": 0, "instanceTitle": "ANL-2 复利测验", "selectedScore": null}, {"reason": "low_score", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": 55, "className": "金融2024A班", "studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "instanceId": "00000000-0000-4000-8000-00000000a602", "improvement": null, "studentName": "张三", "attemptCount": 1, "instanceTitle": "ANL-2 客户风险评估模拟", "selectedScore": 55}, {"reason": "low_score", "classId": "deedd844-e302-4b20-903d-d9b1d0e12439", "bestScore": 56.7, "className": "金融2024A班", "studentId": "54b6889f-a70b-4f3d-937a-8124c49baa80", "instanceId": "00000000-0000-4000-8000-00000000a603", "improvement": null, "studentName": "赵六", "attemptCount": 1, "instanceTitle": "ANL-2 资产配置简答", "selectedScore": 56.7}], "simulationDiagnostics": []}	\N	1	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-02 17:48:00.176	2026-05-02 17:48:00.217	2026-05-02 17:48:00.163	2026-05-02 17:48:00.22
3877bfb1-bf8f-4656-9d9a-ea026de3ff1f	knowledge_source_ingest	succeeded	CourseKnowledgeSource	ca723c9c-6552-4a6e-9218-a91d517d2b23	100	{"sourceId": "ca723c9c-6552-4a6e-9218-a91d517d2b23"}	{"status": "ready", "sourceId": "ca723c9c-6552-4a6e-9218-a91d517d2b23", "textLength": 387}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-13 11:03:54.5	2026-05-13 11:05:12.242	2026-05-13 11:03:54.49	2026-05-13 11:05:12.244
ea4ca993-12bf-4c63-b4ff-9abc4747201f	knowledge_source_ingest	succeeded	CourseKnowledgeSource	b015b457-c2d4-46f5-8680-9d05fb7bc4c6	100	{"sourceId": "b015b457-c2d4-46f5-8680-9d05fb7bc4c6"}	{"status": "ready", "sourceId": "b015b457-c2d4-46f5-8680-9d05fb7bc4c6", "textLength": 387}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-13 11:13:45.685	2026-05-13 11:15:17.102	2026-05-13 11:13:45.68	2026-05-13 11:15:17.102
1a66ba28-238c-4ff9-bc5f-dacd530338ac	data_insight_advice	succeeded	DataInsightAdvice	e6fc049c-756f-4442-86da-35a6cdbadd6e	100	{"courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "scoreBins": "standard", "fingerprint": "bq30bd", "taskInstanceId": "57c9940b-4d55-4760-9697-2d88d1c40933"}	{"summary": "学生整体完成任务但平均分偏低，部分学生在建议可执行性和收支识别关键技能上表现不足，需针对性干预。", "fingerprint": "bq30bd", "focusGroups": ["低分学生王五", "在建议可执行性维度上表现差的学生群体"], "generatedAt": "2026-05-03T07:09:05.261Z", "nextActions": ["对王五进行一对一辅导以提升得分", "设计针对性练习改善建议可执行性", "复习收支识别概念并提供额外资源"], "evidenceRefs": [{"id": "student:d6be46c1-1c04-46a7-a3ae-b493d25d4414", "label": "王五 · 金融2024A班", "detail": "原因：low_score；最低/当前得分 48%；变化 无pp，支撑对低分学生的关注和辅导建议。"}, {"id": "issue:rubric-65723ff6-df90-4214-ad5e-758c04c22a81", "label": "建议可执行性", "detail": "2 名学生在该评分维度低于 60%，支撑强化建议可执行性的知识目标和教学方法。"}, {"id": "issue:rubric-83e07f7e-5295-4f1c-afcb-6ce974ec6183", "label": "收支识别", "detail": "1 名学生在该评分维度低于 60%，支撑加强收支识别技能的知识目标和教学方法。"}], "knowledgeGoals": ["强化家庭预算分析中建议的可执行性和量化能力", "加强收支识别与分类的基础知识"], "teachingMethods": ["通过案例分析和实践练习提升建议的量化与可执行性", "提供具体反馈和指导以改善收支识别准确性"]}	\N	1	2	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-03 07:08:39.374	2026-05-03 07:09:05.265	2026-05-03 07:08:39.345	2026-05-03 07:09:05.266
e3d5909b-4d72-4775-9eaa-2a698d29621e	knowledge_source_ingest	succeeded	CourseKnowledgeSource	93bfece8-ebf3-4c49-8f8b-339f092b605b	100	{"sourceId": "93bfece8-ebf3-4c49-8f8b-339f092b605b"}	{"status": "ready", "sourceId": "93bfece8-ebf3-4c49-8f8b-339f092b605b", "textLength": 374}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-13 11:07:37.496	2026-05-13 11:08:48.996	2026-05-13 11:07:37.481	2026-05-13 11:08:48.997
ad9f8cac-bc2d-4e42-a9b9-09919cd9a99b	task_import_parse	failed	taskBuildDraft	f46ad4bd-d4cd-4300-9be6-c573e750cda5	28	{"action": "import", "draftId": "f46ad4bd-d4cd-4300-9be6-c573e750cda5", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "questions": [{"stem": "", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": ""}, {"id": "B", "text": ""}, {"id": "C", "text": ""}, {"id": "D", "text": ""}], "explanation": "", "correctAnswer": "", "correctOptionIds": []}], "sectionId": "65053639-55f2-44bd-9f44-65a6d7d60bb3", "sourceIds": ["a67de771-1a52-40dd-9e88-234eba4245be"], "teacherBrief": ""}	\N	AI 返回格式不完整：Unexpected end of JSON input	1	3	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-05 07:12:13.805	2026-05-05 07:14:08.802	2026-05-05 07:12:13.788	2026-05-05 07:14:08.804
feddf41e-22a8-4b3f-9bf0-719d92d47fac	knowledge_source_ingest	succeeded	CourseKnowledgeSource	8994ad53-bb0d-44e5-997e-2b8b672ca5ce	100	{"sourceId": "8994ad53-bb0d-44e5-997e-2b8b672ca5ce"}	{"status": "ready", "sourceId": "8994ad53-bb0d-44e5-997e-2b8b672ca5ce", "textLength": 286}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-13 11:16:11.678	2026-05-13 11:17:46.701	2026-05-13 11:16:11.671	2026-05-13 11:17:46.701
0258b8a5-5932-4248-86c2-0d0a77cff5a2	task_import_parse	failed	taskBuildDraft	f46ad4bd-d4cd-4300-9be6-c573e750cda5	28	{"action": "import", "draftId": "f46ad4bd-d4cd-4300-9be6-c573e750cda5", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "questions": [{"stem": "", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": ""}, {"id": "B", "text": ""}, {"id": "C", "text": ""}, {"id": "D", "text": ""}], "explanation": "", "correctAnswer": "", "correctOptionIds": []}], "sectionId": "65053639-55f2-44bd-9f44-65a6d7d60bb3", "sourceIds": ["a67de771-1a52-40dd-9e88-234eba4245be"], "teacherBrief": ""}	\N	AI 返回格式不完整：Unexpected end of JSON input	1	3	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-05 07:15:44.298	2026-05-05 07:17:43.514	2026-05-05 07:15:44.287	2026-05-05 07:17:43.516
7bbbb759-6a10-4524-b1bf-196b9ba5900a	knowledge_source_ingest	succeeded	CourseKnowledgeSource	778e76c6-0695-44f5-a11e-eb5cd38c695a	100	{"sourceId": "778e76c6-0695-44f5-a11e-eb5cd38c695a"}	{"status": "ai_summary_failed", "sourceId": "778e76c6-0695-44f5-a11e-eb5cd38c695a", "textLength": 5163}	\N	1	3	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-05 09:02:54.424	2026-05-05 09:05:53.472	2026-05-05 09:02:54.412	2026-05-05 09:05:53.473
9e76a3d9-a674-434e-a047-816626867c48	task_import_parse	failed	taskBuildDraft	f46ad4bd-d4cd-4300-9be6-c573e750cda5	28	{"action": "import", "draftId": "f46ad4bd-d4cd-4300-9be6-c573e750cda5", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "questions": [{"stem": "", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": ""}, {"id": "B", "text": ""}, {"id": "C", "text": ""}, {"id": "D", "text": ""}], "explanation": "", "correctAnswer": "", "correctOptionIds": []}], "sectionId": "65053639-55f2-44bd-9f44-65a6d7d60bb3", "sourceIds": ["a67de771-1a52-40dd-9e88-234eba4245be"], "teacherBrief": ""}	\N	AI 返回格式不完整：Unexpected end of JSON input	1	3	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-05 09:12:01.208	2026-05-05 09:14:00.511	2026-05-05 09:12:01.202	2026-05-05 09:14:00.512
7100a8fb-4cd4-4437-9968-38912dfc00c5	task_import_parse	succeeded	taskBuildDraft	f46ad4bd-d4cd-4300-9be6-c573e750cda5	100	{"action": "import", "draftId": "f46ad4bd-d4cd-4300-9be6-c573e750cda5", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "questions": [{"stem": "", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": ""}, {"id": "B", "text": ""}, {"id": "C", "text": ""}, {"id": "D", "text": ""}], "explanation": "", "correctAnswer": "", "correctOptionIds": []}], "sectionId": "65053639-55f2-44bd-9f44-65a6d7d60bb3", "sourceIds": ["a67de771-1a52-40dd-9e88-234eba4245be"], "teacherBrief": ""}	{"action": "import", "issues": [], "summary": "通过结构化解析直接识别 1 题（共扫到 3 个题块）。 AI 未能调用（AI 返回格式不完整），但已通过结构化解析直接导入 1 题。", "questions": [{"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "稳定投资,避免频繁操作.基金定投是长期的理财规划,是一项有纪律的投资,不是短期进出获利的工具.\\n\\n22,在个人理财规划中,单身期稳健型投资者的核心目标是什么?", "options": [{"id": "A", "text": ",追求高收益,承担高风险"}, {"id": "B", "text": ",平衡收益与风险,注重资金安全"}, {"id": "C", "text": ",完全规避风险,只投资储蓄产品"}, {"id": "D", "text": ",以短期投机为主,不考虑长期规划 23,以下关于基金的说法,哪一项是错误的?"}, {"id": "A", "text": ",基金由专业基金经理进行管理"}, {"id": "B", "text": ",基金投资门槛普遍较低,适合普通投资者"}, {"id": "C", "text": ",基金收益一定高于银行存款利率"}, {"id": "D", "text": ",基金种类繁多,可满足不同投资者的需求 24,如果一个投资者想通过购买基金来实现每月固定收益,最适合选择哪种基金?"}, {"id": "A", "text": ",股票型基金"}, {"id": "B", "text": ",货币市场基金"}, {"id": "C", "text": ",QDII基金"}, {"id": "D", "text": ",REITs基金 25,下列哪项不属于基金信息披露的主要内容?"}, {"id": "A", "text": ",基金净值"}, {"id": "B", "text": ",基金经理变动"}, {"id": "C", "text": ",基金公司的办公地址"}, {"id": "D", "text": ",持仓比例变化 26,以下哪些是基金投资的特点?"}, {"id": "A", "text": ",由专业经理人管理"}, {"id": "B", "text": ",投资门槛高,适合富裕人群"}, {"id": "C", "text": ",投资分散,降低单一风险"}, {"id": "D", "text": ",流动性差,无法随时赎回"}, {"id": "E", "text": ",具有一定的收益预期但不保本 27,关于稳健型投资组合的构建,以下说法正确的是?"}, {"id": "A", "text": ", 应避免配置高波动率资产"}, {"id": "B", "text": ", 应尽量减少债券比例以提高收益"}, {"id": "C", "text": ", 需要考虑现金流需求"}, {"id": "D", "text": ", 应以股票为主导资产"}, {"id": "E", "text": ", 应注重资产配置的多样化 28,以下哪些是基金风险的主要来源?"}, {"id": "A", "text": ", 市场波动风险"}, {"id": "B", "text": ", 信用风险"}, {"id": "C", "text": ", 流动性风险"}, {"id": "D", "text": ", 汇率风险"}, {"id": "E", "text": ", 基金公司办公地点太远 29,一只基金的资产配置比例为:股票30%,债券60%,现金10%,这种配置体现了____型投资理念,其主要目的是为了在收益与____之间取得平衡. 稳健 风险 30,稳健型投资者通常会采用____策略,在投资过程中重视长期规划,同时根据自身风险承受能力调整资产配置,以确保资金的安全性和____."}], "confidence": 0.95, "sourceRefs": [{"excerpt": "(3)稳定投资,避免频繁操作.基金定投是长期的理财规划,是一项有纪律的投资,不是短期进出获利的工具.\\n\\n22,在个人理财规划中,单身期稳健型投资者的核心目标是什么?\\n\\nA,追求高收益,承担高风险\\n\\nB,平衡收益与风险,注重资金安全\\n\\nC,完", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}], "sourceSummary": [{"id": "a67de771-1a52-40dd-9e88-234eba4245be", "fileName": "个人理财-题库.pdf", "conceptTags": ["稳健型投资者", "保守型投资者", "基金类型与特点", "资产配置", "投资风险控制"]}]}	\N	1	3	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-05 09:47:52.684	2026-05-05 09:51:34.575	2026-05-05 09:47:52.673	2026-05-05 09:51:34.577
053ab03f-642b-436b-ba47-c4634c27f8ac	task_import_parse	succeeded	taskBuildDraft	e96eda2b-3de5-441d-a3eb-a775489701d1	100	{"action": "import", "draftId": "e96eda2b-3de5-441d-a3eb-a775489701d1", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "questions": [{"stem": "", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": ""}, {"id": "B", "text": ""}, {"id": "C", "text": ""}, {"id": "D", "text": ""}], "explanation": "", "correctAnswer": "", "correctOptionIds": []}], "sectionId": "65053639-55f2-44bd-9f44-65a6d7d60bb3", "sourceIds": ["a67de771-1a52-40dd-9e88-234eba4245be"], "teacherBrief": ""}	{"action": "import", "issues": [], "summary": "通过结构化解析直接识别 1 题（共扫到 3 个题块）。 AI 未能调用（AI 返回格式不完整），但已通过结构化解析直接导入 1 题。", "questions": [{"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "稳定投资,避免频繁操作.基金定投是长期的理财规划,是一项有纪律的投资,不是短期进出获利的工具.\\n\\n22,在个人理财规划中,单身期稳健型投资者的核心目标是什么?", "options": [{"id": "A", "text": ",追求高收益,承担高风险"}, {"id": "B", "text": ",平衡收益与风险,注重资金安全"}, {"id": "C", "text": ",完全规避风险,只投资储蓄产品"}, {"id": "D", "text": ",以短期投机为主,不考虑长期规划 23,以下关于基金的说法,哪一项是错误的?"}, {"id": "A", "text": ",基金由专业基金经理进行管理"}, {"id": "B", "text": ",基金投资门槛普遍较低,适合普通投资者"}, {"id": "C", "text": ",基金收益一定高于银行存款利率"}, {"id": "D", "text": ",基金种类繁多,可满足不同投资者的需求 24,如果一个投资者想通过购买基金来实现每月固定收益,最适合选择哪种基金?"}, {"id": "A", "text": ",股票型基金"}, {"id": "B", "text": ",货币市场基金"}, {"id": "C", "text": ",QDII基金"}, {"id": "D", "text": ",REITs基金 25,下列哪项不属于基金信息披露的主要内容?"}, {"id": "A", "text": ",基金净值"}, {"id": "B", "text": ",基金经理变动"}, {"id": "C", "text": ",基金公司的办公地址"}, {"id": "D", "text": ",持仓比例变化 26,以下哪些是基金投资的特点?"}, {"id": "A", "text": ",由专业经理人管理"}, {"id": "B", "text": ",投资门槛高,适合富裕人群"}, {"id": "C", "text": ",投资分散,降低单一风险"}, {"id": "D", "text": ",流动性差,无法随时赎回"}, {"id": "E", "text": ",具有一定的收益预期但不保本 27,关于稳健型投资组合的构建,以下说法正确的是?"}, {"id": "A", "text": ", 应避免配置高波动率资产"}, {"id": "B", "text": ", 应尽量减少债券比例以提高收益"}, {"id": "C", "text": ", 需要考虑现金流需求"}, {"id": "D", "text": ", 应以股票为主导资产"}, {"id": "E", "text": ", 应注重资产配置的多样化 28,以下哪些是基金风险的主要来源?"}, {"id": "A", "text": ", 市场波动风险"}, {"id": "B", "text": ", 信用风险"}, {"id": "C", "text": ", 流动性风险"}, {"id": "D", "text": ", 汇率风险"}, {"id": "E", "text": ", 基金公司办公地点太远 29,一只基金的资产配置比例为:股票30%,债券60%,现金10%,这种配置体现了____型投资理念,其主要目的是为了在收益与____之间取得平衡. 稳健 风险 30,稳健型投资者通常会采用____策略,在投资过程中重视长期规划,同时根据自身风险承受能力调整资产配置,以确保资金的安全性和____."}], "confidence": 0.95, "sourceRefs": [{"excerpt": "(3)稳定投资,避免频繁操作.基金定投是长期的理财规划,是一项有纪律的投资,不是短期进出获利的工具.\\n\\n22,在个人理财规划中,单身期稳健型投资者的核心目标是什么?\\n\\nA,追求高收益,承担高风险\\n\\nB,平衡收益与风险,注重资金安全\\n\\nC,完", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}], "sourceSummary": [{"id": "a67de771-1a52-40dd-9e88-234eba4245be", "fileName": "个人理财-题库.pdf", "conceptTags": ["稳健型投资者", "保守型投资者", "基金类型与特点", "资产配置", "投资风险控制"]}]}	\N	1	3	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-05 10:23:28.501	2026-05-05 10:27:05.168	2026-05-05 10:23:28.496	2026-05-05 10:27:05.171
6b624e51-1dca-4f1d-8fde-7afc37243120	knowledge_source_ingest	succeeded	CourseKnowledgeSource	cd2e2dfc-ac9d-481d-b411-85e616a0ee67	100	{"sourceId": "cd2e2dfc-ac9d-481d-b411-85e616a0ee67"}	{"status": "ready", "sourceId": "cd2e2dfc-ac9d-481d-b411-85e616a0ee67", "textLength": 286}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-13 11:08:43.801	2026-05-13 11:10:11.338	2026-05-13 11:08:43.794	2026-05-13 11:10:11.339
ed2ca804-eb06-407d-a2ff-e318c6716771	knowledge_source_ingest	succeeded	CourseKnowledgeSource	b97c541b-bad3-4320-8233-3e714c838c11	100	{"sourceId": "b97c541b-bad3-4320-8233-3e714c838c11"}	{"status": "ready", "sourceId": "b97c541b-bad3-4320-8233-3e714c838c11", "textLength": 387}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-13 11:10:03.56	2026-05-13 11:11:29.295	2026-05-13 11:10:03.553	2026-05-13 11:11:29.296
b6cd37c2-6032-46c2-b04f-7534d561b4c3	knowledge_source_ingest	succeeded	CourseKnowledgeSource	331a8af8-3df6-4d28-9994-1b2117bb33cd	100	{"sourceId": "331a8af8-3df6-4d28-9994-1b2117bb33cd"}	{"status": "ready", "sourceId": "331a8af8-3df6-4d28-9994-1b2117bb33cd", "textLength": 286}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-13 11:17:23.416	2026-05-13 11:19:04.822	2026-05-13 11:17:23.41	2026-05-13 11:19:04.822
879bc0dd-eb4b-4481-abb6-c849635ee467	knowledge_source_ingest	succeeded	CourseKnowledgeSource	89e8163c-cb97-4831-9600-cdd799c3a899	100	{"sourceId": "89e8163c-cb97-4831-9600-cdd799c3a899"}	{"status": "ready", "sourceId": "89e8163c-cb97-4831-9600-cdd799c3a899", "textLength": 374}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-13 11:11:23.935	2026-05-13 11:12:25.134	2026-05-13 11:11:23.928	2026-05-13 11:12:25.135
33b71eb9-e294-4f59-b42d-14c3dc2950db	knowledge_source_ingest	succeeded	CourseKnowledgeSource	133b5b10-4ea7-4a5d-9633-9bb2a89b0121	100	{"sourceId": "133b5b10-4ea7-4a5d-9633-9bb2a89b0121"}	{"status": "ready", "sourceId": "133b5b10-4ea7-4a5d-9633-9bb2a89b0121", "textLength": 286}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-13 11:18:55.918	2026-05-13 11:20:32.868	2026-05-13 11:18:55.913	2026-05-13 11:20:32.869
38522759-a303-4f7e-a72d-245e6512bcac	knowledge_source_ingest	succeeded	CourseKnowledgeSource	df54c46d-c333-4561-ac8f-69e91b7cf3db	100	{"sourceId": "df54c46d-c333-4561-ac8f-69e91b7cf3db"}	{"status": "ready", "sourceId": "df54c46d-c333-4561-ac8f-69e91b7cf3db", "textLength": 387}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-13 11:20:52.556	2026-05-13 11:22:26.004	2026-05-13 11:20:52.553	2026-05-13 11:22:26.005
fa6ee4d2-dd5f-4791-9b79-b658e9081ebd	knowledge_source_ingest	failed	CourseKnowledgeSource	778e76c6-0695-44f5-a11e-eb5cd38c695a	20	{"sourceId": "778e76c6-0695-44f5-a11e-eb5cd38c695a"}	\N	ENOENT: no such file or directory, open 'public/uploads/2026-05-05/343110f4-77ad-443e-83b7-2a48b48de93a.xls'	1	3	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-14 00:15:11.894	2026-05-14 00:15:11.936	2026-05-14 00:15:11.881	2026-05-14 00:15:11.937
42bcaadb-4d8e-4d79-a92a-957d79448411	task_import_parse	succeeded	taskBuildDraft	e96eda2b-3de5-441d-a3eb-a775489701d1	100	{"action": "checkOptimize", "draftId": "e96eda2b-3de5-441d-a3eb-a775489701d1", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "questions": [{"stem": "【待确认】稳定投资,避免频繁操作.基金定投是长期的理财规划,是一项有纪律的投资,不是短期进出获利的工具.\\n\\n22,在个人理财规划中,单身期稳健型投资者的核心目标是什么?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": ",追求高收益,承担高风险"}, {"id": "B", "text": ",平衡收益与风险,注重资金安全"}, {"id": "C", "text": ",完全规避风险,只投资储蓄产品"}, {"id": "D", "text": ",以短期投机为主,不考虑长期规划 23,以下关于基金的说法,哪一项是错误的?"}, {"id": "A", "text": ",基金由专业基金经理进行管理"}, {"id": "B", "text": ",基金投资门槛普遍较低,适合普通投资者"}, {"id": "C", "text": ",基金收益一定高于银行存款利率"}, {"id": "D", "text": ",基金种类繁多,可满足不同投资者的需求 24,如果一个投资者想通过购买基金来实现每月固定收益,最适合选择哪种基金?"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}], "sectionId": "65053639-55f2-44bd-9f44-65a6d7d60bb3", "sourceIds": ["a67de771-1a52-40dd-9e88-234eba4245be"], "teacherBrief": ""}	{"action": "checkOptimize", "issues": [{"message": "大多数题目缺少解析，只有简答题21提供了答案。建议为所有题目补充解析以增强学习效果。", "severity": "warning", "sourceRef": "素材第1-30题", "questionIndex": 0}, {"message": "题型分布与描述不符：素材摘要描述题型包括判断题、单选题、多选题和简答题，但实际题目29和30是填空题。", "severity": "warning", "sourceRef": "第5页，题目29-30", "questionIndex": 28}, {"message": "答案疑似错误：题目11，保守型投资者最适合基金定投，但保守型投资者风险承受能力低，基金定投涉及市场风险，可能更适合货币基金或定期存款。建议核实答案。", "severity": "warning", "sourceRef": "第2页，题目11", "questionIndex": 10}, {"message": "当前题目导入混乱：在‘当前题目’部分，题干包含无关文本‘稳定投资,避免频繁操作.基金定投是长期的理财规划,是一项有纪律的投资,不是短期进出获利的工具.’，可能从简答题21的答案中误入。建议检查导入数据。", "severity": "info", "sourceRef": "当前题目部分", "questionIndex": 0}], "summary": "检查了个人理财规划题库，发现解析缺失、题型分布与描述不符、一道题答案疑似错误以及导入数据混乱等问题。", "questions": [], "sourceSummary": [{"id": "a67de771-1a52-40dd-9e88-234eba4245be", "fileName": "个人理财-题库.pdf", "conceptTags": ["稳健型投资者", "保守型投资者", "基金类型与特点", "资产配置", "投资风险控制"]}]}	\N	1	3	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-05 10:27:21.344	2026-05-05 10:28:29.598	2026-05-05 10:27:21.331	2026-05-05 10:28:29.599
62c4f1d2-d662-428c-93a8-1ad7182eb93d	task_import_parse	succeeded	taskBuildDraft	b11de978-d1ab-4dd0-860b-94ffc868d341	100	{"action": "import", "draftId": "b11de978-d1ab-4dd0-860b-94ffc868d341", "courseId": "e6fc049c-756f-4442-86da-35a6cdbadd6e", "chapterId": "baf9c3d6-b36d-4b72-abbc-98b96eb49443", "questions": [{"stem": "", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": ""}, {"id": "B", "text": ""}, {"id": "C", "text": ""}, {"id": "D", "text": ""}], "explanation": "", "correctAnswer": "", "correctOptionIds": []}], "sectionId": "65053639-55f2-44bd-9f44-65a6d7d60bb3", "sourceIds": ["a67de771-1a52-40dd-9e88-234eba4245be"], "teacherBrief": ""}	{"action": "import", "issues": [], "summary": "通过结构化解析直接识别 30 题（共扫到 30 个题块）。", "questions": [{"type": "true_false", "issues": ["解析待确认"], "points": 1, "prompt": "稳健型投资者在进行资产配置时，主要配置高波动性的金融产品。", "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "1、稳健型投资者在进行资产配置时，主要配置高波动性的金融产品。\\n答案:错误", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}, {"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "下列哪种金融工具最适合稳健型投资者?", "options": [{"id": "A", "text": "期货合约"}, {"id": "B", "text": "货币市场基金"}, {"id": "C", "text": "期权交易"}, {"id": "D", "text": "创业投资基金"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "2、下列哪种金融工具最适合稳健型投资者?\\nA、期货合约\\nB、货币市场基金\\nC、期权交易\\nD、创业投资基金\\n答案:B", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}, {"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "以下哪个选项不是稳健型投资者常见的投资渠道?", "options": [{"id": "A", "text": "定期存款"}, {"id": "B", "text": "债券基金"}, {"id": "C", "text": "股票型基金"}, {"id": "D", "text": "银行理财产品"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "3、以下哪个选项不是稳健型投资者常见的投资渠道?\\nA、定期存款\\nB、债券基金\\nC、股票型基金\\nD、银行理财产品\\n答案:C", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["C"]}, {"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "关于稳健型投资目标，以下说法错误的是?", "options": [{"id": "A", "text": "注重长期资本增值"}, {"id": "B", "text": "追求资金的绝对安全"}, {"id": "C", "text": "允许较高的短期波动"}, {"id": "D", "text": "希望获得稳定的现金流"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "4、关于稳健型投资目标，以下说法错误的是?\\nA、注重长期资本增值\\nB、追求资金的绝对安全\\nC、允许较高的短期波动\\nD、希望获得稳定的现金流\\n答案:C", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["C"]}, {"type": "true_false", "issues": ["解析待确认"], "points": 1, "prompt": "稳健型投资者可以将大部分资金投入到高收益的P2P平台。", "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "5、稳健型投资者可以将大部分资金投入到高收益的P2P平台。\\n答案:错误", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}, {"type": "true_false", "issues": ["解析待确认"], "points": 1, "prompt": "稳健型投资者不需要关注宏观经济变化。", "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "6、稳健型投资者不需要关注宏观经济变化。\\n答案:错误", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}, {"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "稳健型投资者在选择基金时，首要考虑的因素是?", "options": [{"id": "A", "text": "历史收益"}, {"id": "B", "text": "基金经理的名气"}, {"id": "C", "text": "风险水平"}, {"id": "D", "text": "基金规模"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "7、稳健型投资者在选择基金时，首要考虑的因素是?\\nA、历史收益\\nB、基金经理的名气\\nC、风险水平\\n\\nD、基金规模\\n答案:C", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["C"]}, {"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "下列哪种投资方式最适合稳健型投资者的资产配置?", "options": [{"id": "A", "text": "全部投资于股票"}, {"id": "B", "text": "70%债券+30%股票"}, {"id": "C", "text": "全部投资于房地产"}, {"id": "D", "text": "60%股票+40%现金"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "8、下列哪种投资方式最适合稳健型投资者的资产配置?\\nA、全部投资于股票\\nB、70%债券+30%股票\\nC、全部投资于房地产\\nD、60%股票+40%现金\\n答案:B", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}, {"type": "true_false", "issues": ["解析待确认"], "points": 1, "prompt": "稳健型投资者的投资目标可以随时改变，无需考虑原有计划。", "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "9、稳健型投资者的投资目标可以随时改变，无需考虑原有计划。\\n答案:错误", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}, {"type": "true_false", "issues": ["解析待确认"], "points": 1, "prompt": "稳健型投资者应尽量避免任何投资风险。", "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "10、稳健型投资者应尽量避免任何投资风险。\\n答案:错误", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}, {"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "下列哪种投资方式最适合保守型投资者?", "options": [{"id": "A", "text": "股票投资"}, {"id": "B", "text": "基金定投"}, {"id": "C", "text": "期货交易"}, {"id": "D", "text": "创业投资"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "11、下列哪种投资方式最适合保守型投资者?\\nA、股票投资\\nB、基金定投\\nC、期货交易\\nD、创业投资\\n答案:B", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}, {"type": "multiple_choice", "issues": ["解析待确认"], "points": 1, "prompt": "保守型投资者在资产配置中，应避免哪些行为?", "options": [{"id": "A", "text": "高杠杆投资"}, {"id": "B", "text": "分散投资"}, {"id": "C", "text": "频繁交易"}, {"id": "D", "text": "集中投资于低风险资产"}, {"id": "E", "text": "盲目追求高收益"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "12、保守型投资者在资产配置中，应避免哪些行为?\\nA、高杠杆投资\\nB、分散投资\\nC、频繁交易\\nD、集中投资于低风险资产\\nE、盲目追求高收益\\n答案:ACE", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["A", "C", "E"]}, {"type": "true_false", "issues": ["解析待确认"], "points": 1, "prompt": "保守型理财只适合年轻人，不适合中年人。", "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "13、保守型理财只适合年轻人，不适合中年人。\\n答案:错误", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}, {"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "关于基金投资，下列说法错误的是?", "options": [{"id": "A", "text": "基金可以帮助投资者实现分散投资"}, {"id": "B", "text": "基金由专业经理人进行管理"}, {"id": "C", "text": "基金只适合高净值人群"}, {"id": "D", "text": "基金投资可以降低个体投资者的操作成本"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "14、关于基金投资，下列说法错误的是?\\nA、基金可以帮助投资者实现分散投资\\nB、基金由专业经理人进行管理\\nC、基金只适合高净值人群\\nD、基金投资可以降低个体投资者的操作成本\\n\\n答案:C", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["C"]}, {"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "基金的费用率通常由哪些组成?", "options": [{"id": "A", "text": "管理费、托管费和销售服务费"}, {"id": "B", "text": "利息和手续费"}, {"id": "C", "text": "分红率和赎回费"}, {"id": "D", "text": "交易费和印花税"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "15、基金的费用率通常由哪些组成?\\n\\nA、管理费、托管费和销售服务费\\n\\nB、利息和手续费\\n\\nC、分红率和赎回费\\n\\nD、交易费和印花税\\n\\n答案:A", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["A"]}, {"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "以下哪种基金允许投资者随时申购和赎回?", "options": [{"id": "A", "text": "封闭式基金"}, {"id": "B", "text": "开放式基金"}, {"id": "C", "text": "ETF"}, {"id": "D", "text": "LOF"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "16、以下哪种基金允许投资者随时申购和赎回?\\n\\nA、封闭式基金\\n\\nB、开放式基金\\n\\nC、ETF\\n\\nD、LOF\\n\\n答案:B", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}, {"type": "multiple_choice", "issues": ["解析待确认"], "points": 1, "prompt": "基金投资的优势包括以下哪些?", "options": [{"id": "A", "text": "投资门槛低"}, {"id": "B", "text": "专业管理"}, {"id": "C", "text": "分散风险"}, {"id": "D", "text": "收益确定"}, {"id": "E", "text": "流动性高"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "17、基金投资的优势包括以下哪些?\\n\\nA、投资门槛低\\n\\nB、专业管理\\n\\nC、分散风险\\n\\nD、收益确定\\n\\nE、流动性高\\n\\n答案:ABCE", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["A", "B", "C", "E"]}, {"type": "multiple_choice", "issues": ["解析待确认"], "points": 1, "prompt": "关于基金的赎回规则，下列说法正确的是?", "options": [{"id": "A", "text": "开放式基金可随时赎回"}, {"id": "B", "text": "封闭式基金不可赎回"}, {"id": "C", "text": "赎回时可能收取一定费用"}, {"id": "D", "text": "赎回不影响基金运作"}, {"id": "E", "text": "赎回后资金立即到账"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "18、关于基金的赎回规则，下列说法正确的是?\\n\\nA、开放式基金可随时赎回\\n\\nB、封闭式基金不可赎回\\n\\nC、赎回时可能收取一定费用\\n\\nD、赎回不影响基金运作\\n\\nE、赎回后资金立即到账\\n\\n答案:ABCD", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["A", "B", "C", "D"]}, {"type": "true_false", "issues": ["解析待确认"], "points": 1, "prompt": "基金的费用率越高，说明基金表现越好。", "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "19、基金的费用率越高，说明基金表现越好。\\n\\n答案:错误", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}, {"type": "true_false", "issues": ["解析待确认"], "points": 1, "prompt": "封闭式基金的份额可以在交易所买卖。", "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "20、封闭式基金的份额可以在交易所买卖。\\n\\n答案:正确", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["A"]}, {"type": "short_answer", "issues": ["解析待确认"], "points": 1, "prompt": "请简述基金理财的风险控制。(简答题)", "options": [], "confidence": 0.85, "sourceRefs": [{"excerpt": "21、请简述基金理财的风险控制。(简答题)\\n\\n答案:(1)选择适合自己的基金类型。就长期统计平均而言，在同等条件下，股票基金的收益较高，风险也较高，混合基金次之，债券基金再次之，货币市场基金的收益和风险最低。投资人应根据自身的风险偏好来挑选", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "(1)选择适合自己的基金类型。就长期统计平均而言，在同等条件下，股票基金的收益较高，风险也较高，混合基金次之，债券基金再次之，货币市场基金的收益和风险最低。投资人应根据自身的风险偏好来挑选适合投资的基金类型。\\n\\n(2)对自身财务状况进行长远规划。成熟市场的数据显示，基金的投资周期越长，亏损的可能性越小，基金定投投资超过十年的，亏损的几率接近于零。投资人还应根据自己的收入水平、投资理财规划和生活开支来合理安排基金定投比例，达到家庭资产增值目的。\\n\\n(3)稳定投资，避免频繁操作。基金定投是长期的理财规划，是一项有纪律的投资，不是短期进出获利的工具。", "aiSupplemented": false, "correctOptionIds": []}, {"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "在个人理财规划中，单身期稳健型投资者的核心目标是什么?", "options": [{"id": "A", "text": "追求高收益，承担高风险"}, {"id": "B", "text": "平衡收益与风险，注重资金安全"}, {"id": "C", "text": "完全规避风险，只投资储蓄产品"}, {"id": "D", "text": "以短期投机为主，不考虑长期规划"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "22、在个人理财规划中，单身期稳健型投资者的核心目标是什么?\\n\\nA、追求高收益，承担高风险\\n\\nB、平衡收益与风险，注重资金安全\\n\\nC、完全规避风险，只投资储蓄产品\\n\\nD、以短期投机为主，不考虑长期规划\\n\\n答案:B", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}, {"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "以下关于基金的说法，哪一项是错误的?", "options": [{"id": "A", "text": "基金由专业基金经理进行管理"}, {"id": "B", "text": "基金投资门槛普遍较低，适合普通投资者"}, {"id": "C", "text": "基金收益一定高于银行存款利率"}, {"id": "D", "text": "基金种类繁多，可满足不同投资者的需求"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "23、以下关于基金的说法，哪一项是错误的?\\n\\nA、基金由专业基金经理进行管理\\n\\nB、基金投资门槛普遍较低，适合普通投资者\\n\\nC、基金收益一定高于银行存款利率\\n\\nD、基金种类繁多，可满足不同投资者的需求\\n\\n答案:C", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["C"]}, {"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "如果一个投资者想通过购买基金来实现每月固定收益，最适合选择哪种基金?", "options": [{"id": "A", "text": "股票型基金"}, {"id": "B", "text": "货币市场基金"}, {"id": "C", "text": "QDII基金"}, {"id": "D", "text": "REITs基金"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "24、如果一个投资者想通过购买基金来实现每月固定收益，最适合选择哪种基金?\\n\\nA、股票型基金\\n\\nB、货币市场基金\\n\\nC、QDII基金\\n\\nD、REITs基金\\n\\n答案:B", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["B"]}, {"type": "single_choice", "issues": ["解析待确认"], "points": 1, "prompt": "下列哪项不属于基金信息披露的主要内容?", "options": [{"id": "A", "text": "基金净值"}, {"id": "B", "text": "基金经理变动"}, {"id": "C", "text": "基金公司的办公地址"}, {"id": "D", "text": "持仓比例变化"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "25、下列哪项不属于基金信息披露的主要内容?\\n\\nA、基金净值\\n\\nB、基金经理变动\\n\\nC、基金公司的办公地址\\n\\nD、持仓比例变化\\n\\n答案:C", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["C"]}, {"type": "multiple_choice", "issues": ["解析待确认"], "points": 1, "prompt": "以下哪些是基金投资的特点?", "options": [{"id": "A", "text": "由专业经理人管理"}, {"id": "B", "text": "投资门槛高，适合富裕人群"}, {"id": "C", "text": "投资分散，降低单一风险"}, {"id": "D", "text": "流动性差，无法随时赎回"}, {"id": "E", "text": "具有一定的收益预期但不保本"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "26、以下哪些是基金投资的特点?\\n\\nA、由专业经理人管理\\n\\nB、投资门槛高，适合富裕人群\\n\\nC、投资分散，降低单一风险\\n\\nD、流动性差，无法随时赎回\\n\\nE、具有一定的收益预期但不保本\\n\\n答案: ACE", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["A", "C", "E"]}, {"type": "multiple_choice", "issues": ["解析待确认"], "points": 1, "prompt": "关于稳健型投资组合的构建，以下说法正确的是?", "options": [{"id": "A", "text": "应避免配置高波动率资产"}, {"id": "B", "text": "应尽量减少债券比例以提高收益"}, {"id": "C", "text": "需要考虑现金流需求"}, {"id": "D", "text": "应以股票为主导资产"}, {"id": "E", "text": "应注重资产配置的多样化"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "27、关于稳健型投资组合的构建，以下说法正确的是?\\n\\nA、 应避免配置高波动率资产\\n\\nB、 应尽量减少债券比例以提高收益\\n\\nC、 需要考虑现金流需求\\n\\nD、 应以股票为主导资产\\n\\nE、 应注重资产配置的多样化\\n\\n答案: ACE", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["A", "C", "E"]}, {"type": "multiple_choice", "issues": ["解析待确认"], "points": 1, "prompt": "以下哪些是基金风险的主要来源?", "options": [{"id": "A", "text": "市场波动风险"}, {"id": "B", "text": "信用风险"}, {"id": "C", "text": "流动性风险"}, {"id": "D", "text": "汇率风险"}, {"id": "E", "text": "基金公司办公地点太远"}], "confidence": 0.95, "sourceRefs": [{"excerpt": "28、以下哪些是基金风险的主要来源?\\n\\nA、 市场波动风险\\n\\nB、 信用风险\\n\\nC、 流动性风险\\n\\nD、 汇率风险\\n\\nE、 基金公司办公地点太远\\n\\n答案: ABCD", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "", "aiSupplemented": false, "correctOptionIds": ["A", "B", "C", "D"]}, {"type": "short_answer", "issues": ["解析待确认"], "points": 1, "prompt": "一只基金的资产配置比例为:股票30%，债券60%，现金10%，这种配置体现了____型投资理念，其主要目的是为了在收益与____之间取得平衡。", "options": [], "confidence": 0.85, "sourceRefs": [{"excerpt": "29、一只基金的资产配置比例为:股票30%，债券60%，现金10%，这种配置体现了____型投资理念，其主要目的是为了在收益与____之间取得平衡。\\n\\n答案:\\n\\n稳健\\n\\n风险", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "稳健\\n\\n风险", "aiSupplemented": false, "correctOptionIds": []}, {"type": "short_answer", "issues": ["解析待确认"], "points": 1, "prompt": "稳健型投资者通常会采用____策略，在投资过程中重视长期规划，同时根据自身风险承受能力调整资产配置，以确保资金的安全性和____。", "options": [], "confidence": 0.85, "sourceRefs": [{"excerpt": "30、稳健型投资者通常会采用____策略，在投资过程中重视长期规划，同时根据自身风险承受能力调整资产配置，以确保资金的安全性和____。\\n\\n答案: 分散投资；稳定性；", "fileName": "个人理财-题库.pdf", "sourceId": "a67de771-1a52-40dd-9e88-234eba4245be"}], "conceptTags": [], "explanation": "", "needsReview": true, "correctAnswer": "分散投资；稳定性；", "aiSupplemented": false, "correctOptionIds": []}], "sourceSummary": [{"id": "a67de771-1a52-40dd-9e88-234eba4245be", "fileName": "个人理财-题库.pdf", "conceptTags": ["稳健型投资者", "保守型投资者", "基金类型与特点", "资产配置", "投资风险控制"]}]}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-05 10:56:21.34	2026-05-05 10:56:21.518	2026-05-05 10:56:21.327	2026-05-05 10:56:21.527
9bcdae23-016b-4cae-9bb6-f709cb630aab	knowledge_source_ingest	succeeded	CourseKnowledgeSource	01381fbf-7607-4765-b4fb-96e068b9d25f	100	{"sourceId": "01381fbf-7607-4765-b4fb-96e068b9d25f"}	{"status": "ready", "sourceId": "01381fbf-7607-4765-b4fb-96e068b9d25f", "textLength": 286}	\N	1	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-13 11:12:28.905	2026-05-13 11:13:45.486	2026-05-13 11:12:28.898	2026-05-13 11:13:45.487
8727cc96-bdcb-48b0-a7dc-26d45f7e9a35	knowledge_source_ingest	succeeded	CourseKnowledgeSource	778e76c6-0695-44f5-a11e-eb5cd38c695a	100	{"sourceId": "778e76c6-0695-44f5-a11e-eb5cd38c695a"}	{"status": "ready", "sourceId": "778e76c6-0695-44f5-a11e-eb5cd38c695a", "textLength": 5163}	\N	1	3	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-14 00:19:49.12	2026-05-14 00:21:27.088	2026-05-14 00:19:49.115	2026-05-14 00:21:27.088
\.


--
-- Data for Name: Attachment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Attachment" (id, "subjectiveSubmissionId", "fileName", "filePath", "fileSize", "contentType", "createdAt") FROM stdin;
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AuditLog" (id, action, "actorId", "targetId", "targetType", metadata, "createdAt") FROM stdin;
f13f3583-0949-4ec1-a3ca-9007316fa029	taskInstance.publish	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2e700d5e-fa7e-4f13-b000-03f660414b89	TaskInstance	\N	2026-02-21 10:35:41.127
c9b77f0f-4c1a-4547-b882-1eb298c0175e	taskInstance.publish	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	da3724bf-cdb5-43c4-b8a4-2849ac97f191	TaskInstance	\N	2026-02-21 11:24:34.507
11a535c6-70c6-481f-b394-a3f49cd70042	taskInstance.publish	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2587a565-e28d-4bbb-8b39-1335473cd88c	TaskInstance	\N	2026-02-22 10:21:30.946
a9e25946-2d07-4fb4-915b-bf2e081b512c	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	51a6c667-682b-47f3-ac50-49ce3bb7949a	Submission	{"status": "graded", "taskType": "quiz"}	2026-02-25 00:55:54.592
1931a00a-1316-4784-8162-51139657faeb	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	2b7a3672-2059-4ad0-b0af-7ebf579f783e	Submission	{"status": "graded", "taskType": "quiz"}	2026-04-25 01:04:21.588
a2249e5b-809f-4740-bd20-d975204d8c3a	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	43d43bc0-2258-4ffe-b8d8-9fda4af95e93	Submission	{"status": "graded", "taskType": "subjective"}	2026-04-25 01:30:26.994
588289fc-c78e-4078-a45e-b9b7838fae25	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	dd7e9299-affc-4217-8b40-082f4461854f	Submission	{"status": "graded", "taskType": "subjective"}	2026-04-25 01:41:30.524
fd3e3073-9fd0-4c45-bd57-d0bb4d809ebb	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	cb62c86f-7940-4500-9727-bf615aecc142	Submission	{"status": "graded", "taskType": "quiz"}	2026-04-25 02:13:41.074
15a18149-718c-4512-9bbf-c6830759c17b	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	86c937e2-df1b-4ff7-9170-772635d84d69	Submission	{"status": "graded", "taskType": "quiz"}	2026-04-25 02:52:20.239
d950243b-8131-4d73-ad31-2671e336f42b	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	9c93ad97-3c36-492c-8180-da81b1dee991	Submission	{"status": "graded", "taskType": "simulation"}	2026-04-25 16:40:03.546
860462a0-396f-4db7-8aad-e307c0d6abfd	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	48b4aa9f-dca7-4157-b53b-826abc46ffc1	Submission	{"status": "graded", "taskType": "simulation"}	2026-04-25 16:51:53.066
50a6d226-312f-4786-a526-049e5b992d64	course.update	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	940bbe23-6172-40bf-bc7f-b22a1840a1de	course	{"fields": ["description"]}	2026-04-26 03:12:31.425
eb84d14b-9946-4ce0-b8be-5aeedaedecf4	course.update	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	940bbe23-6172-40bf-bc7f-b22a1840a1de	course	{"fields": ["description"]}	2026-04-26 03:34:55.934
065d565c-dc65-4a5a-9183-bdd1c4d0c254	submission.grade	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2112b3c1-a1a5-4cb3-bc73-c083e5198860	submission	{"score": 88, "maxScore": 100, "hasFeedback": true, "hasRubricBreakdown": true}	2026-04-26 03:43:30.277
001780d1-e2f2-4d04-88cd-387fcf52831c	submission.grade	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2112b3c1-a1a5-4cb3-bc73-c083e5198860	submission	{"score": 75, "maxScore": 100, "hasFeedback": false, "hasRubricBreakdown": false}	2026-04-26 03:43:40.017
0ffbab52-e5d9-4ef7-98dc-dc95ea29ac09	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	2112b3c1-a1a5-4cb3-bc73-c083e5198860	Submission	{"status": "graded", "taskType": "simulation"}	2026-04-26 03:45:13.061
7644a6c2-a4f1-4962-85e1-d4b27a934f49	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	2543aa52-c6c0-432a-9c25-2e4706a1797b	Submission	{"status": "graded", "taskType": "quiz"}	2026-04-26 03:46:31.675
bc918aeb-0d4b-46b4-9ea4-13f289d7202f	taskInstance.publish	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	7db59a62-e806-44c6-b102-e767f61ed8bb	TaskInstance	\N	2026-04-26 14:06:53.139
7febe46b-fe8c-4337-8c35-5aac42b6dfc2	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	91906941-2786-4352-b161-0882ce371b05	Submission	{"status": "graded", "taskType": "quiz"}	2026-04-26 16:39:41.583
3f9597e2-2015-4f55-b11b-165787302d88	instance_release_mode_changed	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	ca3b34d3-815e-49ac-b760-21df5ec4eb74	taskInstance	{"newMode": "manual", "previousMode": "manual", "newAutoReleaseAt": null, "previousAutoReleaseAt": null}	2026-04-26 16:40:13.474
186fe3ed-f3b4-47ba-93ec-f81824b74bc1	submission_released	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	91906941-2786-4352-b161-0882ce371b05	submission	{"studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "taskInstanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "previousReleasedAt": null}	2026-04-26 16:40:21.085
1f4f05e4-34a3-40a3-b5cf-392c271245c4	submission_unreleased	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	91906941-2786-4352-b161-0882ce371b05	submission	{"studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "taskInstanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "previousReleasedAt": "2026-04-26T16:40:21.078Z"}	2026-04-26 16:40:27.816
1c322823-2b2a-42cb-83e0-3f3aad369c33	submission_released	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	91906941-2786-4352-b161-0882ce371b05	submission	{"studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "taskInstanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "previousReleasedAt": null}	2026-04-26 16:40:47.858
99a87e0f-7a60-4787-bd38-985a2e8212d5	submission_unreleased	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	91906941-2786-4352-b161-0882ce371b05	submission	{"studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "taskInstanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "previousReleasedAt": "2026-04-26T16:40:47.850Z"}	2026-04-26 16:40:57.366
afa90cb1-a4a8-4967-92db-f047d04c16c3	instance_release_mode_changed	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	ca3b34d3-815e-49ac-b760-21df5ec4eb74	taskInstance	{"newMode": "auto", "previousMode": "manual", "newAutoReleaseAt": "2026-04-26T16:36:15.000Z", "previousAutoReleaseAt": null}	2026-04-26 16:41:15.263
49532247-ed56-4ec6-914d-cd95c5134dfe	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	76ec74d1-0544-4216-a045-3a185c4e407d	Submission	{"status": "graded", "taskType": "quiz"}	2026-04-26 16:42:19.22
c500561e-5c54-4c99-82d8-cb065887d25d	instance_release_mode_changed	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	ca3b34d3-815e-49ac-b760-21df5ec4eb74	taskInstance	{"newMode": "auto", "previousMode": "auto", "newAutoReleaseAt": "2026-04-26T16:47:33.000Z", "previousAutoReleaseAt": "2026-04-26T16:36:15.000Z"}	2026-04-26 16:42:33.419
f00c6410-6569-4470-9944-581e0502a4c0	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	9c6ce38a-30a3-4573-bcd1-94d1db292582	Submission	{"status": "graded", "taskType": "quiz"}	2026-04-26 16:45:24.209
622f57e3-0873-47df-ad4f-375a6abfff7e	instance_release_mode_changed	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	ca3b34d3-815e-49ac-b760-21df5ec4eb74	taskInstance	{"newMode": "auto", "previousMode": "auto", "newAutoReleaseAt": "2026-04-26T16:40:57.000Z", "previousAutoReleaseAt": "2026-04-26T16:47:33.000Z"}	2026-04-26 16:45:57.368
58544b5e-ca76-41f9-b583-5b3c1ff8ddac	auto_release_batch	\N	\N	submission	{"ids": ["9c6ce38a-30a3-4573-bcd1-94d1db292582", "91906941-2786-4352-b161-0882ce371b05"], "scannedAt": "2026-04-26T16:46:08.333Z", "affectedCount": 2, "instanceCount": 1}	2026-04-26 16:46:08.353
48f5fadb-5958-43b1-916b-751e73b727a9	submission_released_batch	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	submission	{"ids": ["9c6ce38a-30a3-4573-bcd1-94d1db292582", "91906941-2786-4352-b161-0882ce371b05"], "skippedCount": 0, "affectedCount": 2, "requestedCount": 2}	2026-04-26 16:46:31.29
d6af3a6c-68bb-4838-8528-3f170aab887a	submission_unreleased_batch	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	submission	{"ids": ["9c6ce38a-30a3-4573-bcd1-94d1db292582", "91906941-2786-4352-b161-0882ce371b05"], "skippedCount": 0, "affectedCount": 2, "requestedCount": 2}	2026-04-26 16:46:31.406
f7b85076-0465-4f45-bd63-6e501775a079	instance_release_mode_changed	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	ca3b34d3-815e-49ac-b760-21df5ec4eb74	taskInstance	{"newMode": "auto", "previousMode": "manual", "newAutoReleaseAt": "2026-04-30T10:00:00.000Z", "previousAutoReleaseAt": null}	2026-04-26 17:05:26.258
44a93d8e-3156-4207-a886-2d8b202a6896	instance_release_mode_changed	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	ca3b34d3-815e-49ac-b760-21df5ec4eb74	taskInstance	{"newMode": "manual", "previousMode": "auto", "newAutoReleaseAt": null, "previousAutoReleaseAt": "2026-04-30T10:00:00.000Z"}	2026-04-26 17:05:41.656
ad51bf4d-f906-40f7-97e2-ca9ca223f3f5	submission_released_batch	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	submission	{"ids": [], "skippedCount": 0, "affectedCount": 0, "requestedCount": 1}	2026-04-26 17:07:09.979
8b44ebca-90a2-46f1-92f1-6397bd172f08	instance_release_mode_changed	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	ca3b34d3-815e-49ac-b760-21df5ec4eb74	taskInstance	{"newMode": "auto", "previousMode": "manual", "newAutoReleaseAt": null, "previousAutoReleaseAt": null}	2026-04-26 17:07:41.571
33d2144c-8591-4916-8d45-e4722625e123	instance_release_mode_changed	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	ca3b34d3-815e-49ac-b760-21df5ec4eb74	taskInstance	{"newMode": "manual", "previousMode": "auto", "newAutoReleaseAt": null, "previousAutoReleaseAt": null}	2026-04-26 17:07:41.638
3fb1e2ca-0e80-481f-bfee-dded3e01659a	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	816af1ce-d952-4cd9-ad43-f7e7ce3b328b	Submission	{"status": "graded", "taskType": "quiz"}	2026-04-26 17:23:01.299
58bf1db2-5cf3-43f1-a1fe-bcf8f071ee88	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	37bbc48b-6daf-4edb-a57e-54381d252943	Submission	{"status": "graded", "taskType": "quiz"}	2026-04-26 17:27:26.373
e01c4056-e7bb-454d-9131-fb5e4e1f64b6	submission_released	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	37bbc48b-6daf-4edb-a57e-54381d252943	submission	{"studentId": "dcb6638a-264a-4bbb-ae7a-b1c646f07c5e", "taskInstanceId": "ca3b34d3-815e-49ac-b760-21df5ec4eb74", "previousReleasedAt": null}	2026-04-26 17:27:58.393
ae6db85b-6af4-4a63-9532-512b8f187d13	taskInstance.publish	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	1fa6bbbb-6af7-403a-9a0c-bd12788af322	TaskInstance	\N	2026-04-27 01:30:17.338
73821df7-8c5b-4b46-81d4-b09370b960d0	contentBlock.delete	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	31782115-ed8c-4bf3-9293-6a5644594d14	contentBlock	\N	2026-04-27 02:29:39.554
718663e9-58ed-438e-8fbe-e92aa1b7839e	contentBlock.delete	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	6675c503-c89b-46dd-92d5-bd0437385098	contentBlock	\N	2026-04-27 12:53:26.244
f0590320-5a21-41d2-8441-c4c555c75f07	taskInstance.publish	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	a7d9b380-49fd-4ce2-9d95-000935ac0c5a	TaskInstance	\N	2026-04-27 12:56:16.255
1d125578-0a5c-402d-9c48-f8cd6103d58b	submission.grade	236c3795-f19f-4107-a681-0bc0e1d21d62	ce37c24e-86b6-4b03-815e-fc71eed84a9a	Submission	{"status": "graded", "taskType": "quiz"}	2026-04-30 06:42:30.57
891d91f6-dcc5-4ed6-90b2-01f33a563fd3	submission.grade	236c3795-f19f-4107-a681-0bc0e1d21d62	4145932c-a4a8-4d3d-9916-83c3a973fd0c	Submission	{"status": "graded", "taskType": "simulation"}	2026-04-30 06:55:28.423
e48f8a2c-6d61-43eb-b8a2-8f1bcd472727	submission.grade	236c3795-f19f-4107-a681-0bc0e1d21d62	205d9ffd-b8ab-444c-aa6e-e59c96713206	Submission	{"status": "graded", "taskType": "subjective"}	2026-04-30 07:08:19.984
5c3903de-5442-4f32-86f4-02166d391b08	taskInstance.createWithTask.publish	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	449ae28c-8913-43f5-adda-dc296885071b	TaskInstance	{"taskId": "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9"}	2026-04-30 08:52:12.894
2914f664-cccb-4f98-92c7-e0567505d87e	taskInstance.createWithTask.publish	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	8fc5026b-1af3-44fa-8fd4-b2dc2b5963b2	TaskInstance	{"taskId": "23cf5a65-595e-469a-a02f-5cd27bec5e1a"}	2026-05-02 09:18:06.122
5cf98cfd-7c3f-4382-955b-f6023f8086d8	submission.grade	edad1bc2-43ae-4598-8e12-1053ef4eb964	32b9381c-8b6c-44cd-93ce-1d18b1049020	Submission	{"status": "graded", "taskType": "simulation"}	2026-05-02 09:37:33.651
660c0b5b-51da-4e0c-9b6e-abfc6b3d4805	submission.grade	32575dd0-e927-408b-ba9f-7f003bfd60d6	899deebd-fb2f-42d2-8c78-05883e61294a	Submission	{"status": "graded", "taskType": "subjective"}	2026-05-02 09:40:18.127
0581936a-a5cd-4123-ad90-21dca204a9c4	submission_released	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	32b9381c-8b6c-44cd-93ce-1d18b1049020	submission	{"studentId": "edad1bc2-43ae-4598-8e12-1053ef4eb964", "taskInstanceId": "f1494008-e987-4576-b5e5-4a304d0ec822", "previousReleasedAt": null}	2026-05-02 09:41:13.682
54625499-8b34-4f66-9066-e32e8da5ecf3	submission.grade	236c3795-f19f-4107-a681-0bc0e1d21d62	17045c66-06a3-4d1f-866d-4dfe0cab7a51	Submission	{"status": "graded", "taskType": "subjective"}	2026-05-02 09:45:01.503
a728beef-ce30-4d07-b250-23d68911b8df	submission.grade	236c3795-f19f-4107-a681-0bc0e1d21d62	ce7f935d-5ed0-4af0-9aeb-53a527de372c	Submission	{"status": "graded", "taskType": "quiz"}	2026-05-02 09:46:15.763
5bc29a7c-620c-4edf-8032-81916677a950	submission.grade	236c3795-f19f-4107-a681-0bc0e1d21d62	4a3f639d-ab10-4d2c-bd74-9ac0f7cf5c4e	Submission	{"status": "graded", "taskType": "quiz"}	2026-05-02 10:04:16.442
de722593-5a7d-4096-8507-39f0de45baae	submission_released	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	4a3f639d-ab10-4d2c-bd74-9ac0f7cf5c4e	submission	{"studentId": "236c3795-f19f-4107-a681-0bc0e1d21d62", "taskInstanceId": "b7ca71ef-7239-4844-b0bd-29e1b444be61", "previousReleasedAt": null}	2026-05-02 10:05:36.775
4e83a9f0-5a59-452a-9cd5-2bd8accfb805	contentBlock.delete	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	066a9404-617f-4713-aa7c-aaf5dd52421d	contentBlock	\N	2026-05-05 00:54:24.382
1f1e538c-cc0c-45f2-b5eb-6fc6eefc9d2a	submission.grade	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	a37cb4dc-2fce-4b18-9c04-381bb1d514cb	Submission	{"status": "graded", "taskType": "simulation"}	2026-05-07 01:39:42.436
\.


--
-- Data for Name: Chapter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Chapter" (id, "courseId", title, "order", "createdBy", "createdAt") FROM stdin;
a44443f2-af76-4e45-b467-d6f55576e212	940bbe23-6172-40bf-bc7f-b22a1840a1de	投资工具入门	1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.27
894fbab1-f4b1-4c39-a57c-c95d73577ed8	940bbe23-6172-40bf-bc7f-b22a1840a1de	风险与资产配置	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.274
d22f7150-645d-4f1f-af94-c41efb4bca67	8f7f653c-9177-44f6-b764-80f7f779b2ef	投资组合理论	0	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-04-13 13:30:54.206
3e7e8bac-c2a8-4da8-9065-87c2d77a32bb	e6fc049c-756f-4442-86da-35a6cdbadd6e	投资工具入门	1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.494
c80664af-66db-4127-bd6a-46bb15513be1	e6fc049c-756f-4442-86da-35a6cdbadd6e	风险与资产配置	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.496
baf9c3d6-b36d-4b72-abbc-98b96eb49443	e6fc049c-756f-4442-86da-35a6cdbadd6e	理财基础概念	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.487
d73bf6ea-9c1b-4d44-a190-5165917a14c2	940bbe23-6172-40bf-bc7f-b22a1840a1de	理财基础概念	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.262
e8d705d0-3d1f-480a-8a97-0e71d0e6a832	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	理财基础概念	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.474
fdbbe65f-5645-43a6-9468-23dcb3b252a6	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	投资工具入门	1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.481
2af5c382-dbc8-49d9-ac9c-1ae722ce55ad	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	风险与资产配置	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.484
00000000-0000-4000-8000-00000000a301	00000000-0000-4000-8000-00000000a201	理财基础概念	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.548
00000000-0000-4000-8000-00000000a302	00000000-0000-4000-8000-00000000a201	风险与资产配置	1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.549
00000000-0000-4000-8000-00000000b301	00000000-0000-4000-8000-00000000a202	理财基础概念	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.55
\.


--
-- Data for Name: Class; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Class" (id, name, code, "academicYear", "departmentName", "createdBy", "createdAt", "updatedAt") FROM stdin;
deedd844-e302-4b20-903d-d9b1d0e12439	金融2024A班	FIN-2024-A	2024	金融学院	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.215	2026-02-21 09:55:53.215
1dbdc794-23c9-48dd-ba40-f0fbec3a1257	金融2024B班	FIN-2024-B	2024	金融学院	ebbbeb19-a273-4bff-8289-f77abcbeb3fc	2026-02-21 09:55:53.232	2026-02-21 09:55:53.232
\.


--
-- Data for Name: ContentBlock; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ContentBlock" (id, "courseId", "chapterId", "sectionId", slot, "blockType", "order", data, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Course; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Course" (id, "courseTitle", "courseCode", description, "classId", "versionId", "createdBy", "createdAt", "updatedAt", "semesterStartDate") FROM stdin;
893aae18-c98b-4f02-ab4a-2b21d195025e	投资分析基础	FIN302	学习股票、债券、基金等金融产品的分析方法和投资决策框架。	1dbdc794-23c9-48dd-ba40-f0fbec3a1257	v1	ebbbeb19-a273-4bff-8289-f77abcbeb3fc	2026-02-21 09:55:53.26	2026-02-21 09:55:53.26	\N
d7906ea6-ab8a-44c3-b626-7dd3d8f4295e	投资分析基础	FIN302	学习股票、债券、基金等金融产品的分析方法和投资决策框架。	1dbdc794-23c9-48dd-ba40-f0fbec3a1257	v1	ebbbeb19-a273-4bff-8289-f77abcbeb3fc	2026-04-22 06:54:51.487	2026-04-22 06:54:51.487	\N
e6fc049c-756f-4442-86da-35a6cdbadd6e	个人理财规划	FIN301	本课程涵盖个人理财的基本概念、投资策略、风险管理和财务规划。	deedd844-e302-4b20-903d-d9b1d0e12439	v1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.483	2026-04-22 16:33:13.469	2026-02-16 00:00:00
8f7f653c-9177-44f6-b764-80f7f779b2ef	个人规划	\N		deedd844-e302-4b20-903d-d9b1d0e12439	v1	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-04-13 13:30:45.081	2026-04-26 01:07:13.39	\N
940bbe23-6172-40bf-bc7f-b22a1840a1de	个人理财规划	FIN301	QA r3 audit smoke	deedd844-e302-4b20-903d-d9b1d0e12439	v1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.254	2026-04-26 03:34:55.93	2026-02-16 00:00:00
ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	个人理财规划	FIN301	本课程涵盖个人理财的基本概念、投资策略、风险管理和财务规划。	deedd844-e302-4b20-903d-d9b1d0e12439	v1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.458	2026-04-29 11:40:04.458	\N
c779198b-6340-4959-8536-ce03da8adb52	投资分析基础	FIN302	学习股票、债券、基金等金融产品的分析方法和投资决策框架。	1dbdc794-23c9-48dd-ba40-f0fbec3a1257	v1	ebbbeb19-a273-4bff-8289-f77abcbeb3fc	2026-04-29 11:40:04.473	2026-04-29 11:40:04.473	\N
00000000-0000-4000-8000-00000000a201	个人理财规划	ANL2-A	ANL-2 确定性教学诊断夹具：A 班有提交、待批改、低分和概念聚类。	deedd844-e302-4b20-903d-d9b1d0e12439	v1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.544	2026-04-29 11:40:04.544	\N
00000000-0000-4000-8000-00000000a202	个人理财规划	ANL2-B	ANL-2 确定性教学诊断夹具：同名 B 班隔离验证。	1dbdc794-23c9-48dd-ba40-f0fbec3a1257	v1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.547	2026-04-29 11:40:04.547	\N
\.


--
-- Data for Name: CourseClass; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CourseClass" (id, "courseId", "classId", "createdAt") FROM stdin;
fc4f3472-606b-40e5-9aa9-31148400f059	893aae18-c98b-4f02-ab4a-2b21d195025e	1dbdc794-23c9-48dd-ba40-f0fbec3a1257	2026-02-21 09:55:53.26
200f2e91-da03-43c0-9da5-6bb9e8594459	940bbe23-6172-40bf-bc7f-b22a1840a1de	deedd844-e302-4b20-903d-d9b1d0e12439	2026-02-21 09:55:53.254
0fcfebdb-27af-4ea7-a374-2b92fabc85bd	940bbe23-6172-40bf-bc7f-b22a1840a1de	1dbdc794-23c9-48dd-ba40-f0fbec3a1257	2026-02-25 03:56:15.316
b3212065-31d5-4c4f-8828-76d569639f13	8f7f653c-9177-44f6-b764-80f7f779b2ef	deedd844-e302-4b20-903d-d9b1d0e12439	2026-04-13 13:30:45.091
\.


--
-- Data for Name: CourseKnowledgeSource; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CourseKnowledgeSource" (id, "courseId", "chapterId", "sectionId", "teacherId", kind, "fileName", "filePath", "mimeType", status, "extractedText", summary, "conceptTags", error, "createdAt", "updatedAt", "taskId", "taskInstanceId", "sourceType", "structuredData", tags) FROM stdin;
b015b457-c2d4-46f5-8680-9d05fb7bc4c6	00000000-0000-4000-8000-00000000a202	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	text	finsim-test-syllabus.md	2026-05-13/7bbf9a73-ec1c-4e26-b7b1-80a30c8ae817.md	text/markdown	ready	# 财务管理基础（测试大纲）\n\n## 课程目标\n\n本课程面向高职财经类专业学生，目标包括：理解财务管理基本原理；掌握资金的时间价值；熟悉企业融资与投资决策方法。\n\n## 第一章 财务管理导论\n\n### 1.1 财务管理的目标\n- 利润最大化与股东财富最大化的区别\n- 财务管理的基本职能\n\n### 1.2 财务管理的环境\n- 金融市场与金融工具\n- 公司治理结构\n\n## 第二章 资金的时间价值\n\n### 2.1 终值与现值\n- 单利与复利\n- 终值与现值公式与计算\n\n### 2.2 年金的计算\n- 普通年金、预付年金、永续年金\n- 年金应用：贷款分期、退休金规划\n\n## 第三章 投资决策\n\n### 3.1 投资决策评估方法\n- 净现值法（NPV）\n- 内部收益率法（IRR）\n- 投资回收期法\n\n### 3.2 投资风险分析\n- 敏感性分析\n- 情景分析\n- 决策树法	本课程面向高职财经类学生，涵盖财务管理基本原理、资金时间价值及投资决策方法。知识点包括财务管理目标与环境、终值与现值计算、年金应用（如贷款分期和退休规划），以及投资评估方法（如净现值法和内部收益率法）。题型线索涉及计算、应用和决策分析，教学目标旨在使学生理解基础理论、掌握关键计算技能并应用于实际决策。	{财务管理目标,财务管理环境,资金时间价值,终值,现值,单利,复利,年金,净现值法,内部收益率法,投资回收期,敏感性分析}	\N	2026-05-13 11:13:45.671	2026-05-13 11:15:17.094	\N	\N	syllabus	{"notes": "此草稿基于测试大纲生成，需要教师确认：1. 思政目标的具体化案例；2. 考核方式的权重和细节；3. 任务建议是否适合课堂实际教学进度。", "chapters": [{"order": 0, "title": "财务管理导论", "sections": [{"order": 0, "title": "财务管理的目标", "learningGoals": ["理解利润最大化与股东财富最大化的区别", "掌握财务管理的基本职能"], "knowledgePoints": ["利润最大化", "股东财富最大化", "财务管理职能"], "skillObjectives": ["能够比较和分析财务目标"], "taskSuggestions": [{"slot": "pre", "title": "财务管理目标预习测验", "taskType": "quiz", "rationale": "帮助学生预习基本概念，为课堂讨论做准备"}], "knowledgeObjectives": ["掌握财务管理目标的理论", "了解财务管理的职能"]}, {"order": 1, "title": "财务管理的环境", "learningGoals": ["了解金融市场和金融工具", "理解公司治理结构"], "knowledgePoints": ["金融市场", "金融工具", "公司治理结构"], "skillObjectives": ["能够识别金融工具", "能够分析公司治理案例"], "taskSuggestions": [{"slot": "in", "title": "案例分析：公司治理问题", "taskType": "subjective", "rationale": "通过案例讨论，加深对财务管理环境的理解"}], "knowledgeObjectives": ["掌握金融市场的基本类型", "了解公司治理的要素"]}], "learningGoals": ["理解财务管理的基本概念和目标", "了解财务管理的环境和职能"], "skillObjectives": ["能够区分不同财务目标", "能够分析财务管理环境的影响"], "knowledgeObjectives": ["掌握财务管理目标的两种观点", "了解金融市场和公司治理结构"]}, {"order": 1, "title": "资金的时间价值", "sections": [{"order": 0, "title": "终值与现值", "learningGoals": ["理解终值和现值的概念", "掌握单利和复利的计算"], "knowledgePoints": ["单利", "复利", "终值公式", "现值公式"], "skillObjectives": ["能够计算终值和现值"], "taskSuggestions": [{"slot": "in", "title": "终值与现值计算练习", "taskType": "quiz", "rationale": "课堂练习，巩固计算技能"}], "knowledgeObjectives": ["掌握终值和现值的定义", "了解单利和复利的应用"]}, {"order": 1, "title": "年金的计算", "learningGoals": ["理解不同类型年金", "掌握年金的计算和应用"], "knowledgePoints": ["普通年金", "预付年金", "永续年金", "年金应用"], "skillObjectives": ["能够计算各类年金", "能够应用年金解决实际问题"], "taskSuggestions": [{"slot": "post", "title": "贷款分期模拟", "taskType": "simulation", "rationale": "通过模拟应用，加深对年金计算的理解和实际应用能力"}], "knowledgeObjectives": ["掌握普通年金、预付年金、永续年金的概念", "了解年金在贷款和退休规划中的应用"]}], "learningGoals": ["掌握资金的时间价值概念", "能够计算终值、现值和年金"], "skillObjectives": ["能够进行资金时间价值的计算", "能够应用到实际场景如贷款和退休规划"], "knowledgeObjectives": ["理解单利和复利的区别", "掌握终值、现值和年金的公式"]}, {"order": 2, "title": "投资决策", "sections": [{"order": 0, "title": "投资决策评估方法", "learningGoals": ["掌握净现值法、内部收益率法和投资回收期法", "能够比较不同评估方法"], "knowledgePoints": ["净现值法（NPV）", "内部收益率法（IRR）", "投资回收期法"], "skillObjectives": ["能够计算NPV、IRR和投资回收期", "能够进行决策分析"], "taskSuggestions": [{"slot": "in", "title": "投资方案比较讨论", "taskType": "subjective", "rationale": "通过小组讨论，应用评估方法分析实际案例"}], "knowledgeObjectives": ["理解NPV、IRR和投资回收期的原理", "掌握计算方法"]}, {"order": 1, "title": "投资风险分析", "learningGoals": ["理解投资风险的概念", "掌握风险分析方法"], "knowledgePoints": ["敏感性分析", "情景分析", "决策树法"], "skillObjectives": ["能够进行敏感性分析", "能够构建决策树"], "taskSuggestions": [{"slot": "post", "title": "风险分析模拟项目", "taskType": "simulation", "rationale": "通过模拟项目，实践风险分析方法，提升综合应用能力"}], "knowledgeObjectives": ["了解敏感性分析、情景分析和决策树法", "掌握风险评估工具"]}], "learningGoals": ["掌握投资决策的评估方法", "理解投资风险分析"], "skillObjectives": ["能够应用评估方法进行投资决策", "能够进行投资风险分析"], "knowledgeObjectives": ["掌握净现值法、内部收益率法和投资回收期法", "了解敏感性分析、情景分析和决策树法"]}], "courseGoals": ["理解财务管理基本原理", "掌握资金的时间价值", "熟悉企业融资与投资决策方法"], "skillObjectives": ["能够计算终值、现值和年金", "能够应用净现值法、内部收益率法进行投资决策", "能够进行敏感性分析和情景分析"], "valueObjectives": ["培养财务决策的诚信意识和责任感", "理解财务管理在企业社会责任中的作用"], "knowledgeObjectives": ["掌握财务管理的基本概念和原理", "理解资金的时间价值计算方法", "熟悉投资决策的评估和风险分析"], "globalKnowledgePoints": ["财务管理基本原理", "资金的时间价值", "投资决策方法", "财务管理环境"], "assessmentRequirements": ["期末考试", "课堂测验", "小组项目", "模拟决策报告"]}	{课程大纲,课程结构,测试}
a67de771-1a52-40dd-9e88-234eba4245be	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	65053639-55f2-44bd-9f44-65a6d7d60bb3	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	pdf	个人理财-题库.pdf	2026-05-02/fac2b9f8-460b-4716-91ee-857bcbaf85d0.pdf	application/pdf	ready	【第 1 页】\n个人理财-题库\n\n1、稳健型投资者在进行资产配置时，主要配置高波动性的金融产品。\n答案：错误\n\n2、下列哪种金融工具最适合稳健型投资者？\nA、期货合约\nB、货币市场基金\nC、期权交易\nD、创业投资基金\n答案：B\n\n3、以下哪个选项不是稳健型投资者常见的投资渠道？\nA、定期存款\nB、债券基金\nC、股票型基金\nD、银行理财产品\n答案：C\n\n4、关于稳健型投资目标，以下说法错误的是？\nA、注重长期资本增值\nB、追求资金的绝对安全\nC、允许较高的短期波动\nD、希望获得稳定的现金流\n答案：C\n\n5、稳健型投资者可以将大部分资金投入到高收益的P2P平台。\n答案：错误\n\n6、稳健型投资者不需要关注宏观经济变化。\n答案：错误\n\n7、稳健型投资者在选择基金时，首要考虑的因素是？\nA、历史收益\nB、基金经理的名气\nC、风险水平\n\n【第 2 页】\nD、基金规模\n答案：C\n\n8、下列哪种投资方式最适合稳健型投资者的资产配置？\nA、全部投资于股票\nB、70%债券+30%股票\nC、全部投资于房地产\nD、60%股票+40%现金\n答案：B\n\n9、稳健型投资者的投资目标可以随时改变，无需考虑原有计划。\n答案：错误\n\n10、稳健型投资者应尽量避免任何投资风险。\n答案：错误\n\n11、下列哪种投资方式最适合保守型投资者？\nA、股票投资\nB、基金定投\nC、期货交易\nD、创业投资\n答案：B\n\n12、保守型投资者在资产配置中，应避免哪些行为？\nA、高杠杆投资\nB、分散投资\nC、频繁交易\nD、集中投资于低风险资产\nE、盲目追求高收益\n答案：ACE\n\n13、保守型理财只适合年轻人，不适合中年人。\n答案：错误\n\n14、关于基金投资，下列说法错误的是？\nA、基金可以帮助投资者实现分散投资\nB、基金由专业经理人进行管理\nC、基金只适合高净值人群\nD、基金投资可以降低个体投资者的操作成本\n\n【第 3 页】\n答案：C\n\n15、基金的费用率通常由哪些组成?\n\nA、管理费、托管费和销售服务费\n\nB、利息和手续费\n\nC、分红率和赎回费\n\nD、交易费和印花税\n\n答案：A\n\n16、以下哪种基金允许投资者随时申购和赎回?\n\nA、封闭式基金\n\nB、开放式基金\n\nC、ETF\n\nD、LOF\n\n答案：B\n\n17、基金投资的优势包括以下哪些?\n\nA、投资门槛低\n\nB、专业管理\n\nC、分散风险\n\nD、收益确定\n\nE、流动性高\n\n答案：ABCE\n\n18、关于基金的赎回规则，下列说法正确的是?\n\nA、开放式基金可随时赎回\n\nB、封闭式基金不可赎回\n\nC、赎回时可能收取一定费用\n\nD、赎回不影响基金运作\n\nE、赎回后资金立即到账\n\n答案：ABCD\n\n19、基金的费用率越高，说明基金表现越好。\n\n答案：错误\n\n20、封闭式基金的份额可以在交易所买卖。\n\n答案：正确\n\n21、请简述基金理财的风险控制。（简答题）\n\n【第 4 页】\n答案：（1）选择适合自己的基金类型。就长期统计平均而言，在同等条件下，股票基金的收益较高，风险也较高，混合基金次之，债券基金再次之，货币市场基金的收益和风险最低。投资人应根据自身的风险偏好来挑选适合投资的基金类型。\n\n（2）对自身财务状况进行长远规划。成熟市场的数据显示，基金的投资周期越长，亏损的可能性越小，基金定投投资超过十年的，亏损的几率接近于零。投资人还应根据自己的收入水平、投资理财规划和生活开支来合理安排基金定投比例，达到家庭资产增值目的。\n\n（3）稳定投资，避免频繁操作。基金定投是长期的理财规划，是一项有纪律的投资，不是短期进出获利的工具。\n\n22、在个人理财规划中，单身期稳健型投资者的核心目标是什么？\n\nA、追求高收益，承担高风险\n\nB、平衡收益与风险，注重资金安全\n\nC、完全规避风险，只投资储蓄产品\n\nD、以短期投机为主，不考虑长期规划\n\n答案：B\n\n23、以下关于基金的说法，哪一项是错误的？\n\nA、基金由专业基金经理进行管理\n\nB、基金投资门槛普遍较低，适合普通投资者\n\nC、基金收益一定高于银行存款利率\n\nD、基金种类繁多，可满足不同投资者的需求\n\n答案：C\n\n24、如果一个投资者想通过购买基金来实现每月固定收益，最适合选择哪种基金？\n\nA、股票型基金\n\nB、货币市场基金\n\nC、QDII基金\n\nD、REITs基金\n\n答案：B\n\n25、下列哪项不属于基金信息披露的主要内容？\n\nA、基金净值\n\nB、基金经理变动\n\nC、基金公司的办公地址\n\nD、持仓比例变化\n\n答案：C\n\n26、以下哪些是基金投资的特点？\n\nA、由专业经理人管理\n\nB、投资门槛高，适合富裕人群\n\nC、投资分散，降低单一风险\n\nD、流动性差，无法随时赎回\n\nE、具有一定的收益预期但不保本\n\n【第 5 页】\n答案: ACE\n\n27、关于稳健型投资组合的构建，以下说法正确的是?\n\nA、 应避免配置高波动率资产\n\nB、 应尽量减少债券比例以提高收益\n\nC、 需要考虑现金流需求\n\nD、 应以股票为主导资产\n\nE、 应注重资产配置的多样化\n\n答案: ACE\n\n28、以下哪些是基金风险的主要来源?\n\nA、 市场波动风险\n\nB、 信用风险\n\nC、 流动性风险\n\nD、 汇率风险\n\nE、 基金公司办公地点太远\n\n答案: ABCD\n\n29、一只基金的资产配置比例为：股票30%，债券60%，现金10%，这种配置体现了____型投资理念，其主要目的是为了在收益与____之间取得平衡。\n\n答案:\n\n稳健\n\n风险\n\n30、稳健型投资者通常会采用____策略，在投资过程中重视长期规划，同时根据自身风险承受能力调整资产配置，以确保资金的安全性和____。\n\n答案: 分散投资；稳定性；	素材围绕稳健型与保守型投资者的资产配置原则、风险偏好及适合的金融工具展开，重点考查对基金类型、风险控制和投资目标的理解。题型包括判断题、单选题、多选题和简答题，强调实际应用与基本概念辨析。教学目标是帮助中高职学生掌握个人理财中基础的投资分类、基金特性及合理配置策略。	{稳健型投资者,保守型投资者,基金类型与特点,资产配置,投资风险控制}	\N	2026-05-02 07:22:12.76	2026-05-02 07:22:37.019	\N	\N	\N	\N	{}
46d57c02-b5bc-494a-a64e-ce67f6486d07	e6fc049c-756f-4442-86da-35a6cdbadd6e	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	text	lingxi-course-outline.txt	2026-05-02/89a044c7-fe7b-4928-9aaf-14323438b35f.txt	text/plain	ready	个人理财规划课程大纲\n第一章 理财基础概念\n1.1 什么是个人理财：收入、支出、资产、负债、风险偏好\n1.2 财务目标设定：短期目标、中期目标、长期目标\n第二章 投资工具入门\n2.1 银行存款与理财：收益、流动性、风险\n2.2 基金投资基础：基金类型、费用、净值\n第三章 风险与资产配置\n3.1 风险认知与评估：风险承受能力、投资期限\n3.2 资产配置策略：现金、债券、基金、保险	本课程素材介绍了个人理财的基本概念，包括收入、支出、资产、负债及风险偏好等核心要素，并引导学生设定短、中、长期财务目标。内容涵盖常见投资工具如银行存款、理财产品和基金的基础知识，强调收益、风险与流动性之间的关系。课程还涉及风险评估方法和资产配置策略，帮助学生理解如何根据自身情况合理分配现金、债券、基金和保险等资产。	{个人理财基础,财务目标设定,投资工具,风险评估,资产配置}	\N	2026-05-02 13:50:04.781	2026-05-02 13:50:31.66	\N	\N	syllabus	{"notes": "建议教师确认：1）是否需增加防诈骗或校园贷相关内容；2）基金和保险部分是否需进一步简化；3）任务建议是否符合实际课时安排。", "chapters": [{"order": 0, "title": "理财基础概念", "sections": [{"order": 0, "title": "什么是个人理财", "knowledgePoints": ["收入与支出的基本概念", "资产与负债的区分", "风险偏好的含义"], "taskSuggestions": [{"slot": "pre", "title": "我的财务初印象小测验", "taskType": "quiz", "rationale": "通过简单选择题激活学生对日常收支、储蓄等已有经验，为理解理财概念做铺垫"}]}, {"order": 1, "title": "财务目标设定", "knowledgePoints": ["短期、中期、长期财务目标的定义", "目标设定的SMART原则（简化版）"], "taskSuggestions": [{"slot": "in", "title": "写下我的三个财务小目标", "taskType": "subjective", "rationale": "引导学生结合自身生活（如买手机、考驾照、升学）设定具体目标，增强课程代入感"}]}]}, {"order": 1, "title": "投资工具入门", "sections": [{"order": 0, "title": "银行存款与理财", "knowledgePoints": ["银行存款的收益计算", "理财产品流动性特点", "低风险投资的基本特征"], "taskSuggestions": [{"slot": "post", "title": "模拟选择：存定期还是买理财？", "taskType": "simulation", "rationale": "通过对比不同期限和收益的产品，帮助学生理解流动性与收益的权衡"}]}, {"order": 1, "title": "基金投资基础", "knowledgePoints": ["常见基金类型（货币型、债券型、混合型）", "基金费用构成", "基金净值的含义"], "taskSuggestions": []}]}, {"order": 2, "title": "风险与资产配置", "sections": [{"order": 0, "title": "风险认知与评估", "knowledgePoints": ["风险承受能力的影响因素", "投资期限与风险的关系"], "taskSuggestions": [{"slot": "in", "title": "我的风险类型小测试", "taskType": "quiz", "rationale": "使用简化问卷帮助学生初步判断自身风险偏好，为后续资产配置打基础"}]}, {"order": 1, "title": "资产配置策略", "knowledgePoints": ["现金、债券、基金、保险在配置中的作用", "分散投资的基本理念"], "taskSuggestions": []}]}], "globalKnowledgePoints": ["个人理财的基本流程", "财务安全意识", "理性消费与储蓄习惯", "常见金融产品的基本特征"]}	{课程大纲,课程结构}
b6243518-b534-4193-bc5e-3165db5489ca	e6fc049c-756f-4442-86da-35a6cdbadd6e	\N	\N	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	spreadsheet	个人理财-课程标准-编码表.xls	2026-05-02/68638249-8829-447d-9195-8dbc34d05b22.xls	application/vnd.ms-excel	ready	【表格：个人理财-课程标准-编码表.xls / 课程标准】\n学习任务（必填）,类型（必填）,技能/知识学习点（必填）,学习水平（必填）\n[1]投资者甄别,技能,[1-S1]了解个人理财基本概念与原理,[1-S1-1]能联系个人理财的基本概念与原理模拟理财规划的工作流程\n,,[1-S2]认识理财产品,[1-S2-1]能辨认不同的理财产品\n,,[1-S3]确定投资者风险偏好类型,[1-S3-1]能确定投资者的风险偏好类型\n,,,[1-S3-2]能为投资者匹配对应风险等级的理财产品\n,知识,[1-K1]个人理财基本概念与原理,[1-K1-1]说出个人投资理财的概念、动因、原则\n,,,[1-K1-2]简述理财规划的基本步骤\n,,[1-K2]投资理财的各种渠道,[1-K2-1]归纳比较个人投资理财的产品\n,,[1-K3]不同风险偏好投资者的特点,[1-K3-1]说出风险承受能力与风险等级匹配关系\n,,,[1-K3-2]简述不同类型投资人的投资特点及相应理财建议\n,,[1-K4]风险承受能力评级,[1-K4-1]归纳比较相应风险等级的理财产品的特点\n[2]目标值确定,技能,[2-S1]认识生命周期的四个阶段,[2-S1-1]能对照个人生命周期的四个阶段正确识别投资者的需求\n,,[2-S2]确定各阶段的理财目标,[2-S2-1]能区分生命周期不同阶段的理财目标\n,,[2-S3]确定对应的资产配置,[2-S3-1]能对不同阶段的投资人进行对应的资产配置\n,,[2-S4]计算货币的时间价值,[2-S4-1]会计算货币时间价值\n,,,[2-S4-2]能以正确的货币时间价值理念为客户制订理财规划\n,,[2-S5]计算投资的风险价值,[2-S5-1]会计算投资风险价值\n,,,[2-S5-2]能以正确的投资风险价值理念为客户制订理财规划\n,知识,[2-K1]个人生命周期的概念,[2-K1-1]说出个人生命周期的四个阶段及特点\n,,[2-K2]生命周期不同阶段的理财目标,[2-K2-1]归纳比较生命周期不同阶段的理财目标\n,,[2-K3]资产配置的方法,[2-K3-1]简述个人资产配置的步骤和内容\n,,[2-K4]货币时间价值的概念,[2-K4-1]说出货币时间价值的概念\n,,[2-K5]货币时间价值的计算方法,[2-K5-1]记住货币时间价值的计算方法\n,,[2-K6]投资风险的种类,[2-K6-1]列举投资风险的种类\n,,[2-K7]投资风险价值的计算方法,[2-K7-1]说出投资风险价值计算的步骤\n,,,[2-K7-2]记住投资风险价值的计算方法\n[3]指标化分析,技能,[3-S1]编制收入支出表,[3-S1-1]能正确编制收入支出表\n,,,[3-S1-2]能进行简单的财务状况指标分析\n,,,[3-S1-3]能根据财务状况指标给出家庭财务改进建议 \n,,[3-S2]编制资产负债表,[3-S2-1]能正确编制资产负债表\n,,,[3-S2-2]能进行简单的财务比率指标分析\n,,,[3-S2-3]能根据财务比率指标给出家庭财务改进建议\n,知识,[3-K1]收入支出表的概念,[3-K1-1]说出个人（家庭）收入支出表的概念\n,,[3-K2]收入支出表的编制,[3-K2-1]概述收入支出表的编制依据\n,,[3-K3]资产负债表的概念,[3-K3-1]说出个人（家庭）资产负债表的概念\n,,[3-K4]资产负债表的编制,[3-K4-1]概述资产负债表的编制依据\n,,[3-K5]财务指标的计算及分析方法,[3-K5-1]记住财务指标的计算及分析方法\n[4]单身期理财,技能,[4-S1]制定单身期保守型投资者的理财规划,[4-S1-1]能运用信用卡的理财技巧、风险控制方法为客户制订理财规划\n,,,[4-S1-2]能通过对比不同储蓄存款的区别从而进行阶梯储蓄\n,,,[4-S1-3]能运用储蓄存款的理财技巧为客户制订理财规划\n,,[4-S2]制定单身期稳健型投资者的理财规划,[4-S2-1]能运用基金的理财技巧、风险控制方法为客户制订理财规划\n,,,[4-S2-2]能够理解单笔投资和定投的区别\n,,,[4-S2-3]能计算基金每月的申购费用、净申购金额以及可申购份数\n,,[4-S3]制定单身期激进型投资者的理财规划,[4-S3-1]能运用基本面和技术面分析股票行情\n,,,[4-S3-2]能够区分系统性风险和非系统性风险带给投资者的损失\n,,,[4-S3-3]能运用股票的理财技巧、风险控制方法为客户制订理财规划\n,,[4-S4]收集单身期投资者理财需求并进行财务诊断,[4-S4-1]能收集和整理单身期投资者的基本情况和财务信息\n,,,[4-S4-2]能结合资产负债比率、个人（家庭）支出比率等指标进行财务分析\n,,,[4-S4-3]能根据相关比率诊断个人（家庭）财务风险\n,,,[4-S4-4]能对财务风险的防范与隔离防范有初步的认识\n,知识,[4-K1]信用卡的理财功能,[4-K1-1]说出信用卡的种类、收费项目、申请条件和办理流程\n,,,[4-K1-2]简述信用卡的理财技巧\n,,,[4-K1-3]简述信用卡理财的风险控制\n,,[4-K2]储蓄存款的理财功能,[4-K2-1]说出储蓄存款的概念和种类\n,,,[4-K2-2]简述储蓄存款的理财技巧\n,,[4-K3]基金的理财功能,[4-K3-1]说出基金（含互联网各类基金）的概念、购买渠道\n,,,[4-K3-2]简述基金的理财技巧\n,,,[4-K3-3]简述基金理财的风险控制\n,,[4-K4]股票的理财功能,[4-K4-1]说出股票的概念、股票投资的分析方法、股票交易的流程\n,,,[4-K4-2]简述股票的理财技巧\n,,,[4-K4-3]简述股票投资的风险及风险控制\n,,[4-K5]客户信息的收集与分析,[4-K5-1]简述收集客户信息的基本原则和关键步骤\n,,,[4-K5-2]了解企业对投资者财务分析的内容与流程\n[5]成长期理财,技能,[5-S1]制定成长期保守型投资者的理财规划,[5-S1-1]能运用个人住房贷款的理财技巧为客户制订理财规划\n,,,[5-S1-2]能通过计算等额本息还款法和等额本金还款法比较两种还款方式\n,,[5-S2]制定成长期稳健型投资者的理财规划,[5-S2-1]能运用人身保险的投保技巧为客户制订理财规划\n,,,[5-S2-2]能运用人身保险规划的主要步骤为投资者购买合适的保险产品\n,,[5-S3]制定成长期激进型投资者的理财规划,[5-S3-1]能运用汽车消费贷款的理财技巧为客户制订理财规划\n,,,[5-S3-2]能运用汽车保险的投保技巧为客户选择合适的汽车保险\n,,[5-S4]根据成长期投资者特点设定理财目标,[5-S4-1]能根据成长期投资者的基本情况和财务信息，设定合理的理财目标\n,,,[5-S4-2]能识别消费型理财目标和养老型理财目标的异同\n,,,[5-S4-3]能根据投资者风险属性的不同调整相应理财目标\n,知识,[5-K1]个人住房贷款的理财功能,[5-K1-1]说出个人住房贷款的概念和种类、申请条件、申请材料、办理流程\n,,,[5-K1-2]归纳个人住房贷款的还款方式、购房决策的注意事项\n,,[5-K2]人身保险的理财功能,[5-K2-1]说出人身保险的概念与分类、原理和投保原则\n,,,[5-K2-2]简述人身保险规划的主要步骤\n,,,[5-K2-3]简述购买人身保险的技巧\n,,[5-K3]汽车消费贷款的理财功能,[5-K3-1]说出汽车消费贷款的概念与类型、申请条件、贷款期限和还款方式\n,,,[5-K3-2]简述申请汽车贷款的技巧\n,,[5-K4]汽车保险的理财功能,[5-K4-1]说出汽车保险的概念与种类、投保方式\n,,[5-K5]理财目标的设定与调整,[5-K5-1]说出消费型理财目标和养老型理财目标的异同\n,,,[5-K5-2]了解企业对投资者理财目标设定与调整的方法\n[6]成熟期理财,技能,[6-S1]制定成熟期保守型投资者的理财规划,[6-S1-1]能运用二次置业的理财技巧、风险控制方法为客户制订理财规划\n,,,[6-S1-2]能对比大额可转让存单和定期存款的区别\n,,,[6-S1-3]能运用大额可转让存单的理财技巧为客户制订理财规划\n,,,[6-S1-4]能运用年金保险的理财技巧、风险控制方法为客户制订理财规划\n,,[6-S2]制定成熟期稳健型投资者的理财规划,[6-S2-1]能运用个人实盘外汇的买卖技巧、风险控制方法为客户制订理财规划\n,,,[6-S2-2]能运用分红型保险的理财技巧、风险控制方法为客户制订理财规划\n,,[6-S3]制定成熟期激进型投资者的理财规划,[6-S3-1]能运用黄金投资的理财技巧为客户制订理财规划\n,,,[6-S3-2]能运用投资连结保险的理财技巧、风险控制方法为客户制订理财规划\n,,[6-S4]根据成熟期投资者理财目标制定理财规划方案,[6-S4-1]能对成熟期投资者的理财目标进行可行性、现金流和敏感性分析\n,,,[6-S4-2]能针对成熟期投资者理财目标设计初步资产配置框架\n,,,[6-S4-3]能根据成熟期投资者理财目标制定理财规划方案\n,知识,[6-K1]二次置业的理财功能,[6-K1-1]说出二次置业的理财概念、贷款流程\n,,,[6-K1-2]简述二次置业理财技巧、风险控制\n,,[6-K2]大额可转让存单的理财功能,[6-K2-1]说出大额可转让存单的基本概念\n,,,[6-K2-2]归纳大额可转让存单和定期存款的区别\n,,,[6-K2-3]简述大额可转让存单的理财技巧\n,,[6-K3]年金保险的理财功能,[6-K3-1]说出年金保险的基本概念\n,,,[6-K3-2]简述年金保险的理财技巧、风险控制\n,,[6-K4]个人实盘外汇买卖的理财功能,[6-K4-1]说出个人实盘外汇买卖的概念、交易方式\n,,,[6-K4-2]简述个人实盘外汇的买卖技巧、风险控制\n,,[6-K5]分红型保险的理财功能,[6-K5-1]说出分红型保险的概念\n,,,[6-K5-2]简述分红型保险的理财技巧、风险控制\n,,[6-K6]黄金投资的理财功能,[6-K6-1]说出黄金投资的概念和种类\n,,,[6-K6-2]简述黄金投资的理财技巧\n,,[6-K7]投资连结保险的理财功能,[6-K7-1]说出投资连结保险的概念\n,,,[6-K7-2]简述投资连结保险的理财技巧、风险控制\n,,[6-K8]理财规划方案的制定,[6-K8-1]了解理财规划报告书的内容\n[7]退休期理财,技能,[7-S1]制定退休期保守型投资者的理财规划,[7-S1-1]能根据退休期理财的风险防范原则为客户选择合适的投资工具\n,,,[7-S1-2]能运用国债逆回购的理财技巧为客户制订理财规划\n,,,[7-S1-3]能运用货币型基金的理财技巧为客户制订理财规划\n,,[7-S2]制定退休期稳健型投资者的理财规划,[7-S2-1]能根据银行理财产品的特点为客户选择合适的理财产品\n,,,[7-S2-2]能运用利率债券的理财技巧为客户制订理财规划\n,,[7-S3]制定退休期积极型投资者的理财规划,[7-S3-1]能运用指数型基金的投资技巧为客户制订理财规划\n,,,[7-S3-2]能运用以房养老的投资技巧为客户制订理财规划\n,,[7-S4]定期评估退休期投资者理财规划方案,[7-S4-1]能完整阐述风险告知、理解定期审视的意义\n,,,[7-S4-2]能对退休期投资者理财规划方案进行定期评估\n,,,[7-S4-3]能根据定期评估结果对退休期理财规划方案进行动态调整\n,知识,[7-K1]退休期面临的风险及投资工具,[7-K1-1]说出退休养老面对的风险\n,,,[7-K1-2]说出退休期理财的风险防范原则以及投资工具\n,,[7-K2]国债逆回购的理财功能,[7-K2-1]简述国债逆回购的理财技巧\n,,[7-K3]货币型基金的理财功能,[7-K3-1]简述货币型基金的理财技巧\n,,[7-K4]银行理财产品的理财功能,[7-K4-1]说出银行理财产品的特点\n,,[7-K5]利率债券的理财功能,[7-K5-1]简述利率债券的理财技巧\n,,[7-K6]指数型基金的理财功能,[7-K6-1]简述指数型基金的投资技巧\n,,[7-K7]以房养老的理财功能,[7-K7-1]说出以房养老的概念\n,,,[7-K7-2]简述以房养老的投资技巧\n,,[7-K8]理财规划方案的定期评估,[7-K8-1]记住理财规划方案实施中评估与动态调整的方法	该课程标准覆盖个人理财的基础概念、生命周期各阶段的理财目标与资产配置、常见金融工具（如储蓄、基金、股票、保险、贷款等）的功能与风险控制，以及财务报表编制与指标分析等内容。教学强调通过技能训练模拟真实理财规划流程，包括投资者风险偏好识别、货币与风险价值计算、家庭财务诊断及方案动态调整。目标是培养学生具备为不同生命周期阶段和风险偏好的客户制定基础理财规划的能力。	{个人理财基本原理,生命周期理财,风险偏好与资产配置,财务报表与指标分析,常见金融工具应用}	\N	2026-05-02 15:17:48.204	2026-05-02 15:18:39.598	\N	\N	syllabus	{"notes": "章节划分基于生命周期主线，但部分知识点（如风险偏好、财务分析）具有跨章节复用性，建议教师确认是否需在多个章节重复强调；任务建议侧重体验式学习，具体实施需结合课时与实训条件调整。", "chapters": [{"order": 1, "title": "第一章 投资者甄别", "sections": [{"order": 1, "title": "1.1 个人理财基础认知", "knowledgePoints": ["个人投资理财的概念、动因与原则", "理财规划的基本步骤"], "taskSuggestions": [{"slot": "pre", "title": "理财动机小调查", "taskType": "quiz", "rationale": "通过简短问卷了解学生对理财的初始认知，激活先验经验"}]}, {"order": 2, "title": "1.2 理财产品识别与风险匹配", "knowledgePoints": ["常见理财产品类型", "投资者风险偏好类型", "风险等级与产品匹配关系"], "taskSuggestions": [{"slot": "in", "title": "风险偏好测试与产品配对模拟", "taskType": "simulation", "rationale": "让学生体验风险测评流程，并为虚拟客户匹配合适产品，强化实操理解"}]}]}, {"order": 2, "title": "第二章 生命周期与理财目标设定", "sections": [{"order": 1, "title": "2.1 生命周期阶段与理财需求", "knowledgePoints": ["个人生命周期四个阶段及特点", "各阶段典型理财目标"], "taskSuggestions": []}, {"order": 2, "title": "2.2 货币时间价值与资产配置基础", "knowledgePoints": ["货币时间价值概念与计算方法", "投资风险种类与风险价值计算", "资产配置基本步骤"], "taskSuggestions": [{"slot": "post", "title": "我的十年理财计划草图", "taskType": "subjective", "rationale": "引导学生结合自身年龄阶段，初步规划未来目标并尝试简单资产分配"}]}]}, {"order": 3, "title": "第三章 家庭财务分析工具", "sections": [{"order": 1, "title": "3.1 收入支出表编制与分析", "knowledgePoints": ["收入支出表概念与编制依据", "常用财务指标计算与分析方法"], "taskSuggestions": []}, {"order": 2, "title": "3.2 资产负债表编制与财务诊断", "knowledgePoints": ["资产负债表概念与编制依据", "资产负债比率、支出比率等指标应用"], "taskSuggestions": [{"slot": "in", "title": "家庭财务健康诊断练习", "taskType": "simulation", "rationale": "提供简化家庭数据，让学生编制报表并提出改进建议，培养财务分析能力"}]}]}, {"order": 4, "title": "第四章 单身期理财实务", "sections": [{"order": 1, "title": "4.1 保守型理财：信用卡与储蓄", "knowledgePoints": ["信用卡种类、费用与理财技巧", "储蓄存款类型与阶梯储蓄策略"], "taskSuggestions": []}, {"order": 2, "title": "4.2 稳健型理财：基金投资入门", "knowledgePoints": ["基金概念、购买渠道与定投区别", "基金费用计算与风险控制"], "taskSuggestions": []}, {"order": 3, "title": "4.3 激进型理财：股票投资基础", "knowledgePoints": ["股票概念与交易流程", "基本面/技术面分析简介", "系统性与非系统性风险"], "taskSuggestions": []}]}, {"order": 5, "title": "第五章 成长期理财实务", "sections": [{"order": 1, "title": "5.1 住房与保险规划", "knowledgePoints": ["住房贷款种类与还款方式比较", "人身保险分类与投保技巧"], "taskSuggestions": []}, {"order": 2, "title": "5.2 汽车消费与理财目标设定", "knowledgePoints": ["汽车贷款与保险知识", "消费型与养老型理财目标区别"], "taskSuggestions": []}]}, {"order": 6, "title": "第六章 成熟期理财实务", "sections": [{"order": 1, "title": "6.1 多元化投资工具应用", "knowledgePoints": ["二次置业、大额存单、年金保险", "外汇、分红险、黄金、投连险"], "taskSuggestions": []}, {"order": 2, "title": "6.2 理财方案制定与资产配置", "knowledgePoints": ["理财目标可行性分析", "现金流与敏感性分析", "资产配置框架设计"], "taskSuggestions": []}]}, {"order": 7, "title": "第七章 退休期理财实务", "sections": [{"order": 1, "title": "7.1 退休期投资工具选择", "knowledgePoints": ["退休面临的主要风险", "国债逆回购、货币基金、银行理财、利率债、指数基金、以房养老"], "taskSuggestions": []}, {"order": 2, "title": "7.2 理财方案的动态评估与调整", "knowledgePoints": ["定期评估的意义", "理财方案动态调整方法"], "taskSuggestions": [{"slot": "post", "title": "为长辈设计一份退休理财建议书", "taskType": "subjective", "rationale": "综合运用所学，关注实际家庭场景，提升社会责任感与应用能力"}]}]}], "globalKnowledgePoints": ["个人理财基本原则与流程", "生命周期各阶段财务特征与目标", "常见金融产品功能、风险与适用人群", "基础财务报表编制与分析能力", "货币时间价值与风险价值计算", "资产配置与理财方案制定逻辑"]}	{课程大纲,课程结构}
ca723c9c-6552-4a6e-9218-a91d517d2b23	00000000-0000-4000-8000-00000000a202	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	text	finsim-test-syllabus.md	2026-05-13/daaa1cb2-8b0c-4a88-91fb-330d2fff3209.md	text/markdown	ready	# 财务管理基础（测试大纲）\n\n## 课程目标\n\n本课程面向高职财经类专业学生，目标包括：理解财务管理基本原理；掌握资金的时间价值；熟悉企业融资与投资决策方法。\n\n## 第一章 财务管理导论\n\n### 1.1 财务管理的目标\n- 利润最大化与股东财富最大化的区别\n- 财务管理的基本职能\n\n### 1.2 财务管理的环境\n- 金融市场与金融工具\n- 公司治理结构\n\n## 第二章 资金的时间价值\n\n### 2.1 终值与现值\n- 单利与复利\n- 终值与现值公式与计算\n\n### 2.2 年金的计算\n- 普通年金、预付年金、永续年金\n- 年金应用：贷款分期、退休金规划\n\n## 第三章 投资决策\n\n### 3.1 投资决策评估方法\n- 净现值法（NPV）\n- 内部收益率法（IRR）\n- 投资回收期法\n\n### 3.2 投资风险分析\n- 敏感性分析\n- 情景分析\n- 决策树法	本课程面向高职财经类专业学生，涵盖财务管理基础，包括财务目标和环境等导论内容。核心知识点包括资金的时间价值计算，如终值、现值和年金应用。投资决策部分涉及净现值法、内部收益率法等评估方法及风险分析技术。教学目标旨在让学生理解基本原理、掌握时间价值、熟悉投资决策与风险管理方法。	{财务管理目标,金融市场,公司治理结构,终值,现值,单利,复利,普通年金,预付年金,永续年金,净现值法,内部收益率法}	\N	2026-05-13 11:03:54.476	2026-05-13 11:05:12.226	\N	\N	syllabus	{"notes": "请教师确认：1. 各章学习目标的层次深度是否适合您的学生？2. 任务建议的时机和形式是否符合您的教学设计？3. 考核要求中的比例分配是否需要调整？4. 知识点划分的颗粒度是否合适课堂讲解？请根据实际情况进行修改和补充。", "chapters": [{"order": 1, "title": "第一章 财务管理导论", "sections": [{"order": 1, "title": "1.1 财务管理的目标", "learningGoals": ["区分企业不同的财务目标", "了解财务管理的主要职能"], "knowledgePoints": ["利润最大化", "股东财富最大化", "财务管理的职能（筹资、投资、营运资金管理、利润分配）"], "skillObjectives": ["能够用简单例子说明不同财务目标可能导向的不同决策"], "taskSuggestions": [{"slot": "pre", "title": "课前思考：企业经营的目标是什么？", "taskType": "quiz", "rationale": "激活学生已有认知，引发对财务管理目标的思考。"}], "knowledgeObjectives": ["说出利润最大化与股东财富最大化的定义与主要区别", "列出财务管理的四大基本职能"]}, {"order": 2, "title": "1.2 财务管理的环境", "learningGoals": ["认识财务管理活动开展的外部和内部环境"], "knowledgePoints": ["金融市场", "金融工具（股票、债券）", "公司治理结构"], "skillObjectives": ["能够指出生活中接触到的金融工具或金融市场的实例"], "taskSuggestions": [{"slot": "in", "title": "模拟：公司治理角色扮演", "taskType": "simulation", "rationale": "通过角色扮演，直观理解股东大会、董事会、管理层在财务决策中的关系。"}], "knowledgeObjectives": ["描述金融市场（如股票市场、债券市场）和常见金融工具（股票、债券）", "解释公司治理结构的基本概念（如股东大会、董事会、管理层）"]}], "learningGoals": ["理解财务管理在企业运营中的核心地位", "明确财务管理的主要目标与基本职能", "认识财务管理活动所处的基本环境"], "skillObjectives": ["能够在案例中识别企业的财务管理目标", "能够初步分析一个企业财务管理所面临的外部环境"], "knowledgeObjectives": ["辨析利润最大化与股东财富最大化目标的优缺点", "描述财务管理的基本职能（筹资、投资、运营、分配）", "识别金融市场和金融工具的基本类型", "说明公司治理结构对财务管理的影响"]}, {"order": 2, "title": "第二章 资金的时间价值", "sections": [{"order": 1, "title": "2.1 终值与现值", "learningGoals": ["理解资金随时间增值的基本原理", "掌握终值与现值的计算"], "knowledgePoints": ["资金时间价值", "单利", "复利", "终值（FV）", "现值（PV）"], "skillObjectives": ["能根据给定利率和期数，计算一笔资金的终值或现值"], "taskSuggestions": [{"slot": "in", "title": "课堂讨论：储蓄与复利", "taskType": "subjective", "rationale": "结合个人储蓄案例，讨论复利对长期财富积累的巨大影响，加深理解。"}], "knowledgeObjectives": ["说出单利和复利的定义与计算区别", "列出复利终值系数（FVIF）和复利现值系数（PVIF）公式"]}, {"order": 2, "title": "2.2 年金的计算", "learningGoals": ["掌握等额系列收付款项（年金）的价值计算", "能将年金计算应用于实际生活场景"], "knowledgePoints": ["普通年金", "预付年金", "永续年金", "年金终值", "年金现值", "贷款分期", "退休规划"], "skillObjectives": ["能计算普通年金和预付年金的终值与现值", "能计算贷款分期偿还额或规划定期储蓄"], "taskSuggestions": [{"slot": "post", "title": "综合任务：我的购车贷款计划", "taskType": "subjective", "rationale": "要求学生应用年金现值原理，模拟计算不同贷款方案下的月供，学以致用。"}], "knowledgeObjectives": ["定义普通年金、预付年金和永续年金", "写出普通年金终值（FVA）、现值（PVA）公式", "说明预付年金与普通年金计算的关系"]}], "learningGoals": ["深刻理解资金时间价值的含义及其重要性", "掌握单利、复利条件下终值与现值的计算", "掌握各类年金的计算及其在实际中的应用"], "skillObjectives": ["能够正确计算单利和复利下的终值与现值", "能够正确计算普通年金和预付年金的终值与现值", "能够运用年金计算方法进行贷款分期还款额或退休储蓄计划的估算"], "knowledgeObjectives": ["阐述资金时间价值的含义", "区分单利与复利，并解释复利计算的原理", "记忆终值（FV）和现值（PV）的复利公式", "区分普通年金、预付年金、永续年金，并描述其特点", "记忆各类年金的终值与现值计算公式"]}, {"order": 3, "title": "第三章 投资决策", "sections": [{"order": 1, "title": "3.1 投资决策评估方法", "learningGoals": ["掌握几种基本的投资评估技术", "能运用NPV法进行简单决策"], "knowledgePoints": ["净现值法（NPV）", "内部收益率法（IRR）", "投资回收期"], "skillObjectives": ["能手工计算一个简单项目的NPV和回收期"], "taskSuggestions": [{"slot": "in", "title": "案例计算：是否购买新设备", "taskType": "simulation", "rationale": "提供一套具体的数据，让学生分组计算NPV和回收期，对比两种方法的结论，进行课堂演练。"}], "knowledgeObjectives": ["描述净现值（NPV）的计算步骤和决策标准（NPV > 0）", "描述内部收益率（IRR）的含义", "描述静态投资回收期的计算方法"]}, {"order": 2, "title": "3.2 投资风险分析", "learningGoals": ["认识投资决策中的不确定性", "了解几种常用的风险分析工具"], "knowledgePoints": ["敏感性分析", "情景分析", "决策树"], "skillObjectives": ["能够识别影响一个项目现金流的两三个关键假设变量"], "taskSuggestions": [{"slot": "post", "title": "小组报告：为某个小型投资项目做敏感性分析", "taskType": "subjective", "rationale": "要求学生结合第三章知识，针对一个假设项目，自行设定数据并分析关键风险变量，整合应用所学。"}], "knowledgeObjectives": ["说出敏感性分析的目的（找出最关键影响因素）", "说出情景分析的基本步骤", "简述决策树法的基本思路（针对序列决策）"]}], "learningGoals": ["了解企业进行项目投资评估的主要方法", "掌握净现值法（NPV）的基本原理与计算", "认识投资中风险分析的基本思路和方法"], "skillObjectives": ["能够计算简单投资项目的NPV，并根据NPV做出是否投资的判断", "能够计算简单项目的静态投资回收期", "能够运用敏感性分析思路，找出影响项目效益的关键变量"], "knowledgeObjectives": ["说明净现值（NPV）法的概念、计算公式和决策规则", "简述内部收益率（IRR）法的概念和决策规则", "简述投资回收期法的概念和优缺点", "识别敏感性分析、情景分析和决策树法的目的和应用场景"]}], "courseGoals": ["理解财务管理的基本原理和核心目标", "掌握资金时间价值的基本概念与计算方法", "能够运用基本的融资、投资决策方法进行简单分析", "培养严谨的数字观念、财务风险意识和价值创造思维"], "skillObjectives": ["能够计算资金的终值与现值", "能够计算普通年金和预付年金的终值与现值", "能够运用NPV、IRR或回收期法对简单的投资项目进行初步评估", "能够进行初步的贷款分期或退休储蓄方案计算", "能够运用敏感性或情景分析法识别项目的关键风险因素"], "valueObjectives": ["树立正确的财富观和价值创造导向，理解企业社会责任", "培养严谨、细致的财务核算态度和职业操守", "强化风险意识和诚信意识，理解金融市场规范的重要性", "增强在财务分析与决策中的逻辑思维和问题解决能力"], "knowledgeObjectives": ["区分利润最大化与股东财富最大化两种财务目标", "描述财务管理的基本职能与所处的内外部环境", "阐述单利、复利、终值、现值的概念及其相互关系", "解释普通年金、预付年金、永续年金的特点与计算公式", "说明净现值（NPV）、内部收益率（IRR）、投资回收期的基本含义与适用场景", "列举常见的投资风险分析方法（敏感性、情景分析、决策树）"], "globalKnowledgePoints": ["财务管理的目标与职能", "资金的时间价值（终值、现值、年金）", "投资决策评估（NPV、IRR、回收期）", "风险与不确定性分析"], "assessmentRequirements": ["采用过程性评价与终结性评价相结合的方式", "过程性评价包括：课堂参与、随堂练习、案例讨论、单元任务（如计算题、小报告）", "终结性评价以闭卷笔试为主，重点考察基本原理理解、核心公式应用和简单案例分析能力", "建议比例：过程性评价（40%-50%），终结性评价（50%-60%）"]}	{课程大纲,课程结构,测试}
93bfece8-ebf3-4c49-8f8b-339f092b605b	00000000-0000-4000-8000-00000000a202	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	text	finsim-test-questions.md	2026-05-13/0019afce-9167-4aa3-8b69-a3d61244b76c.md	text/markdown	ready	# 财务管理测试题库\n\n1. 货币时间价值的核心思想是？\nA. 现在的 1 元比将来的 1 元更有价值\nB. 将来的 1 元比现在的 1 元更有价值\nC. 现在和将来的 1 元价值相等\nD. 取决于汇率\n答案：A\n解析：货币具有时间价值，今天的钱可以投资产生收益。\n\n2. [多选] 以下哪些方法属于投资决策的评估方法？\nA. NPV\nB. IRR\nC. ROE\nD. Payback Period\n答案：A、B、D\n解析：ROE 是盈利能力指标，不是投资决策方法。\n\n3. [判断] 内部收益率 IRR 是使 NPV 为零的折现率。\n答案：对\n解析：IRR 定义即为使 NPV = 0 的折现率。\n\n[简答] 请简述净现值法（NPV）的优缺点。\n答案：优点：考虑货币时间价值，反映绝对价值贡献。缺点：依赖于折现率假设，难以比较规模差异较大的项目。	本素材以测试题库形式覆盖财务管理的核心知识点，包括货币时间价值、投资决策评估方法如净现值法（NPV）、内部收益率（IRR）和回收期法。题型涉及选择题、判断题和简答题，用于测试学生对基础概念的理解和应用能力。教学目标在于使学生掌握货币时间价值原理，并能分析和评价不同投资决策方法的优缺点。	{货币时间价值,NPV,IRR,回收期法}	\N	2026-05-13 11:07:37.474	2026-05-13 11:08:48.986	\N	\N	syllabus	{"notes": "1. 本目录草稿基于提供的测试题库推断而成，知识点深度和广度需教师根据具体学时和学生基础进行扩充或调整。2. “年金”部分可进一步细分为计算与应用。3. “投资决策初步分析”部分，可考虑增加对风险因素的简单定性讨论，或引入更贴近学生理解的案例（如开店、购买设备）。4. 任务建议仅为示例，需教师根据教学进程设计具体实施方案。", "chapters": [{"order": 0, "title": "货币时间价值基础", "sections": [{"order": 0, "title": "货币时间价值的概念与意义", "learningGoals": ["理解货币时间价值的本质。"], "knowledgePoints": ["货币时间价值定义", "机会成本", "通货膨胀因素"], "skillObjectives": ["能在生活实例中识别货币时间价值的体现。"], "taskSuggestions": [{"slot": "pre", "title": "小调查：今天的一万元和一年后的一万元，你更想要哪个？", "taskType": "quiz", "rationale": "通过简单选择题，在课程开始前激发学生思考，引出货币时间价值的核心矛盾。"}], "knowledgeObjectives": ["准确描述货币时间价值的核心思想。"]}, {"order": 1, "title": "终值与现值的计算", "learningGoals": ["掌握终值与现值的基本计算。"], "knowledgePoints": ["单利计算", "复利计算", "终值公式", "现值公式"], "skillObjectives": ["能正确列式并计算单笔现金流的终值与现值。", "能使用财务计算器或Excel的内置函数进行计算。"], "taskSuggestions": [{"slot": "in", "title": "储蓄计划计算器", "taskType": "simulation", "rationale": "在讲授公式后，让学生模拟一个简单的储蓄目标（如买车首付），计算不同利率和年限下需要每月存入多少钱，即时应用所学公式。"}], "knowledgeObjectives": ["区分单利与复利。", "定义并理解终值（FV）与现值（PV）公式。"]}, {"order": 2, "title": "年金的计算", "learningGoals": ["理解并计算系列等额现金流的价值。"], "knowledgePoints": ["普通年金", "即付年金", "年金现值公式", "年金终值公式"], "skillObjectives": ["能运用公式计算普通年金的现值与终值。", "能结合复利知识，解决包含年金的综合问题。"], "taskSuggestions": [{"slot": "post", "title": "房贷月供分析", "taskType": "subjective", "rationale": "在本章学习后，布置一个贴近生活的房贷计算作业，要求学生根据给定房价、首付比例、贷款年限和利率，计算月供总额，并简要分析利息负担，巩固年金知识并连接实际。"}], "knowledgeObjectives": ["定义年金，区分普通年金与即付年金。", "理解年金现值与终值公式的推导逻辑。"]}], "learningGoals": ["理解为什么今天的钱比未来的钱更有价值。", "掌握计算不同时点货币价值的基本方法。"], "skillObjectives": ["能使用单利与复利公式计算货币的终值与现值。", "能识别并计算普通年金与即付年金的现值与终值。"], "knowledgeObjectives": ["阐述货币时间价值的概念及其在经济活动中的重要性。", "定义现值、终值、利率、期数等基本概念。"]}, {"order": 1, "title": "投资决策初步分析", "sections": [{"order": 0, "title": "净现值法（NPV）", "learningGoals": ["掌握使用净现值法评估项目的基本流程。"], "knowledgePoints": ["净现值（NPV）定义", "折现率/必要报酬率", "NPV计算公式", "NPV决策法则"], "skillObjectives": ["能分步计算项目的净现值。", "能解释计算结果的财务意义。"], "taskSuggestions": [{"slot": "in", "title": "NPV计算小练习", "taskType": "quiz", "rationale": "在讲解公式和步骤后，立即通过一个结构清晰的计算题进行课堂练习，巩固核心计算技能。"}], "knowledgeObjectives": ["理解净现值的经济含义：项目为股东创造的价值。", "掌握NPV的计算公式及决策规则（NPV>0）。"]}, {"order": 1, "title": "内部收益率（IRR）与投资回收期", "learningGoals": ["了解另外两种常用的项目评估指标。"], "knowledgePoints": ["内部收益率（IRR）定义", "IRR决策法则（IRR>必要报酬率）", "投资回收期定义", "静态回收期计算", "各方法优缺点比较"], "skillObjectives": ["能通过试错法或工具求解简单的IRR。", "能计算静态投资回收期。", "能比较NPV与IRR、回收期法的异同。"], "taskSuggestions": [{"slot": "post", "title": "方法对比与选择", "taskType": "subjective", "rationale": "在学完本章后，提供一个包含两个互斥项目的案例，要求学生分别计算NPV、IRR和回收期，并讨论不同方法可能得出的矛盾结论及其原因，深化对各方法适用性的理解。"}], "knowledgeObjectives": ["定义内部收益率（IRR），理解其与NPV的关系。", "定义投资回收期（Payback Period）及其含义。"]}], "learningGoals": ["了解评估一个投资项目是否可行的基本方法。", "能够对不同的评估方法进行简单的比较和选择。"], "skillObjectives": ["能根据给定的现金流量表和折现率，计算项目的NPV和投资回收期。", "能根据IRR与基准收益率的比较，做出初步的接受/拒绝决策。", "能简要阐述NPV法与投资回收期法的优缺点。"], "knowledgeObjectives": ["说出净现值（NPV）、内部收益率（IRR）、投资回收期（Payback Period）的定义。", "理解NPV法则：NPV大于0则项目可行。"]}], "courseGoals": ["理解并运用财务管理的核心概念（货币时间价值）与基本工具（投资决策评估方法），进行简单的财务分析和决策。"], "skillObjectives": ["能够运用公式或工具计算给定现金流的终值与现值。", "能够解读并初步应用NPV、IRR、投资回收期等方法对简单投资项目进行评估分析。", "能够运用专业术语，简述各评估方法的优缺点。"], "valueObjectives": ["培养基于数据和理性分析进行财务决策的意识。", "在案例分析中融入诚实守信、规避过度风险等职业道德观念。"], "knowledgeObjectives": ["掌握货币时间价值的核心思想与基本计算（单利、复利、年金）。", "识别并理解净现值（NPV）、内部收益率（IRR）、投资回收期（Payback Period）等投资决策评估方法的概念与定义。", "区分盈利指标（如ROE）与投资决策评估方法的不同应用场景。"], "globalKnowledgePoints": ["货币时间价值", "单利与复利", "现值与终值", "年金", "净现值（NPV）", "内部收益率（IRR）", "投资回收期（Payback Period）", "折现率", "投资决策"], "assessmentRequirements": ["通过课堂测验（选择题、判断题）检验核心知识点的掌握程度。", "通过实操计算题检验货币时间价值相关计算技能。", "通过简答或案例分析题，检验对评估方法优缺点的理解与应用分析能力。"]}	{课程大纲,课程结构,测试,题库}
cd2e2dfc-ac9d-481d-b411-85e616a0ee67	00000000-0000-4000-8000-00000000a202	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	text	finsim-test-syllabus-bad.md	2026-05-13/c91f6e59-3fe5-4573-9db7-e9fea14c5035.md	text/markdown	ready	财务大纲（格式很乱版本）\n\n财务这门课要讲钱 主要是讲企业的钱怎么用 怎么找钱 怎么花钱\nchapter1: introduction; about money; talk about everything;1.1 history of finance, 1.2 something - 然后还有一些小节\n然后第二章 maybe 时间价值 包含若干小节但是没明确分开\n最后一章是 investment decision，covers NPV IRR payback period sensitivity 啥的\n\n没有什么明确的目标 也没明确的结构 但是这都是常见的题目素材	本课程素材涵盖财务管理的基础内容，包括企业资金的筹集、使用和投资决策。知识点涉及财务历史、时间价值以及投资评估技术如净现值、内部收益率、回收期和敏感性分析。教学目标聚焦于帮助学生理解财务核心概念，并掌握应对常见财务计算和案例分析题型的技能。	{财务管理,资金管理,时间价值,投资决策,净现值,内部收益率,回收期,敏感性分析}	\N	2026-05-13 11:08:43.787	2026-05-13 11:10:11.329	\N	\N	syllabus	{"notes": "需要教师确认章节划分是否合理，特别是小节内容深度和顺序；部分内容可能需要补充更多实例和练习；考核方式可根据中高职学生特点调整；思政融合点可进一步细化，如通过案例强调诚信和风险意识。", "chapters": [{"order": 0, "title": "财务管理导论", "sections": [{"order": 0, "title": "财务管理概述", "learningGoals": ["掌握财务管理的核心概念和基本目标。"], "knowledgePoints": ["财务管理的定义", "企业资金流程", "财务管理目标"], "skillObjectives": ["能够描述一个企业的财务管理活动。"], "taskSuggestions": [{"slot": "pre", "title": "财务管理概念预习测验", "taskType": "quiz", "rationale": "激发兴趣，检查学生对基本概念的初步理解。"}], "knowledgeObjectives": ["理解企业资金的循环过程；学习财务管理的范围和主要职能。"]}, {"order": 1, "title": "金融历史简介", "learningGoals": ["了解财务管理的历史演变，增强对当前实践的理解。"], "knowledgePoints": ["金融史关键事件", "历史对现代财务的影响"], "skillObjectives": ["能够讨论历史案例，提取对今天财务管理的启示。"], "taskSuggestions": [], "knowledgeObjectives": ["概述金融史的重要里程碑；学习历史事件如何影响现代财务管理。"]}, {"order": 2, "title": "企业财务管理环境", "learningGoals": ["认识财务管理的内外部环境因素。"], "knowledgePoints": ["财务管理环境因素", "企业组织形式"], "skillObjectives": ["能够分析环境因素如何影响一个企业的财务决策。"], "taskSuggestions": [], "knowledgeObjectives": ["识别影响财务管理的经济、法律和社会因素；学习企业组织形式对财务决策的影响。"]}], "learningGoals": ["理解财务管理的基本概念和重要性；了解财务管理的历史发展和当前环境。"], "skillObjectives": ["能够分析简单的企业财务案例，识别资金使用、筹集和投资的基本问题。"], "knowledgeObjectives": ["定义财务管理，描述其在企业中的角色；概述金融史的关键事件；识别财务管理的主要目标和环境因素。"]}, {"order": 1, "title": "货币时间价值", "sections": [{"order": 0, "title": "时间价值概念", "learningGoals": ["理解为什么货币有时间价值。"], "knowledgePoints": ["货币时间价值定义", "时间价值的影响因素"], "skillObjectives": ["能够解释时间价值在日常财务决策中的作用。"], "taskSuggestions": [], "knowledgeObjectives": ["定义货币时间价值；学习其背后的经济原理和影响因素。"]}, {"order": 1, "title": "现值和终值计算", "learningGoals": ["掌握单期和多期的现值与终值计算。"], "knowledgePoints": ["现值公式", "终值公式", "复利计算"], "skillObjectives": ["能够使用公式计算现值和终值；解决简单的时间价值问题。"], "taskSuggestions": [{"slot": "in", "title": "现值计算模拟练习", "taskType": "simulation", "rationale": "通过动手计算，加深对公式的理解和应用能力。"}, {"slot": "post", "title": "时间价值应用案例", "taskType": "subjective", "rationale": "巩固知识，并培养分析实际财务场景的能力。"}], "knowledgeObjectives": ["学习现值和终值的计算公式；理解复利和单利的区别。"]}, {"order": 2, "title": "年金计算", "learningGoals": ["掌握普通年金和先付年金的计算。"], "knowledgePoints": ["年金定义", "普通年金计算", "先付年金计算"], "skillObjectives": ["能够计算不同类型年金的现值和终值；应用于贷款或储蓄规划。"], "taskSuggestions": [], "knowledgeObjectives": ["学习年金的定义和类型；掌握年金现值和终值的计算公式。"]}, {"order": 3, "title": "应用实例", "learningGoals": ["将时间价值概念应用于实际财务问题。"], "knowledgePoints": ["贷款计算", "投资规划应用"], "skillObjectives": ["能够分析和解决简单的时间价值应用问题，如计算贷款还款额。"], "taskSuggestions": [], "knowledgeObjectives": ["学习时间价值在贷款、投资和退休规划中的应用。"]}], "learningGoals": ["掌握货币时间价值的概念和计算方法，并能应用于实际财务场景。"], "skillObjectives": ["能够计算现值、终值和年金；能够应用时间价值概念评估投资或储蓄方案。"], "knowledgeObjectives": ["理解时间价值的原理；学习现值、终值和年金的计算公式；掌握简单应用实例。"]}, {"order": 2, "title": "投资决策分析", "sections": [{"order": 0, "title": "投资决策概述", "learningGoals": ["了解投资决策的基本框架和步骤。"], "knowledgePoints": ["投资决策定义", "投资项目类型"], "skillObjectives": ["能够识别投资决策中的关键因素。"], "taskSuggestions": [], "knowledgeObjectives": ["定义投资决策；学习投资项目的分类和评估标准。"]}, {"order": 1, "title": "净现值(NPV)法", "learningGoals": ["掌握NPV的计算和应用。"], "knowledgePoints": ["NPV公式", "NPV决策规则"], "skillObjectives": ["能够计算NPV，并基于NPV做出投资建议。"], "taskSuggestions": [{"slot": "pre", "title": "NPV概念预习测验", "taskType": "quiz", "rationale": "确保学生理解基础概念，为课堂计算做好准备。"}], "knowledgeObjectives": ["学习NPV的定义、公式和决策规则；理解NPV的优缺点。"]}, {"order": 2, "title": "内部收益率(IRR)法", "learningGoals": ["掌握IRR的计算和应用。"], "knowledgePoints": ["IRR定义", "IRR计算", "IRR决策规则"], "skillObjectives": ["能够计算IRR，并评估投资项目。"], "taskSuggestions": [], "knowledgeObjectives": ["学习IRR的定义、计算方法和决策规则；比较IRR与NPV。"]}, {"order": 3, "title": "回收期法", "learningGoals": ["掌握回收期的计算和应用。"], "knowledgePoints": ["回收期定义", "回收期计算"], "skillObjectives": ["能够计算回收期，并用于投资评估。"], "taskSuggestions": [], "knowledgeObjectives": ["学习回收期的定义和计算方法；理解其优缺点和适用场景。"]}, {"order": 4, "title": "敏感性分析", "learningGoals": ["理解敏感性分析在投资决策中的作用。"], "knowledgePoints": ["敏感性分析定义", "敏感性分析步骤"], "skillObjectives": ["能够进行简单的敏感性分析，如调整假设条件看NPV变化。"], "taskSuggestions": [{"slot": "post", "title": "投资决策综合项目", "taskType": "subjective", "rationale": "综合应用所学知识，培养团队合作和实际问题解决能力。"}], "knowledgeObjectives": ["学习敏感性分析的定义和步骤；了解如何评估关键变量的影响。"]}], "learningGoals": ["掌握投资决策的基本评估方法，并能进行简单的投资项目分析。"], "skillObjectives": ["能够应用NPV、IRR和回收期法评估投资项目；能进行基本的敏感性分析。"], "knowledgeObjectives": ["理解投资决策的重要性；学习NPV、IRR、回收期和敏感性分析的概念和计算。"]}], "courseGoals": ["使学生理解企业财务管理的基本概念和目标，掌握货币时间价值和投资决策的基础知识与技能，能够应用所学解决实际财务问题。"], "skillObjectives": ["能够计算现值、终值和年金；能够应用NPV、IRR和回收期法评估投资项目；能进行简单的敏感性分析，并撰写投资建议报告。"], "valueObjectives": ["培养财务诚信意识、风险防范能力和团队合作精神；融入社会责任感和职业道德教育，树立正确的财务观。"], "knowledgeObjectives": ["掌握财务管理的定义、范围和环境；理解货币时间价值的原理和计算方法；熟悉净现值(NPV)、内部收益率(IRR)、回收期和敏感性分析等投资评估方法。"], "globalKnowledgePoints": ["货币时间价值", "净现值", "内部收益率", "回收期", "敏感性分析", "财务管理目标"], "assessmentRequirements": ["期末考试占50%，考察知识掌握；课堂参与和作业占30%，包括小测验和练习；小组项目占20%，应用投资决策分析。"]}	{课程大纲,课程结构,测试,容错}
b97c541b-bad3-4320-8233-3e714c838c11	00000000-0000-4000-8000-00000000a202	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	text	finsim-test-syllabus.md	2026-05-13/a666818d-6185-4f91-961b-1b0cef3af695.md	text/markdown	ready	# 财务管理基础（测试大纲）\n\n## 课程目标\n\n本课程面向高职财经类专业学生，目标包括：理解财务管理基本原理；掌握资金的时间价值；熟悉企业融资与投资决策方法。\n\n## 第一章 财务管理导论\n\n### 1.1 财务管理的目标\n- 利润最大化与股东财富最大化的区别\n- 财务管理的基本职能\n\n### 1.2 财务管理的环境\n- 金融市场与金融工具\n- 公司治理结构\n\n## 第二章 资金的时间价值\n\n### 2.1 终值与现值\n- 单利与复利\n- 终值与现值公式与计算\n\n### 2.2 年金的计算\n- 普通年金、预付年金、永续年金\n- 年金应用：贷款分期、退休金规划\n\n## 第三章 投资决策\n\n### 3.1 投资决策评估方法\n- 净现值法（NPV）\n- 内部收益率法（IRR）\n- 投资回收期法\n\n### 3.2 投资风险分析\n- 敏感性分析\n- 情景分析\n- 决策树法	本课程面向高职财经类专业学生，系统覆盖财务管理导论、资金的时间价值及投资决策基础。知识点包括财务管理目标与职能、金融市场与公司治理环境、终值与现值及年金的计算方法。教学重点涉及净现值法、内部收益率法等投资评估技术，以及敏感性分析等风险分析工具。题型线索涵盖计算题（如终值、年金计算）、概念辨析题（如财务管理目标区别）和应用题（如贷款分期、投资评估）。教学目标旨在培养学生理解基本原理、掌握计算技能并熟悉实际财务决策流程。	{财务管理目标,财务管理职能,金融市场,公司治理,资金时间价值,终值,现值,单利,复利,年金,净现值,内部收益率}	\N	2026-05-13 11:10:03.489	2026-05-13 11:11:29.278	\N	\N	syllabus	{"notes": "请教师根据学生实际水平调整案例难度和课堂活动；建议补充更多本地化或生活化实例以增强学习兴趣；思政目标可进一步融入职业道德和可持续发展理念。", "chapters": [{"order": 0, "title": "财务管理导论", "sections": [{"order": 0, "title": "财务管理的目标", "learningGoals": ["理解财务管理的不同目标及其优缺点"], "knowledgePoints": ["利润最大化", "股东财富最大化", "财务管理职能（计划、组织、领导、控制）"], "skillObjectives": ["能够解释不同目标如何影响企业决策"], "taskSuggestions": [{"slot": "pre", "title": "预习概念小测", "taskType": "quiz", "rationale": "通过简单测验激活学生对财务管理目标的先验知识，为课堂学习做准备。"}, {"slot": "in", "title": "案例讨论：目标选择", "taskType": "subjective", "rationale": "在课堂中引导学生讨论真实企业案例，深化对目标差异的理解。"}], "knowledgeObjectives": ["掌握利润最大化和股东财富最大化的区别", "熟悉财务管理的计划、组织、领导和控制职能"]}, {"order": 1, "title": "财务管理的环境", "learningGoals": ["理解财务管理所处的宏观和微观环境"], "knowledgePoints": ["金融市场（股票市场、债券市场）", "金融工具（股票、债券、贷款）", "公司治理（董事会、股东权利）"], "skillObjectives": ["能够分析环境因素如何影响财务管理决策"], "taskSuggestions": [{"slot": "in", "title": "模拟金融市场环境", "taskType": "simulation", "rationale": "通过模拟活动让学生体验金融市场波动，增强环境分析的实践能力。"}, {"slot": "post", "title": "环境分析报告", "taskType": "subjective", "rationale": "课后作业让学生分析本地企业环境，巩固知识并应用技能。"}], "knowledgeObjectives": ["认识金融市场与金融工具的基本类型", "了解公司治理结构的主要组成部分"]}], "learningGoals": ["理解财务管理的核心概念和环境背景"], "skillObjectives": ["能够分析财务管理目标在实际场景中的应用", "能够识别财务管理环境对企业决策的影响"], "knowledgeObjectives": ["区分利润最大化和股东财富最大化", "了解财务管理的基本职能", "理解金融市场与金融工具的类型", "了解公司治理结构的基本框架"]}, {"order": 1, "title": "资金的时间价值", "sections": [{"order": 0, "title": "终值与现值", "learningGoals": ["掌握终值和现值的计算原理"], "knowledgePoints": ["单利", "复利", "终值公式", "现值公式"], "skillObjectives": ["能够使用计算器或软件计算终值和现值"], "taskSuggestions": [{"slot": "pre", "title": "基础计算预热", "taskType": "quiz", "rationale": "通过简单计算题测试学生对单利复利的了解，为深入学习铺垫。"}, {"slot": "in", "title": "投资回报模拟", "taskType": "simulation", "rationale": "课堂模拟不同利率下的投资增长，直观展示时间价值。"}], "knowledgeObjectives": ["理解单利和复利的计算方式", "掌握终值（FV）和现值（PV）的公式"]}, {"order": 1, "title": "年金的计算", "learningGoals": ["掌握年金的类型和计算方法"], "knowledgePoints": ["普通年金", "预付年金", "永续年金", "年金应用案例"], "skillObjectives": ["能够计算各种年金的终值和现值", "能够运用年金知识解决实际财务问题"], "taskSuggestions": [{"slot": "post", "title": "个人财务规划作业", "taskType": "subjective", "rationale": "课后让学生设计简单的贷款或退休计划，将年金计算应用于实际场景。"}], "knowledgeObjectives": ["理解普通年金、预付年金和永续年金的区别", "熟悉年金在贷款分期和退休金规划中的应用"]}], "learningGoals": ["掌握资金时间价值的基本概念和计算方法"], "skillObjectives": ["能够计算不同场景下的终值、现值和年金", "能够应用年金解决实际生活问题，如贷款和退休规划"], "knowledgeObjectives": ["理解单利与复利的区别", "掌握终值和现值的公式与计算", "熟悉普通年金、预付年金和永续年金的概念"]}, {"order": 2, "title": "投资决策", "sections": [{"order": 0, "title": "投资决策评估方法", "learningGoals": ["掌握主要投资评估方法的计算和应用"], "knowledgePoints": ["净现值法（NPV）", "内部收益率法（IRR）", "投资回收期法"], "skillObjectives": ["能够计算NPV和IRR来评估项目", "能够使用回收期法进行初步筛选"], "taskSuggestions": [{"slot": "in", "title": "投资项目评估模拟", "taskType": "simulation", "rationale": "课堂模拟不同投资项目，让学生实践计算NPV和IRR，增强决策能力。"}], "knowledgeObjectives": ["理解净现值（NPV）的计算和决策标准", "掌握内部收益率（IRR）的求解和比较", "了解投资回收期法的优缺点"]}, {"order": 1, "title": "投资风险分析", "learningGoals": ["理解投资风险分析的基本工具"], "knowledgePoints": ["敏感性分析", "情景分析", "决策树法"], "skillObjectives": ["能够进行简单的敏感性分析和情景构建", "能够使用决策树法分析风险"], "taskSuggestions": [{"slot": "post", "title": "风险分析报告", "taskType": "subjective", "rationale": "课后作业让学生分析一个案例的投资风险，培养综合分析和报告能力。"}], "knowledgeObjectives": ["掌握敏感性分析、情景分析和决策树法的概念", "了解风险分析在投资决策中的重要性"]}], "learningGoals": ["熟悉投资决策的基本方法和风险分析"], "skillObjectives": ["能够应用NPV、IRR等方法评估投资项目可行性", "能够进行简单的投资风险分析"], "knowledgeObjectives": ["理解净现值法（NPV）、内部收益率法（IRR）和投资回收期法的原理", "掌握敏感性分析、情景分析和决策树法的基本概念"]}], "courseGoals": ["理解财务管理基本原理", "掌握资金的时间价值计算", "熟悉企业融资与投资决策方法"], "skillObjectives": ["能够计算终值、现值和年金", "能够应用净现值法（NPV）、内部收益率法（IRR）等评估投资项目", "能够进行简单的投资风险分析，如敏感性分析和情景分析"], "valueObjectives": ["培养财务决策的伦理意识和责任观念", "增强风险管理和团队协作能力", "提升分析问题和解决问题的批判性思维"], "knowledgeObjectives": ["理解财务管理的目标与职能", "掌握金融市场与公司治理的基本概念", "理解资金的时间价值原理与计算方法", "熟悉投资决策评估方法与风险分析工具"], "globalKnowledgePoints": ["资金的时间价值原理", "财务管理基础概念（目标、环境）", "投资决策评估方法（NPV、IRR、回收期）", "风险分析工具（敏感性、情景、决策树）"], "assessmentRequirements": ["理论考试（占40%）测试知识掌握", "实践作业和案例分析（占30%）评估技能应用", "课堂参与和小组项目（占20%）考核综合素养", "在线测验（占10%）巩固学习效果"]}	{课程大纲,课程结构,测试}
89e8163c-cb97-4831-9600-cdd799c3a899	00000000-0000-4000-8000-00000000a202	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	text	finsim-test-questions.md	2026-05-13/972f0f45-1dec-4931-b239-68339367e719.md	text/markdown	ready	# 财务管理测试题库\n\n1. 货币时间价值的核心思想是？\nA. 现在的 1 元比将来的 1 元更有价值\nB. 将来的 1 元比现在的 1 元更有价值\nC. 现在和将来的 1 元价值相等\nD. 取决于汇率\n答案：A\n解析：货币具有时间价值，今天的钱可以投资产生收益。\n\n2. [多选] 以下哪些方法属于投资决策的评估方法？\nA. NPV\nB. IRR\nC. ROE\nD. Payback Period\n答案：A、B、D\n解析：ROE 是盈利能力指标，不是投资决策方法。\n\n3. [判断] 内部收益率 IRR 是使 NPV 为零的折现率。\n答案：对\n解析：IRR 定义即为使 NPV = 0 的折现率。\n\n[简答] 请简述净现值法（NPV）的优缺点。\n答案：优点：考虑货币时间价值，反映绝对价值贡献。缺点：依赖于折现率假设，难以比较规模差异较大的项目。	素材介绍了财务管理中的货币时间价值核心思想，即现在的货币比未来的更有价值。涵盖了投资决策的评估方法，包括净现值（NPV）、内部收益率（IRR）和回收期（Payback Period），并区分了盈利能力指标（ROE）不属于此类。题型多样，如单选、多选、判断和简答，旨在帮助学生理解概念、应用工具和分析方法优缺点。教学目标包括掌握货币时间价值原理、识别投资决策工具、以及评估净现值法的优缺点。	{货币时间价值,净现值,内部收益率,回收期,投资决策评估方法}	\N	2026-05-13 11:11:23.92	2026-05-13 11:12:25.128	\N	\N	syllabus	{"notes": "1. 章节标题需根据最终课程正式名称进行调整。2. “小节标题”中的“小节”可能对应大纲中的“学习单元”或“模块”。3. 具体计算公式的详细程度和案例复杂度需根据中高职学生数学基础进一步调整。4. taskSuggestions中的“simulation”具体形式（如软件模拟、角色扮演、实物沙盘等）需教师根据教学条件设计。", "chapters": [{"order": 1, "title": "货币的时间价值", "sections": [{"order": 1, "title": "什么是货币的时间价值", "learningGoals": ["理解“今天的钱比明天的钱更值钱”的核心理念"], "knowledgePoints": ["货币时间价值的核心思想", "机会成本的概念"], "skillObjectives": ["能举例说明日常生活中体现货币时间价值的场景"], "taskSuggestions": [{"slot": "in", "title": "概念辨析选择题", "taskType": "quiz", "rationale": "在讲解核心定义后，通过选择题即时检验学生对基础概念的理解，快速反馈。"}], "knowledgeObjectives": ["掌握货币时间价值的定义与核心思想"]}, {"order": 2, "title": "利息的计算：单利与复利", "learningGoals": ["掌握单利和复利的计算方法，理解复利效应"], "knowledgePoints": ["单利计算公式", "复利计算公式", "复利效应"], "skillObjectives": ["能运用公式进行终值和现值的计算"], "taskSuggestions": [{"slot": "post", "title": "储蓄目标规划模拟", "taskType": "simulation", "rationale": "在本节结束时，通过一个模拟储蓄场景（如计算多久能达到购房首付），让学生应用公式解决实际问题，巩固技能。"}], "knowledgeObjectives": ["掌握单利终值与现值公式", "掌握复利终值与现值公式", "理解复利与单利的差异"]}], "learningGoals": ["理解货币时间价值的概念及其在财务决策中的基础地位"], "skillObjectives": ["能在具体情境中识别货币时间价值的应用"], "knowledgeObjectives": ["掌握货币时间价值的定义", "理解利率与时间对货币价值的影响"]}, {"order": 2, "title": "投资决策的基本评估方法", "sections": [{"order": 1, "title": "净现值（NPV）法", "learningGoals": ["理解NPV的含义，并掌握其计算与决策规则"], "knowledgePoints": ["净现值（NPV）定义", "NPV的计算公式", "NPV决策规则", "NPV法的优缺点"], "skillObjectives": ["能根据给定的现金流和折现率计算NPV"], "taskSuggestions": [{"slot": "post", "title": "NPV法优缺点简述", "taskType": "subjective", "rationale": "在学习NPV计算后，通过简答题促使学生思考该方法的内在逻辑与局限性，培养批判性思维。"}], "knowledgeObjectives": ["掌握NPV的计算公式与决策标准（NPV > 0则可行）", "理解NPV法的优缺点"]}, {"order": 2, "title": "内部收益率（IRR）法", "learningGoals": ["理解IRR的含义，并掌握其基本应用"], "knowledgePoints": ["内部收益率（IRR）定义", "IRR与NPV的关系", "IRR的决策规则"], "skillObjectives": ["能通过试算或使用财务工具计算IRR", "能解释IRR结果的含义"], "taskSuggestions": [{"slot": "in", "title": "IRR定义判断题", "taskType": "quiz", "rationale": "在讲解IRR定义的关键处，通过判断题强化学生对“使NPV=0的折现率”这一核心定义的记忆与理解。"}], "knowledgeObjectives": ["掌握IRR的定义（使NPV=0的折现率）", "理解IRR与NPV的决策关系"]}, {"order": 3, "title": "投资回收期与其他辅助指标", "learningGoals": ["了解投资回收期的概念及其作为辅助评估工具的意义"], "knowledgePoints": ["静态投资回收期", "回收期法的优点（简单、关注流动性）与缺点（忽略货币时间价值、忽略回收期后现金流）"], "skillObjectives": ["能计算简单的投资回收期"], "taskSuggestions": [], "knowledgeObjectives": ["掌握静态投资回收期的计算方法", "理解回收期法的优缺点（与NPV/IRR对比）"]}, {"order": 4, "title": "综合应用：项目评估案例分析", "learningGoals": ["能够综合运用NPV、IRR和回收期等方法分析一个简单的投资项目"], "knowledgePoints": ["多指标综合分析", "数据提取与解读"], "skillObjectives": ["能从给定数据中提取关键信息，计算并分析多个指标，形成初步投资建议"], "taskSuggestions": [{"slot": "post", "title": "虚拟项目投资决策模拟", "taskType": "simulation", "rationale": "在本章最后，提供一个完整的简化项目案例，让学生分组完成从计算到撰写分析建议的全过程，模拟真实工作场景。"}], "knowledgeObjectives": ["整合本章所学评估方法"]}], "learningGoals": ["理解并掌握几种核心的投资项目评估指标及其应用逻辑"], "skillObjectives": ["能计算简单项目的NPV和IRR", "能比较不同评估方法的优缺点"], "knowledgeObjectives": ["掌握净现值（NPV）和内部收益率（IRR）的概念", "理解投资回收期的含义与局限"]}], "courseGoals": ["理解财务管理中关于货币时间价值与投资决策的基本原理，掌握常用评估工具，培养分析实际财务问题的能力和严谨的职业态度。"], "skillObjectives": ["能运用复利公式计算终值与现值", "能使用折现现金流方法计算一个项目的NPV和IRR", "能基于NPV和IRR的结果对简单的投资项目进行初步判断与分析"], "valueObjectives": ["培养诚信、严谨的财务分析态度", "树立科学的决策观念，理解数据驱动决策的重要性", "通过投资决策案例，形成对资源有效配置的责任感与长期规划意识"], "knowledgeObjectives": ["理解货币时间价值的含义与重要性", "掌握单利与复利的计算公式", "理解净现值（NPV）与内部收益率（IRR）的概念与定义", "了解投资回收期的概念", "掌握计算NPV和IRR的基本步骤"], "globalKnowledgePoints": ["货币时间价值", "终值与现值", "单利与复利", "净现值（NPV）", "内部收益率（IRR）", "投资回收期"], "assessmentRequirements": ["过程性考核（课堂参与、小测验、实操练习）占40%", "项目分析报告（针对一个虚拟投资案例进行评估）占30%", "期末闭卷考试占30%"]}	{课程大纲,课程结构,测试,题库}
01381fbf-7607-4765-b4fb-96e068b9d25f	00000000-0000-4000-8000-00000000a202	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	text	finsim-test-syllabus-bad.md	2026-05-13/379aea2b-78c9-4161-9858-e9723e89f166.md	text/markdown	ready	财务大纲（格式很乱版本）\n\n财务这门课要讲钱 主要是讲企业的钱怎么用 怎么找钱 怎么花钱\nchapter1: introduction; about money; talk about everything;1.1 history of finance, 1.2 something - 然后还有一些小节\n然后第二章 maybe 时间价值 包含若干小节但是没明确分开\n最后一章是 investment decision，covers NPV IRR payback period sensitivity 啥的\n\n没有什么明确的目标 也没明确的结构 但是这都是常见的题目素材	本课程主要涵盖企业财务管理的核心内容，包括资金的使用、筹集和支出。课程涉及财务历史和时间价值的基础概念，并重点讲解投资决策方法，如净现值、内部收益率、回收期和敏感性分析。这些知识点对应常见的教学题目，旨在帮助学生掌握财务分析和决策的基本技能。	{企业资金管理,财务历史,时间价值,投资决策,净现值,内部收益率,回收期,敏感性分析}	\N	2026-05-13 11:12:28.891	2026-05-13 11:13:45.456	\N	\N	syllabus	{"notes": "此草稿基于提供的混乱大纲推断生成，章节结构和内容需要教师根据实际教学需求确认和细化。特别是小节划分、具体知识点和任务建议可能需要调整以适应中高职课堂水平。", "chapters": [{"order": 0, "title": "财务管理引言", "sections": [{"order": 0, "title": "财务历史概述", "learningGoals": ["理解货币和财务管理概念的历史演变。"], "knowledgePoints": ["货币的演变过程。", "财务管理的历史发展。"], "skillObjectives": ["无特定技能目标。"], "taskSuggestions": [{"slot": "pre", "title": "预习测验：货币历史", "taskType": "quiz", "rationale": "检查学生对基本概念的预习情况，激发兴趣。"}], "knowledgeObjectives": ["了解货币的起源和现代财务管理的形成。"]}, {"order": 1, "title": "企业财务管理概述", "learningGoals": ["掌握企业财务管理的核心活动和目标。"], "knowledgePoints": ["财务管理的目标（如利润最大化）。", "财务管理的基本活动（融资、投资、运营）。"], "skillObjectives": ["无特定技能目标。"], "taskSuggestions": [{"slot": "in", "title": "课堂讨论：企业如何管理资金", "taskType": "subjective", "rationale": "通过讨论促进学生思考实际应用，加深理解。"}], "knowledgeObjectives": ["理解资金筹集、使用和分配的基本原则。"]}], "learningGoals": ["了解财务管理的基本概念和历史背景。"], "skillObjectives": ["无特定技能目标。"], "knowledgeObjectives": ["知道财务管理的定义和核心功能。"]}, {"order": 1, "title": "货币时间价值", "sections": [{"order": 0, "title": "时间价值概念", "learningGoals": ["理解为什么货币具有时间价值及其影响因素。"], "knowledgePoints": ["货币时间价值的定义。", "利率和通货膨胀的作用。"], "skillObjectives": ["无特定技能目标。"], "taskSuggestions": [{"slot": "pre", "title": "预习问题：什么是时间价值", "taskType": "quiz", "rationale": "预热概念，帮助学生准备课堂学习。"}], "knowledgeObjectives": ["知道利率、通货膨胀对时间价值的影响。"]}, {"order": 1, "title": "时间价值计算", "learningGoals": ["能够应用公式进行现值、终值和年金计算。"], "knowledgePoints": ["现值计算。", "终值计算。", "年金计算。"], "skillObjectives": ["能够使用计算器或简单工具解决计算问题。"], "taskSuggestions": [{"slot": "in", "title": "计算练习：模拟贷款还款", "taskType": "simulation", "rationale": "通过模拟任务巩固计算技能，增强实际应用能力。"}], "knowledgeObjectives": ["掌握复利公式和年金公式的使用。"]}], "learningGoals": ["理解货币时间价值的概念，并能进行基本计算。"], "skillObjectives": ["能够使用公式计算复利和年金问题。"], "knowledgeObjectives": ["掌握现值、终值和年金的计算方法。"]}, {"order": 2, "title": "投资决策", "sections": [{"order": 0, "title": "投资评估方法", "learningGoals": ["掌握常用的投资评估工具及其应用。"], "knowledgePoints": ["净现值（NPV）的概念和计算。", "内部收益率（IRR）的定义。", "回收期的计算。"], "skillObjectives": ["能够应用这些方法分析简单投资案例。"], "taskSuggestions": [{"slot": "in", "title": "案例分析：评估一个小型投资项目", "taskType": "simulation", "rationale": "通过模拟实践，让学生应用投资决策方法，提升分析能力。"}], "knowledgeObjectives": ["理解NPV、IRR和回收期的原理。"]}, {"order": 1, "title": "风险分析与敏感性", "learningGoals": ["了解投资决策中的风险因素，并学习初步分析方法。"], "knowledgePoints": ["风险类型（如市场风险）。", "敏感性分析的基本步骤。"], "skillObjectives": ["能够进行简单的敏感性分析。"], "taskSuggestions": [{"slot": "post", "title": "课后作业：讨论风险对投资决策的影响", "taskType": "subjective", "rationale": "通过课后反思，深化对风险管理和决策的理解。"}], "knowledgeObjectives": ["知道风险识别和敏感性分析的概念。"]}], "learningGoals": ["学习评估投资项目的基本方法，并了解风险因素。"], "skillObjectives": ["能够计算简单案例的NPV和IRR。", "能够进行基本的风险分析。"], "knowledgeObjectives": ["了解NPV、IRR、回收期的定义和计算。", "知道敏感性分析的基本概念。"]}], "courseGoals": ["学生能够理解企业财务管理的基本概念，掌握资金筹集、使用和投资决策的初步应用。"], "skillObjectives": ["能够进行简单的货币时间价值计算。", "能够应用基本投资评估方法分析案例。"], "valueObjectives": ["培养财务规划意识和责任担当。", "理解职业道德在财务管理中的重要性。"], "knowledgeObjectives": ["了解财务管理的历史和基本定义。", "掌握货币时间价值的概念和计算方法。", "熟悉投资决策的常用工具如NPV、IRR和回收期。"], "globalKnowledgePoints": ["财务管理的基本原则和历史演变。", "货币时间价值的核心概念和计算。", "投资决策的方法论和应用。"], "assessmentRequirements": ["期末考试占50%，涵盖知识目标。", "小组项目占30%，展示投资决策分析。", "课堂参与和作业占20%，包括测验和讨论。"]}	{课程大纲,课程结构,测试,容错}
331a8af8-3df6-4d28-9994-1b2117bb33cd	00000000-0000-4000-8000-00000000a202	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	text	finsim-test-syllabus-bad.md	2026-05-13/8d1edea8-32a7-45d8-918d-8d6ac46d6233.md	text/markdown	ready	财务大纲（格式很乱版本）\n\n财务这门课要讲钱 主要是讲企业的钱怎么用 怎么找钱 怎么花钱\nchapter1: introduction; about money; talk about everything;1.1 history of finance, 1.2 something - 然后还有一些小节\n然后第二章 maybe 时间价值 包含若干小节但是没明确分开\n最后一章是 investment decision，covers NPV IRR payback period sensitivity 啥的\n\n没有什么明确的目标 也没明确的结构 但是这都是常见的题目素材	本课程素材聚焦于企业财务管理的基础知识，涵盖资金的使用、筹集和投资决策等内容。章节结构包括财务简介（含历史）、时间价值概念以及投资决策方法，后者具体涉及净现值（NPV）、内部收益率（IRR）、回收期和敏感性分析。教学目标旨在帮助学生掌握这些财务概念，以应对常见题目类型，如计算和应用分析。	{企业财务管理,时间价值,净现值,内部收益率,回收期,敏感性分析}	\N	2026-05-13 11:17:23.402	2026-05-13 11:19:04.815	\N	\N	syllabus	{"notes": "课程结构基于常见中高职财务课程内容推断，具体章节和小节需教师根据实际教学计划调整；目标设定已尽量分开，但思政融合点需教师结合学校要求和本地案例进一步细化；考核方式需明确权重和细节；taskSuggestions 仅为示例，教师可替换为更合适的任务。", "chapters": [{"order": 0, "title": "财务入门", "sections": [{"order": 0, "title": "财务历史概述", "learningGoals": ["了解财务学科的发展历程和重要里程碑。"], "knowledgePoints": ["财务起源与早期发展", "现代财务管理的形成", "技术革新对财务的影响"], "skillObjectives": ["能够简述财务历史的演变及其对现代财务管理的影响。"], "taskSuggestions": [{"slot": "pre", "title": "财务历史快速问答", "taskType": "quiz", "rationale": "预习阶段通过简单测验激发学生兴趣，检查基本知识。"}], "knowledgeObjectives": ["知道财务历史的主要阶段和关键事件。"]}, {"order": 1, "title": "财务管理基础", "learningGoals": ["理解财务管理的定义、范围和核心目标。"], "knowledgePoints": ["财务管理定义与目标", "企业资金循环", "财务管理职能"], "skillObjectives": ["能够解释财务管理在企业运营中的实际作用。"], "taskSuggestions": [{"slot": "in", "title": "讨论：企业如何管理资金", "taskType": "subjective", "rationale": "课堂讨论帮助学生联系实际，深化对基础概念的理解。"}], "knowledgeObjectives": ["掌握财务管理的基本概念，如资金筹集、使用和分配。"]}, {"order": 2, "title": "企业资金概览", "learningGoals": ["了解企业资金的基本构成和财务报表基础。"], "knowledgePoints": ["资产负债表简介", "现金流量概念", "利润表基础"], "skillObjectives": ["能够简单识别企业财务报表中的关键项目和资金流向。"], "taskSuggestions": [{"slot": "post", "title": "模拟企业资金管理游戏", "taskType": "simulation", "rationale": "课后实践通过模拟游戏巩固资金管理概念，提升应用能力。"}], "knowledgeObjectives": ["知道资产、负债、所有者权益等基本财务概念。"]}], "learningGoals": ["了解财务管理的基本内容和重要性，掌握企业资金活动的基本框架。"], "skillObjectives": ["能够识别和描述财务活动的基本类型，如筹资、投资和运营。"], "knowledgeObjectives": ["掌握财务管理的定义、目标和职能，了解企业资金的构成和流动。"]}, {"order": 1, "title": "时间价值", "sections": [{"order": 0, "title": "时间价值概念", "learningGoals": ["理解为什么货币具有时间价值及其影响因素。"], "knowledgePoints": ["时间价值定义", "利率与通货膨胀", "现值与终值概念"], "skillObjectives": ["能够解释时间价值在日常生活中的应用，如存款和借款。"], "taskSuggestions": [{"slot": "pre", "title": "时间价值基础测验", "taskType": "quiz", "rationale": "预习阶段通过测验检查学生对基本概念的理解，为后续学习铺垫。"}], "knowledgeObjectives": ["知道时间价值的定义、利率概念和基本原理。"]}, {"order": 1, "title": "复利与单利", "learningGoals": ["掌握复利和单利的计算方法及其区别。"], "knowledgePoints": ["复利公式", "单利公式", "计算实例与比较"], "skillObjectives": ["能够计算复利和单利问题，如存款收益或贷款利息。"], "taskSuggestions": [{"slot": "in", "title": "复利计算器在线练习", "taskType": "simulation", "rationale": "课堂互动通过模拟工具强化计算技能，提高学习效率。"}], "knowledgeObjectives": ["理解复利公式和单利公式的推导和应用。"]}, {"order": 2, "title": "年金计算", "learningGoals": ["学会计算普通年金和即付年金，并应用于实际财务决策。"], "knowledgePoints": ["年金现值计算", "年金终值计算", "普通年金与即付年金"], "skillObjectives": ["能够应用年金计算解决实际问题，如退休规划或分期付款。"], "taskSuggestions": [{"slot": "post", "title": "年金应用案例分析报告", "taskType": "subjective", "rationale": "课后通过案例分析深化理解，培养学生将知识应用于现实场景的能力。"}], "knowledgeObjectives": ["掌握年金现值和终值计算方法，了解不同年金类型。"]}], "learningGoals": ["理解货币时间价值的概念和重要性，掌握相关计算方法。"], "skillObjectives": ["能够进行时间价值的相关计算，并应用于实际场景如储蓄或贷款。"], "knowledgeObjectives": ["掌握复利、单利、年金等时间价值计算方法和原理。"]}, {"order": 2, "title": "投资决策", "sections": [{"order": 0, "title": "投资评估概述", "learningGoals": ["了解投资决策的重要性和常用评估方法。"], "knowledgePoints": ["投资决策概念", "评估方法分类", "风险与回报权衡"], "skillObjectives": ["能够描述投资评估的框架和关键要素。"], "taskSuggestions": [{"slot": "pre", "title": "投资评估入门测试", "taskType": "quiz", "rationale": "预习阶段通过测试建立基础概念，帮助学生快速进入主题。"}], "knowledgeObjectives": ["知道投资评估的基本步骤和流程。"]}, {"order": 1, "title": "净现值法", "learningGoals": ["掌握NPV的计算、解释和应用。"], "knowledgePoints": ["NPV定义与公式", "NPV计算步骤", "NPV决策标准"], "skillObjectives": ["能够计算NPV并解释结果，用于投资项目筛选。"], "taskSuggestions": [{"slot": "in", "title": "NPV计算模拟项目", "taskType": "simulation", "rationale": "课堂实践通过模拟项目强化NPV计算能力，提升应用技能。"}], "knowledgeObjectives": ["理解NPV的原理、公式和决策规则。"]}, {"order": 2, "title": "内部收益率法", "learningGoals": ["掌握IRR的计算、解释及其与NPV的比较。"], "knowledgePoints": ["IRR定义与公式", "IRR计算与试错法", "IRR与NPV的关系"], "skillObjectives": ["能够计算IRR并结合NPV进行投资分析。"], "taskSuggestions": [{"slot": "in", "title": "IRR计算互动练习", "taskType": "simulation", "rationale": "课堂互动通过软件或手动练习，帮助学生掌握IRR计算技巧。"}], "knowledgeObjectives": ["理解IRR的概念、计算方法和优缺点。"]}, {"order": 3, "title": "回收期法", "learningGoals": ["学会计算回收期并理解其优缺点。"], "knowledgePoints": ["回收期概念", "计算公式", "优缺点分析"], "skillObjectives": ["能够计算回收期并进行简单投资评估。"], "taskSuggestions": [{"slot": "post", "title": "回收期法案例讨论报告", "taskType": "subjective", "rationale": "课后通过案例讨论反思回收期法的适用性，培养批判性思维。"}], "knowledgeObjectives": ["知道回收期的定义、计算方法和局限性。"]}, {"order": 4, "title": "敏感性分析", "learningGoals": ["了解敏感性分析在投资决策中的应用和步骤。"], "knowledgePoints": ["敏感性分析定义", "分析方法与步骤", "应用实例"], "skillObjectives": ["能够进行简单的敏感性分析，评估投资项目风险。"], "taskSuggestions": [{"slot": "post", "title": "敏感性分析模拟练习", "taskType": "simulation", "rationale": "课后通过模拟项目实践敏感性分析，提升风险管理能力。"}], "knowledgeObjectives": ["掌握敏感性分析的基本方法和应用场景。"]}], "learningGoals": ["掌握企业投资决策的基本方法和工具，能够进行简单投资评估。"], "skillObjectives": ["能够使用这些指标计算和分析投资项目，做出初步决策建议。"], "knowledgeObjectives": ["理解NPV、IRR、回收期、敏感性分析等投资评估指标的原理和适用场景。"]}], "courseGoals": ["理解企业财务管理的基本概念和原理，掌握资金筹集、使用和投资决策的基础知识。"], "skillObjectives": ["能够进行复利、年金等时间价值计算，能够使用NPV、IRR等方法进行简单的投资分析和评估。"], "valueObjectives": ["培养财务责任意识和诚信价值观，理解财务管理在企业可持续发展中的重要性，并融入节约资源和风险管理等素养。"], "knowledgeObjectives": ["了解财务的发展历史和基本概念，理解货币时间价值的原理和计算方法，掌握NPV、IRR、回收期等投资评估指标。"], "globalKnowledgePoints": ["资金时间价值", "投资评估方法", "企业财务管理基础", "财务风险意识"], "assessmentRequirements": ["通过笔试考核理论知识掌握情况，通过案例分析或模拟项目考核实践技能，结合平时作业、课堂讨论和在线测试进行综合评价。"]}	{课程大纲,课程结构,测试,容错}
8994ad53-bb0d-44e5-997e-2b8b672ca5ce	00000000-0000-4000-8000-00000000a202	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	text	finsim-test-syllabus-bad.md	2026-05-13/da385de4-b8ef-4722-9b5e-fc915f4beef6.md	text/markdown	ready	财务大纲（格式很乱版本）\n\n财务这门课要讲钱 主要是讲企业的钱怎么用 怎么找钱 怎么花钱\nchapter1: introduction; about money; talk about everything;1.1 history of finance, 1.2 something - 然后还有一些小节\n然后第二章 maybe 时间价值 包含若干小节但是没明确分开\n最后一章是 investment decision，covers NPV IRR payback period sensitivity 啥的\n\n没有什么明确的目标 也没明确的结构 但是这都是常见的题目素材	该课程素材覆盖企业财务的基本框架，重点讲授资金的筹集、使用和管理。知识点包括财务历史、货币时间价值以及投资决策方法如NPV、IRR、回收期和敏感性分析。教学目标是为中高职学生奠定财务分析的基础，应用于实际企业场景。题型线索基于常见题目素材，适合课堂练习和评估。	{企业财务,货币时间价值,投资决策,NPV,IRR,回收期,敏感性分析}	\N	2026-05-13 11:16:11.661	2026-05-13 11:17:46.692	\N	\N	syllabus	{"notes": "此草稿基于提供的素材文本，内容可能不完整或不精确，需要教师审核并补充：具体知识点的详细描述、思政融合点的细化、考核方式的调整、以及小节划分的合理性。建议根据中高职学生水平调整语言和深度。", "chapters": [{"order": 0, "title": "财务导论", "sections": [{"order": 0, "title": "财务历史与发展", "learningGoals": ["了解财务历史的里程碑事件"], "knowledgePoints": ["货币的起源与发展", "财务管理的演变过程", "关键历史事件对财务的影响"], "skillObjectives": ["能够简要分析历史对现代财务实践的影响"], "taskSuggestions": [{"slot": "pre", "title": "财务历史预习测验", "taskType": "quiz", "rationale": "帮助学生提前了解历史背景，激发学习兴趣"}], "knowledgeObjectives": ["记住货币起源和财务管理演变的重要时期"]}, {"order": 1, "title": "财务基本概念", "learningGoals": ["掌握财务的核心术语和概念"], "knowledgePoints": ["资产、负债和所有者权益的定义", "资金类型及其特点", "财务管理的基本目标"], "skillObjectives": ["能够识别企业案例中的财务要素"], "taskSuggestions": [{"slot": "in", "title": "模拟企业资金流动分析", "taskType": "simulation", "rationale": "通过模拟实践加深对财务概念的理解"}], "knowledgeObjectives": ["解释资产、负债、权益等基本财务要素", "区分不同类型的资金（如自有资金、借贷资金）"]}], "learningGoals": ["理解财务的基本概念和重要性", "了解财务历史的演变和影响"], "skillObjectives": ["能够识别企业的基本资金流动模式"], "knowledgeObjectives": ["定义财务和财务管理的核心术语", "描述财务历史中的关键事件和阶段"]}, {"order": 1, "title": "货币时间价值", "sections": [{"order": 0, "title": "现值与终值", "learningGoals": ["计算现值和终值并理解其意义"], "knowledgePoints": ["现值公式及其应用", "终值公式及其应用", "贴现率的选择和影响"], "skillObjectives": ["能够使用公式进行现值和终值的计算"], "taskSuggestions": [{"slot": "post", "title": "现值与终值计算练习报告", "taskType": "subjective", "rationale": "巩固计算技能，加深对时间价值的理解"}], "knowledgeObjectives": ["定义现值和终值的概念", "掌握现值和终值的计算公式"]}, {"order": 1, "title": "年金计算", "learningGoals": ["掌握普通年金和永续年金的计算"], "knowledgePoints": ["普通年金的定义和公式", "永续年金的定义和公式", "年金在财务规划中的应用"], "skillObjectives": ["能够计算各种年金的现值和终值"], "taskSuggestions": [], "knowledgeObjectives": ["定义普通年金和永续年金", "解释年金计算公式的推导和应用"]}, {"order": 2, "title": "时间价值应用", "learningGoals": ["应用时间价值概念解决实际财务问题"], "knowledgePoints": ["贷款摊还的计算方法", "储蓄规划的时间价值分析", "实际案例中的应用"], "skillObjectives": ["能够进行贷款摊还或储蓄规划的基本计算"], "taskSuggestions": [{"slot": "in", "title": "模拟贷款计算与分析", "taskType": "simulation", "rationale": "通过实践应用时间价值，增强问题解决能力"}], "knowledgeObjectives": ["识别时间价值在贷款、储蓄等场景中的应用"]}], "learningGoals": ["理解货币时间价值的原理及其在财务中的应用"], "skillObjectives": ["能够应用公式计算现值、终值和年金", "能够使用时间价值解决简单的财务问题"], "knowledgeObjectives": ["掌握现值、终值和年金的计算方法", "解释贴现率的作用和影响"]}, {"order": 2, "title": "投资决策", "sections": [{"order": 0, "title": "净现值(NPV)", "learningGoals": ["计算和解释净现值在投资中的作用"], "knowledgePoints": ["NPV的公式和计算步骤", "NPV在投资评估中的应用", "NPV的优缺点"], "skillObjectives": ["能够计算项目的NPV并做出初步判断"], "taskSuggestions": [], "knowledgeObjectives": ["定义NPV及其计算公式", "解释NPV决策规则（NPV>0则可行）"]}, {"order": 1, "title": "内部收益率(IRR)", "learningGoals": ["计算和解释内部收益率"], "knowledgePoints": ["IRR的定义和计算", "IRR的决策规则", "IRR的局限性"], "skillObjectives": ["能够计算项目的IRR并进行分析"], "taskSuggestions": [{"slot": "post", "title": "IRR分析报告撰写", "taskType": "subjective", "rationale": "通过报告深入理解IRR的应用和局限"}], "knowledgeObjectives": ["定义IRR及其计算方法", "解释IRR与NPV的关系和比较"]}, {"order": 2, "title": "回收期法", "learningGoals": ["使用回收期法评估投资项目"], "knowledgePoints": ["回收期的计算公式", "回收期决策规则", "回收期法的适用场景"], "skillObjectives": ["能够计算项目的回收期"], "taskSuggestions": [], "knowledgeObjectives": ["定义回收期及其计算方法", "解释回收期法的优缺点"]}, {"order": 3, "title": "敏感性分析", "learningGoals": ["进行基本的敏感性分析以评估投资风险"], "knowledgePoints": ["敏感性分析的定义和目的", "分析步骤和常用方法", "变量影响评估"], "skillObjectives": ["能够进行简单敏感性分析并报告结果"], "taskSuggestions": [{"slot": "in", "title": "投资决策综合模拟", "taskType": "simulation", "rationale": "综合应用NPV、IRR等方法进行模拟决策，提升实战能力"}], "knowledgeObjectives": ["解释敏感性分析的概念和步骤", "识别影响投资决策的关键变量"]}], "learningGoals": ["掌握投资决策的基本方法和工具", "能够评估投资项目的可行性"], "skillObjectives": ["能够计算NPV、IRR和回收期", "能够应用这些指标进行简单投资评估"], "knowledgeObjectives": ["理解净现值（NPV）、内部收益率（IRR）和回收期法的概念", "解释这些方法在投资决策中的作用和优缺点"]}], "courseGoals": ["理解企业财务的基本概念和资金运作原理", "掌握资金筹集、使用和投资决策的初步知识", "培养财务分析和决策的基础能力"], "skillObjectives": ["能够计算现值、终值和年金等时间价值相关指标", "能够应用NPV、IRR和回收期法进行简单投资评估", "能够识别和分析基本财务流动情况"], "valueObjectives": ["培养财务诚信和职业道德意识", "增强企业社会责任感和可持续发展观念", "树立正确的金钱观和价值观，融入思政教育"], "knowledgeObjectives": ["了解财务历史与发展过程", "理解货币时间价值的基本原理", "掌握投资决策的常用方法（如NPV、IRR、回收期）", "熟悉企业资金类型和财务要素"], "globalKnowledgePoints": ["企业财务管理的基本原理", "货币时间价值的核心概念", "投资决策的常用方法和指标", "财务分析和决策的基础技能"], "assessmentRequirements": ["平时作业和课堂参与占30%", "期中测验或小项目占30%", "期末综合报告或考试占40%"]}	{课程大纲,课程结构,测试,容错}
133b5b10-4ea7-4a5d-9633-9bb2a89b0121	00000000-0000-4000-8000-00000000a202	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	text	finsim-test-syllabus-bad.md	2026-05-13/49b62927-de75-4a91-b97f-8b78e691ea4c.md	text/markdown	ready	财务大纲（格式很乱版本）\n\n财务这门课要讲钱 主要是讲企业的钱怎么用 怎么找钱 怎么花钱\nchapter1: introduction; about money; talk about everything;1.1 history of finance, 1.2 something - 然后还有一些小节\n然后第二章 maybe 时间价值 包含若干小节但是没明确分开\n最后一章是 investment decision，covers NPV IRR payback period sensitivity 啥的\n\n没有什么明确的目标 也没明确的结构 但是这都是常见的题目素材	本课程介绍企业财务管理的基础知识，包括钱的使用、筹集和花费。内容涵盖财务历史、货币的时间价值以及投资决策方法如净现值（NPV）、内部收益率（IRR）、回收期和敏感性分析。这些知识点是常见题型素材，教学目标在于使学生掌握财务概念并应用于投资决策。	{财务基础,金融历史,货币时间价值,投资决策,净现值,内部收益率,回收期,敏感性分析}	\N	2026-05-13 11:18:55.904	2026-05-13 11:20:32.861	\N	\N	syllabus	{"notes": "课程目录草稿基于提供的乱序素材推断，请教师确认以下内容：1. 章节结构和顺序是否合理；2. 学习目标和知识点是否完整，需补充更多细节；3. 考核方式需根据实际教学计划调整；4. 任务建议仅供参考，请根据学生水平和课程时间修改。", "chapters": [{"order": 0, "title": "财务导论", "sections": [{"order": 0, "title": "财务概述", "learningGoals": ["掌握财务的核心定义和重要性"], "knowledgePoints": ["资金循环", "利润计算", "财务报表基础"], "skillObjectives": ["能够解释财务在企业运营中的作用"], "taskSuggestions": [{"slot": "pre", "title": "预习测验：财务基本概念", "taskType": "quiz", "rationale": "帮助学生提前熟悉术语，为课堂学习做准备"}], "knowledgeObjectives": ["了解资金、利润、资产等基本概念"]}, {"order": 1, "title": "财务历史简介", "learningGoals": ["了解财务的发展历程和关键转折点"], "knowledgePoints": ["古代财务起源", "工业革命时期的财务", "现代财务管理发展"], "skillObjectives": ["能够讨论财务历史对现代实践的影响"], "taskSuggestions": [{"slot": "in", "title": "课堂讨论：财务历史的意义", "taskType": "subjective", "rationale": "鼓励学生思考历史背景，提升参与度"}], "knowledgeObjectives": ["知道古代到现代财务的演变"]}, {"order": 2, "title": "企业财务基础", "learningGoals": ["理解企业财务的基本组成部分和运作机制"], "knowledgePoints": ["资产负债表结构", "利润表内容", "现金流量表简介"], "skillObjectives": ["能够阅读和分析简单的企业财务报表"], "taskSuggestions": [{"slot": "post", "title": "模拟练习：分析企业财务状况", "taskType": "simulation", "rationale": "应用所学知识到实际案例，巩固理解"}], "knowledgeObjectives": ["掌握资产负债表、利润表等基本财务报表"]}], "learningGoals": ["理解财务的基本概念和企业财务的作用", "了解财务的历史背景和现代发展"], "skillObjectives": ["能够描述企业财务的基本流程", "能够关联财务概念到实际生活场景"], "knowledgeObjectives": ["掌握财务的定义、范围和关键术语", "知道财务历史的重要事件和演变"]}, {"order": 1, "title": "货币的时间价值", "sections": [{"order": 0, "title": "时间价值概念", "learningGoals": ["理解为什么时间会影响货币的价值"], "knowledgePoints": ["机会成本", "通货膨胀", "时间偏好"], "skillObjectives": ["能够解释时间价值在日常生活中的例子"], "taskSuggestions": [{"slot": "pre", "title": "预习测验：时间价值基础", "taskType": "quiz", "rationale": "检查学生对前置数学知识的掌握，确保学习连贯性"}], "knowledgeObjectives": ["知道机会成本和通货膨胀的基本概念"]}, {"order": 1, "title": "复利与终值", "learningGoals": ["掌握复利计算和终值公式的应用"], "knowledgePoints": ["复利公式", "终值计算", "利率和期数影响"], "skillObjectives": ["能够使用公式计算给定条件下的终值"], "taskSuggestions": [{"slot": "in", "title": "课堂练习：计算复利终值", "taskType": "simulation", "rationale": "通过动手计算加深对公式的理解和应用能力"}], "knowledgeObjectives": ["了解复利的概念、计算公式和影响因素"]}, {"order": 2, "title": "现值计算", "learningGoals": ["掌握现值的概念和计算方法"], "knowledgePoints": ["现值公式", "贴现率", "现值应用"], "skillObjectives": ["能够计算现值并用于简单决策如评估未来收入"], "taskSuggestions": [{"slot": "post", "title": "课后作业：现值应用问题", "taskType": "subjective", "rationale": "让学生通过实际问题巩固现值计算，培养解决问题的能力"}], "knowledgeObjectives": ["理解现值公式和贴现率的作用"]}], "learningGoals": ["掌握货币时间价值的概念和计算方法", "理解时间价值在财务决策中的应用"], "skillObjectives": ["能够计算复利终值和现值", "能够应用时间价值解决实际问题如储蓄或贷款"], "knowledgeObjectives": ["理解机会成本、通货膨胀对货币价值的影响", "掌握复利、终值、现值的公式和原理"]}, {"order": 2, "title": "投资决策", "sections": [{"order": 0, "title": "投资评估方法概述", "learningGoals": ["了解常用的投资评估方法及其优缺点"], "knowledgePoints": ["净现值 (NPV)", "内部收益率 (IRR)", "回收期"], "skillObjectives": ["能够比较不同评估方法的适用场景"], "taskSuggestions": [{"slot": "pre", "title": "预习测验：投资评估基础", "taskType": "quiz", "rationale": "引入关键术语，帮助学生为深入学习做准备"}], "knowledgeObjectives": ["知道NPV、IRR、回收期的定义和基本原理"]}, {"order": 1, "title": "NPV和IRR的计算与应用", "learningGoals": ["掌握NPV和IRR的计算方法和决策规则"], "knowledgePoints": ["NPV计算步骤", "IRR计算步骤", "决策规则（如NPV>0接受）"], "skillObjectives": ["能够计算给定项目的NPV和IRR", "能够根据结果提出投资建议"], "taskSuggestions": [{"slot": "in", "title": "模拟项目：评估投资项目", "taskType": "simulation", "rationale": "通过案例模拟应用NPV和IRR，提升实际操作能力"}], "knowledgeObjectives": ["理解NPV和IRR的公式、意义及局限性"]}, {"order": 2, "title": "回收期和敏感性分析", "learningGoals": ["掌握回收期计算和敏感性分析的基本方法"], "knowledgePoints": ["回收期公式", "敏感性分析变量", "风险评估基础"], "skillObjectives": ["能够计算回收期", "能够进行简单的敏感性分析以评估风险"], "taskSuggestions": [{"slot": "post", "title": "课后报告：投资决策分析", "taskType": "subjective", "rationale": "综合运用所学知识，撰写分析报告，培养综合技能"}], "knowledgeObjectives": ["了解回收期的概念、计算和局限性", "知道敏感性分析的目的和步骤"]}], "learningGoals": ["掌握投资决策的基本方法和工具", "能够评估投资项目并做出合理建议"], "skillObjectives": ["能够计算和解释NPV、IRR和回收期", "能够进行简单的投资决策分析和报告"], "knowledgeObjectives": ["了解NPV、IRR、回收期等投资评估指标", "知道敏感性分析在风险管理中的作用"]}], "courseGoals": ["理解企业财务的基本概念和运作", "掌握货币时间价值和投资决策的基础知识与技能", "培养财务素养和伦理意识"], "skillObjectives": ["能够计算终值、现值、NPV和IRR", "能够应用财务知识进行简单的企业分析和投资评估", "能够阅读和解释基本财务报表"], "valueObjectives": ["培养财务责任感和诚信意识", "理解财务决策对社会和环境的影响", "增强团队合作和沟通能力"], "knowledgeObjectives": ["了解财务的定义、历史和发展", "掌握货币时间价值的核心概念和计算方法", "熟悉投资决策工具如NPV、IRR、回收期等"], "globalKnowledgePoints": ["资金时间价值", "投资评估方法（NPV、IRR、回收期）", "财务报表基础", "企业财务流程"], "assessmentRequirements": ["平时作业和测验占30%", "期末考试占50%", "项目报告或课堂参与占20%", "评估方式包括客观题、主观题和模拟练习"]}	{课程大纲,课程结构,测试,容错}
778e76c6-0695-44f5-a11e-eb5cd38c695a	8f7f653c-9177-44f6-b764-80f7f779b2ef	\N	\N	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	spreadsheet	个人理财-课程标准-编码表.xls	2026-05-05/343110f4-77ad-443e-83b7-2a48b48de93a.xls	application/vnd.ms-excel	ready	【表格：个人理财-课程标准-编码表.xls / 课程标准】\n学习任务（必填）,类型（必填）,技能/知识学习点（必填）,学习水平（必填）\n[1]投资者甄别,技能,[1-S1]了解个人理财基本概念与原理,[1-S1-1]能联系个人理财的基本概念与原理模拟理财规划的工作流程\n,,[1-S2]认识理财产品,[1-S2-1]能辨认不同的理财产品\n,,[1-S3]确定投资者风险偏好类型,[1-S3-1]能确定投资者的风险偏好类型\n,,,[1-S3-2]能为投资者匹配对应风险等级的理财产品\n,知识,[1-K1]个人理财基本概念与原理,[1-K1-1]说出个人投资理财的概念、动因、原则\n,,,[1-K1-2]简述理财规划的基本步骤\n,,[1-K2]投资理财的各种渠道,[1-K2-1]归纳比较个人投资理财的产品\n,,[1-K3]不同风险偏好投资者的特点,[1-K3-1]说出风险承受能力与风险等级匹配关系\n,,,[1-K3-2]简述不同类型投资人的投资特点及相应理财建议\n,,[1-K4]风险承受能力评级,[1-K4-1]归纳比较相应风险等级的理财产品的特点\n[2]目标值确定,技能,[2-S1]认识生命周期的四个阶段,[2-S1-1]能对照个人生命周期的四个阶段正确识别投资者的需求\n,,[2-S2]确定各阶段的理财目标,[2-S2-1]能区分生命周期不同阶段的理财目标\n,,[2-S3]确定对应的资产配置,[2-S3-1]能对不同阶段的投资人进行对应的资产配置\n,,[2-S4]计算货币的时间价值,[2-S4-1]会计算货币时间价值\n,,,[2-S4-2]能以正确的货币时间价值理念为客户制订理财规划\n,,[2-S5]计算投资的风险价值,[2-S5-1]会计算投资风险价值\n,,,[2-S5-2]能以正确的投资风险价值理念为客户制订理财规划\n,知识,[2-K1]个人生命周期的概念,[2-K1-1]说出个人生命周期的四个阶段及特点\n,,[2-K2]生命周期不同阶段的理财目标,[2-K2-1]归纳比较生命周期不同阶段的理财目标\n,,[2-K3]资产配置的方法,[2-K3-1]简述个人资产配置的步骤和内容\n,,[2-K4]货币时间价值的概念,[2-K4-1]说出货币时间价值的概念\n,,[2-K5]货币时间价值的计算方法,[2-K5-1]记住货币时间价值的计算方法\n,,[2-K6]投资风险的种类,[2-K6-1]列举投资风险的种类\n,,[2-K7]投资风险价值的计算方法,[2-K7-1]说出投资风险价值计算的步骤\n,,,[2-K7-2]记住投资风险价值的计算方法\n[3]指标化分析,技能,[3-S1]编制收入支出表,[3-S1-1]能正确编制收入支出表\n,,,[3-S1-2]能进行简单的财务状况指标分析\n,,,[3-S1-3]能根据财务状况指标给出家庭财务改进建议 \n,,[3-S2]编制资产负债表,[3-S2-1]能正确编制资产负债表\n,,,[3-S2-2]能进行简单的财务比率指标分析\n,,,[3-S2-3]能根据财务比率指标给出家庭财务改进建议\n,知识,[3-K1]收入支出表的概念,[3-K1-1]说出个人（家庭）收入支出表的概念\n,,[3-K2]收入支出表的编制,[3-K2-1]概述收入支出表的编制依据\n,,[3-K3]资产负债表的概念,[3-K3-1]说出个人（家庭）资产负债表的概念\n,,[3-K4]资产负债表的编制,[3-K4-1]概述资产负债表的编制依据\n,,[3-K5]财务指标的计算及分析方法,[3-K5-1]记住财务指标的计算及分析方法\n[4]单身期理财,技能,[4-S1]制定单身期保守型投资者的理财规划,[4-S1-1]能运用信用卡的理财技巧、风险控制方法为客户制订理财规划\n,,,[4-S1-2]能通过对比不同储蓄存款的区别从而进行阶梯储蓄\n,,,[4-S1-3]能运用储蓄存款的理财技巧为客户制订理财规划\n,,[4-S2]制定单身期稳健型投资者的理财规划,[4-S2-1]能运用基金的理财技巧、风险控制方法为客户制订理财规划\n,,,[4-S2-2]能够理解单笔投资和定投的区别\n,,,[4-S2-3]能计算基金每月的申购费用、净申购金额以及可申购份数\n,,[4-S3]制定单身期激进型投资者的理财规划,[4-S3-1]能运用基本面和技术面分析股票行情\n,,,[4-S3-2]能够区分系统性风险和非系统性风险带给投资者的损失\n,,,[4-S3-3]能运用股票的理财技巧、风险控制方法为客户制订理财规划\n,,[4-S4]收集单身期投资者理财需求并进行财务诊断,[4-S4-1]能收集和整理单身期投资者的基本情况和财务信息\n,,,[4-S4-2]能结合资产负债比率、个人（家庭）支出比率等指标进行财务分析\n,,,[4-S4-3]能根据相关比率诊断个人（家庭）财务风险\n,,,[4-S4-4]能对财务风险的防范与隔离防范有初步的认识\n,知识,[4-K1]信用卡的理财功能,[4-K1-1]说出信用卡的种类、收费项目、申请条件和办理流程\n,,,[4-K1-2]简述信用卡的理财技巧\n,,,[4-K1-3]简述信用卡理财的风险控制\n,,[4-K2]储蓄存款的理财功能,[4-K2-1]说出储蓄存款的概念和种类\n,,,[4-K2-2]简述储蓄存款的理财技巧\n,,[4-K3]基金的理财功能,[4-K3-1]说出基金（含互联网各类基金）的概念、购买渠道\n,,,[4-K3-2]简述基金的理财技巧\n,,,[4-K3-3]简述基金理财的风险控制\n,,[4-K4]股票的理财功能,[4-K4-1]说出股票的概念、股票投资的分析方法、股票交易的流程\n,,,[4-K4-2]简述股票的理财技巧\n,,,[4-K4-3]简述股票投资的风险及风险控制\n,,[4-K5]客户信息的收集与分析,[4-K5-1]简述收集客户信息的基本原则和关键步骤\n,,,[4-K5-2]了解企业对投资者财务分析的内容与流程\n[5]成长期理财,技能,[5-S1]制定成长期保守型投资者的理财规划,[5-S1-1]能运用个人住房贷款的理财技巧为客户制订理财规划\n,,,[5-S1-2]能通过计算等额本息还款法和等额本金还款法比较两种还款方式\n,,[5-S2]制定成长期稳健型投资者的理财规划,[5-S2-1]能运用人身保险的投保技巧为客户制订理财规划\n,,,[5-S2-2]能运用人身保险规划的主要步骤为投资者购买合适的保险产品\n,,[5-S3]制定成长期激进型投资者的理财规划,[5-S3-1]能运用汽车消费贷款的理财技巧为客户制订理财规划\n,,,[5-S3-2]能运用汽车保险的投保技巧为客户选择合适的汽车保险\n,,[5-S4]根据成长期投资者特点设定理财目标,[5-S4-1]能根据成长期投资者的基本情况和财务信息，设定合理的理财目标\n,,,[5-S4-2]能识别消费型理财目标和养老型理财目标的异同\n,,,[5-S4-3]能根据投资者风险属性的不同调整相应理财目标\n,知识,[5-K1]个人住房贷款的理财功能,[5-K1-1]说出个人住房贷款的概念和种类、申请条件、申请材料、办理流程\n,,,[5-K1-2]归纳个人住房贷款的还款方式、购房决策的注意事项\n,,[5-K2]人身保险的理财功能,[5-K2-1]说出人身保险的概念与分类、原理和投保原则\n,,,[5-K2-2]简述人身保险规划的主要步骤\n,,,[5-K2-3]简述购买人身保险的技巧\n,,[5-K3]汽车消费贷款的理财功能,[5-K3-1]说出汽车消费贷款的概念与类型、申请条件、贷款期限和还款方式\n,,,[5-K3-2]简述申请汽车贷款的技巧\n,,[5-K4]汽车保险的理财功能,[5-K4-1]说出汽车保险的概念与种类、投保方式\n,,[5-K5]理财目标的设定与调整,[5-K5-1]说出消费型理财目标和养老型理财目标的异同\n,,,[5-K5-2]了解企业对投资者理财目标设定与调整的方法\n[6]成熟期理财,技能,[6-S1]制定成熟期保守型投资者的理财规划,[6-S1-1]能运用二次置业的理财技巧、风险控制方法为客户制订理财规划\n,,,[6-S1-2]能对比大额可转让存单和定期存款的区别\n,,,[6-S1-3]能运用大额可转让存单的理财技巧为客户制订理财规划\n,,,[6-S1-4]能运用年金保险的理财技巧、风险控制方法为客户制订理财规划\n,,[6-S2]制定成熟期稳健型投资者的理财规划,[6-S2-1]能运用个人实盘外汇的买卖技巧、风险控制方法为客户制订理财规划\n,,,[6-S2-2]能运用分红型保险的理财技巧、风险控制方法为客户制订理财规划\n,,[6-S3]制定成熟期激进型投资者的理财规划,[6-S3-1]能运用黄金投资的理财技巧为客户制订理财规划\n,,,[6-S3-2]能运用投资连结保险的理财技巧、风险控制方法为客户制订理财规划\n,,[6-S4]根据成熟期投资者理财目标制定理财规划方案,[6-S4-1]能对成熟期投资者的理财目标进行可行性、现金流和敏感性分析\n,,,[6-S4-2]能针对成熟期投资者理财目标设计初步资产配置框架\n,,,[6-S4-3]能根据成熟期投资者理财目标制定理财规划方案\n,知识,[6-K1]二次置业的理财功能,[6-K1-1]说出二次置业的理财概念、贷款流程\n,,,[6-K1-2]简述二次置业理财技巧、风险控制\n,,[6-K2]大额可转让存单的理财功能,[6-K2-1]说出大额可转让存单的基本概念\n,,,[6-K2-2]归纳大额可转让存单和定期存款的区别\n,,,[6-K2-3]简述大额可转让存单的理财技巧\n,,[6-K3]年金保险的理财功能,[6-K3-1]说出年金保险的基本概念\n,,,[6-K3-2]简述年金保险的理财技巧、风险控制\n,,[6-K4]个人实盘外汇买卖的理财功能,[6-K4-1]说出个人实盘外汇买卖的概念、交易方式\n,,,[6-K4-2]简述个人实盘外汇的买卖技巧、风险控制\n,,[6-K5]分红型保险的理财功能,[6-K5-1]说出分红型保险的概念\n,,,[6-K5-2]简述分红型保险的理财技巧、风险控制\n,,[6-K6]黄金投资的理财功能,[6-K6-1]说出黄金投资的概念和种类\n,,,[6-K6-2]简述黄金投资的理财技巧\n,,[6-K7]投资连结保险的理财功能,[6-K7-1]说出投资连结保险的概念\n,,,[6-K7-2]简述投资连结保险的理财技巧、风险控制\n,,[6-K8]理财规划方案的制定,[6-K8-1]了解理财规划报告书的内容\n[7]退休期理财,技能,[7-S1]制定退休期保守型投资者的理财规划,[7-S1-1]能根据退休期理财的风险防范原则为客户选择合适的投资工具\n,,,[7-S1-2]能运用国债逆回购的理财技巧为客户制订理财规划\n,,,[7-S1-3]能运用货币型基金的理财技巧为客户制订理财规划\n,,[7-S2]制定退休期稳健型投资者的理财规划,[7-S2-1]能根据银行理财产品的特点为客户选择合适的理财产品\n,,,[7-S2-2]能运用利率债券的理财技巧为客户制订理财规划\n,,[7-S3]制定退休期积极型投资者的理财规划,[7-S3-1]能运用指数型基金的投资技巧为客户制订理财规划\n,,,[7-S3-2]能运用以房养老的投资技巧为客户制订理财规划\n,,[7-S4]定期评估退休期投资者理财规划方案,[7-S4-1]能完整阐述风险告知、理解定期审视的意义\n,,,[7-S4-2]能对退休期投资者理财规划方案进行定期评估\n,,,[7-S4-3]能根据定期评估结果对退休期理财规划方案进行动态调整\n,知识,[7-K1]退休期面临的风险及投资工具,[7-K1-1]说出退休养老面对的风险\n,,,[7-K1-2]说出退休期理财的风险防范原则以及投资工具\n,,[7-K2]国债逆回购的理财功能,[7-K2-1]简述国债逆回购的理财技巧\n,,[7-K3]货币型基金的理财功能,[7-K3-1]简述货币型基金的理财技巧\n,,[7-K4]银行理财产品的理财功能,[7-K4-1]说出银行理财产品的特点\n,,[7-K5]利率债券的理财功能,[7-K5-1]简述利率债券的理财技巧\n,,[7-K6]指数型基金的理财功能,[7-K6-1]简述指数型基金的投资技巧\n,,[7-K7]以房养老的理财功能,[7-K7-1]说出以房养老的概念\n,,,[7-K7-2]简述以房养老的投资技巧\n,,[7-K8]理财规划方案的定期评估,[7-K8-1]记住理财规划方案实施中评估与动态调整的方法	本素材为个人理财课程标准，系统规划了从投资者甄别、目标确定、财务分析到各生命周期阶段（单身、成长、成熟、退休）理财规划的完整教学体系。内容涵盖理财基本概念、风险偏好评估、各类金融产品（如储蓄、基金、股票、保险、贷款、外汇、黄金等）的功能与技巧，以及财务报表编制与分析。教学目标旨在培养学生根据客户不同生命周期和风险偏好，制定个性化理财规划方案的核心技能。	{个人理财基本原理,风险偏好评估,生命周期理财,资产配置,货币时间价值,投资风险价值,财务报表分析,信用卡理财,储蓄存款,基金投资,股票投资,个人住房贷款}	\N	2026-05-05 09:02:54.392	2026-05-14 00:21:27.08	\N	\N	syllabus	{"notes": "本草稿基于提供的编码表内容进行结构化整理。请教师重点审核：1. 各章、节、知识点的划分是否符合中高职学生的认知规律和课时安排。2. 学习目标、知识目标、技能目标的描述是否清晰、可衡量、可达成。3. 素养/价值/思政目标的融合点是否自然、贴切。4. 考核要求是否全面且具有可操作性。5. 建议的任务（taskSuggestions）是否适合课堂实施，slot（pre/in/post）定位是否准确。请根据实际教学情况对内容进行增删、调整和细化。", "chapters": [{"order": 1, "title": "个人理财基础与投资者甄别", "sections": [{"order": 1, "title": "个人理财概述", "learningGoals": ["认识个人理财的基本概念与流程。"], "knowledgePoints": ["个人理财概念", "理财动因", "理财原则", "理财规划步骤"], "skillObjectives": ["能联系基本概念与原理模拟理财规划的工作流程。"], "taskSuggestions": [{"slot": "pre", "title": "理财观念小测试", "taskType": "quiz", "rationale": "课前了解学生对理财的初步认知，激发学习兴趣。"}], "knowledgeObjectives": ["说出个人投资理财的概念、动因、原则。", "简述理财规划的基本步骤。"]}, {"order": 2, "title": "理财产品与投资者风险匹配", "learningGoals": ["认识主要理财产品并掌握风险匹配方法。"], "knowledgePoints": ["储蓄、基金、股票、债券、保险等常见产品特点", "风险偏好类型（保守、稳健、激进）", "风险等级与产品匹配"], "skillObjectives": ["能辨认不同的理财产品。", "能确定投资者的风险偏好类型。", "能为投资者匹配对应风险等级的理财产品。"], "taskSuggestions": [{"slot": "in", "title": "风险偏好测试与产品匹配", "taskType": "simulation", "rationale": "课堂模拟测试风险偏好，并根据结果选择匹配产品，强化技能应用。"}], "knowledgeObjectives": ["归纳比较个人投资理财的产品。", "说出风险承受能力与风险等级匹配关系。", "简述不同类型投资人的投资特点及相应理财建议。"]}], "learningGoals": ["理解个人理财的基本概念和意义。", "掌握识别投资者风险偏好并匹配理财产品的基本方法。"], "skillObjectives": ["能模拟理财规划的基本工作流程。", "能辨认不同的理财产品。", "能确定投资者的风险偏好类型。", "能为投资者匹配对应风险等级的理财产品。"], "knowledgeObjectives": ["说出个人理财的概念、动因和原则。", "简述理财规划的基本步骤。", "归纳比较常见的个人理财产品。", "说出风险承受能力与风险等级的匹配关系。", "简述不同类型投资者的特点及理财建议。"]}, {"order": 2, "title": "理财目标与价值分析", "sections": [{"order": 1, "title": "生命周期与理财目标", "learningGoals": ["掌握生命周期各阶段的特点与理财目标。"], "knowledgePoints": ["生命周期四阶段（单身期、成长期、成熟期、退休期）", "各阶段理财目标", "资产配置概念与步骤"], "skillObjectives": ["能对照个人生命周期的四个阶段正确识别投资者的需求。", "能区分生命周期不同阶段的理财目标。", "能对不同阶段的投资人进行对应的资产配置。"], "taskSuggestions": [], "knowledgeObjectives": ["说出个人生命周期的四个阶段及特点。", "归纳比较生命周期不同阶段的理财目标。", "简述个人资产配置的步骤和内容。"]}, {"order": 2, "title": "货币时间价值与风险价值", "learningGoals": ["掌握货币时间价值与投资风险价值的计算与应用。"], "knowledgePoints": ["货币时间价值（现值、终值）", "单利与复利计算", "投资风险种类", "风险价值计算"], "skillObjectives": ["会计算货币时间价值。", "能以正确的货币时间价值理念为客户制订理财规划。", "会计算投资风险价值。", "能以正确的投资风险价值理念为客户制订理财规划。"], "taskSuggestions": [{"slot": "in", "title": "时间价值计算练习", "taskType": "quiz", "rationale": "课堂即时练习巩固计算技能，教师可及时反馈。"}], "knowledgeObjectives": ["说出货币时间价值的概念。", "记住货币时间价值的计算方法。", "列举投资风险的种类。", "说出投资风险价值计算的步骤和方法。"]}], "learningGoals": ["理解生命周期理论在理财中的应用。", "掌握货币时间价值与投资风险价值的基本计算。"], "skillObjectives": ["能对照生命周期阶段识别投资者需求并区分理财目标。", "能对不同阶段的投资人进行对应的资产配置。", "会计算货币时间价值和投资风险价值。", "能运用正确的价值理念为客户制订理财规划。"], "knowledgeObjectives": ["说出个人生命周期的四个阶段及特点。", "归纳比较生命周期不同阶段的理财目标。", "简述个人资产配置的步骤和内容。", "说出货币时间价值的概念和计算方法。", "列举投资风险的种类，说出投资风险价值的计算步骤。"]}, {"order": 3, "title": "个人财务分析", "sections": [{"order": 1, "title": "财务报表编制", "learningGoals": ["学会编制个人（家庭）收入支出表和资产负债表。"], "knowledgePoints": ["收入支出表结构", "资产负债表结构", "编制依据与数据来源"], "skillObjectives": ["能正确编制收入支出表。", "能正确编制资产负债表。"], "taskSuggestions": [{"slot": "post", "title": "我的家庭财务报表", "taskType": "subjective", "rationale": "课后实践，让学生尝试整理自己家庭的收支和资产情况，学以致用。"}], "knowledgeObjectives": ["说出个人（家庭）收入支出表和资产负债表的概念。", "概述收入支出表和资产负债表的编制依据。"]}, {"order": 2, "title": "财务指标分析", "learningGoals": ["学会计算和分析主要的财务指标。"], "knowledgePoints": ["结余比率", "投资与净资产比率", "清偿比率", "负债比率", "流动性比率"], "skillObjectives": ["能进行简单的财务状况指标分析。", "能进行简单的财务比率指标分析。", "能根据财务指标给出家庭财务改进建议。"], "taskSuggestions": [], "knowledgeObjectives": ["记住财务指标的计算及分析方法。"]}], "learningGoals": ["掌握个人（家庭）财务报表的编制与分析方法。"], "skillObjectives": ["能正确编制收入支出表和资产负债表。", "能进行简单的财务状况指标和财务比率指标分析。", "能根据财务指标给出家庭财务改进建议。"], "knowledgeObjectives": ["说出个人（家庭）收入支出表和资产负债表的概念。", "概述收入支出表和资产负债表的编制依据。", "记住财务指标的计算及分析方法。"]}, {"order": 4, "title": "单身期理财规划", "sections": [{"order": 1, "title": "单身期保守型与稳健型理财", "learningGoals": ["掌握为单身期保守型和稳健型投资者制定理财规划的方法。"], "knowledgePoints": ["信用卡理财", "储蓄存款理财", "基金定投与单笔投资", "基金费用计算"], "skillObjectives": ["能运用信用卡的理财技巧、风险控制方法为客户制订理财规划。", "能通过对比不同储蓄存款的区别从而进行阶梯储蓄。", "能运用储蓄存款的理财技巧为客户制订理财规划。", "能运用基金的理财技巧、风险控制方法为客户制订理财规划。", "能够理解单笔投资和定投的区别。", "能计算基金每月的申购费用、净申购金额以及可申购份数。"], "taskSuggestions": [{"slot": "in", "title": "模拟基金定投计划", "taskType": "simulation", "rationale": "模拟制定一个为期一年的基金定投计划，计算相关费用，强化实操能力。"}], "knowledgeObjectives": ["说出信用卡的种类、收费项目、申请条件和办理流程。", "简述信用卡的理财技巧和风险控制。", "说出储蓄存款的概念和种类。", "简述储蓄存款的理财技巧。", "说出基金的概念、购买渠道。", "简述基金的理财技巧和风险控制。"]}, {"order": 2, "title": "单身期激进型理财与财务诊断", "learningGoals": ["掌握为单身期激进型投资者制定股票投资规划的方法。", "学会收集客户信息并进行初步财务诊断。"], "knowledgePoints": ["股票基本面与技术面分析", "系统性风险与非系统性风险", "客户信息收集原则与步骤", "财务比率诊断"], "skillObjectives": ["能运用基本面和技术面分析股票行情。", "能够区分系统性风险和非系统性风险带给投资者的损失。", "能运用股票的理财技巧、风险控制方法为客户制订理财规划。", "能收集和整理单身期投资者的基本情况和财务信息。", "能结合资产负债比率、个人支出比率等指标进行财务分析。", "能根据相关比率诊断个人财务风险。", "能对财务风险的防范与隔离有初步的认识。"], "taskSuggestions": [], "knowledgeObjectives": ["说出股票的概念、投资分析方法、交易流程。", "简述股票的理财技巧和风险控制。", "简述收集客户信息的基本原则和关键步骤。", "了解企业对投资者财务分析的内容与流程。"]}], "learningGoals": ["掌握单身期（初入职场）的理财特点和常用工具。", "能够为单身期不同风险偏好的客户制定基础理财方案。"], "skillObjectives": ["能运用信用卡、储蓄、基金、股票等工具为客户制订理财规划。", "能收集和整理单身期投资者的基本情况和财务信息。", "能结合资产负债比率、个人支出比率等指标进行财务分析并诊断财务风险。"], "knowledgeObjectives": ["说出信用卡、储蓄存款、基金、股票的概念、特点和理财技巧。", "简述信用卡、基金、股票理财的风险控制。", "简述收集客户信息的基本原则和关键步骤。"]}, {"order": 5, "title": "成长期理财规划", "sections": [{"order": 1, "title": "成长期保守型与稳健型理财", "learningGoals": ["掌握为成长期保守型和稳健型投资者制定涉及住房和保险的理财规划。"], "knowledgePoints": ["住房贷款种类与流程", "等额本息与等额本金还款计算", "人身保险分类与投保原则", "保险规划步骤"], "skillObjectives": ["能运用个人住房贷款的理财技巧为客户制订理财规划。", "能通过计算等额本息还款法和等额本金还款法比较两种还款方式。", "能运用人身保险的投保技巧为客户制订理财规划。", "能运用人身保险规划的主要步骤为投资者购买合适的保险产品。"], "taskSuggestions": [{"slot": "in", "title": "还款方式计算对比", "taskType": "quiz", "rationale": "课堂练习计算两种还款方式的月供和总利息，直观感受差异。"}], "knowledgeObjectives": ["说出个人住房贷款的概念和种类、申请条件、申请材料、办理流程。", "归纳个人住房贷款的还款方式、购房决策的注意事项。", "说出人身保险的概念与分类、原理和投保原则。", "简述人身保险规划的主要步骤和购买技巧。"]}, {"order": 2, "title": "成长期激进型理财与目标设定", "learningGoals": ["掌握为成长期激进型投资者制定涉及汽车消费的理财规划。", "学会根据成长期特点设定和调整理财目标。"], "knowledgePoints": ["汽车消费贷款", "汽车保险", "消费型与养老型理财目标", "理财目标调整"], "skillObjectives": ["能运用汽车消费贷款的理财技巧为客户制订理财规划。", "能运用汽车保险的投保技巧为客户选择合适的汽车保险。", "能根据成长期投资者的基本情况和财务信息，设定合理的理财目标。", "能识别消费型理财目标和养老型理财目标的异同。", "能根据投资者风险属性的不同调整相应理财目标。"], "taskSuggestions": [], "knowledgeObjectives": ["说出汽车消费贷款的概念与类型、申请条件、贷款期限和还款方式。", "简述申请汽车贷款的技巧。", "说出汽车保险的概念与种类、投保方式。", "说出消费型理财目标和养老型理财目标的异同。", "了解企业对投资者理财目标设定与调整的方法。"]}], "learningGoals": ["掌握成长期（成家立业）的理财特点和常用工具。", "能够为成长期不同风险偏好的客户制定涉及住房、保险、汽车等的理财方案。"], "skillObjectives": ["能运用个人住房贷款的理财技巧为客户制订理财规划。", "能通过计算等额本息和等额本金还款法比较两种还款方式。", "能运用人身保险的投保技巧为客户制订理财规划。", "能运用汽车消费贷款和汽车保险的技巧为客户制订理财规划。", "能根据成长期投资者的基本情况和财务信息，设定合理的理财目标。", "能识别消费型理财目标和养老型理财目标的异同。"], "knowledgeObjectives": ["说出个人住房贷款、人身保险、汽车消费贷款、汽车保险的概念、种类和办理流程。", "归纳个人住房贷款的还款方式和注意事项。", "简述人身保险规划的主要步骤和购买技巧。", "说出消费型理财目标和养老型理财目标的异同。"]}, {"order": 6, "title": "成熟期理财规划", "sections": [{"order": 1, "title": "成熟期保守型与稳健型理财", "learningGoals": ["掌握为成熟期保守型和稳健型投资者制定理财规划。"], "knowledgePoints": ["二次置业贷款", "大额可转让存单", "年金保险", "个人实盘外汇", "分红型保险"], "skillObjectives": ["能运用二次置业的理财技巧、风险控制方法为客户制订理财规划。", "能对比大额可转让存单和定期存款的区别。", "能运用大额可转让存单的理财技巧为客户制订理财规划。", "能运用年金保险的理财技巧、风险控制方法为客户制订理财规划。", "能运用个人实盘外汇的买卖技巧、风险控制方法为客户制订理财规划。", "能运用分红型保险的理财技巧、风险控制方法为客户制订理财规划。"], "taskSuggestions": [], "knowledgeObjectives": ["说出二次置业的理财概念、贷款流程。", "简述二次置业理财技巧、风险控制。", "说出大额可转让存单的基本概念。", "归纳大额可转让存单和定期存款的区别。", "简述大额可转让存单的理财技巧。", "说出年金保险的基本概念。", "简述年金保险的理财技巧、风险控制。", "说出个人实盘外汇买卖的概念、交易方式。", "简述个人实盘外汇的买卖技巧、风险控制。", "说出分红型保险的概念。", "简述分红型保险的理财技巧、风险控制。"]}, {"order": 2, "title": "成熟期激进型理财与方案制定", "learningGoals": ["掌握为成熟期激进型投资者制定理财规划。", "学会制定完整的理财规划方案。"], "knowledgePoints": ["黄金投资", "投资连结保险", "理财规划方案制定", "可行性、现金流、敏感性分析"], "skillObjectives": ["能运用黄金投资的理财技巧为客户制订理财规划。", "能运用投资连结保险的理财技巧、风险控制方法为客户制订理财规划。", "能对成熟期投资者的理财目标进行可行性、现金流和敏感性分析。", "能针对成熟期投资者理财目标设计初步资产配置框架。", "能根据成熟期投资者理财目标制定理财规划方案。"], "taskSuggestions": [{"slot": "post", "title": "撰写一份成熟期客户理财规划建议书", "taskType": "subjective", "rationale": "综合运用本章知识，模拟为一位成熟期客户撰写书面建议，提升综合应用和表达能力。"}], "knowledgeObjectives": ["说出黄金投资的概念和种类。", "简述黄金投资的理财技巧。", "说出投资连结保险的概念。", "简述投资连结保险的理财技巧、风险控制。", "了解理财规划报告书的内容。"]}], "learningGoals": ["掌握成熟期（事业巅峰）的理财特点和常用工具。", "能够为成熟期不同风险偏好的客户制定涉及二次置业、外汇、黄金、保险等的综合理财方案。"], "skillObjectives": ["能运用二次置业、大额可转让存单、年金保险、个人实盘外汇、分红型保险、黄金投资、投资连结保险等工具为客户制订理财规划。", "能对成熟期投资者的理财目标进行可行性、现金流和敏感性分析。", "能针对成熟期投资者理财目标设计初步资产配置框架。", "能根据成熟期投资者理财目标制定理财规划方案。"], "knowledgeObjectives": ["说出二次置业、大额可转让存单、年金保险、个人实盘外汇、分红型保险、黄金投资、投资连结保险的概念和特点。", "归纳大额可转让存单和定期存款的区别。", "简述各类工具的理财技巧和风险控制。", "了解理财规划报告书的内容。"]}, {"order": 7, "title": "退休期理财规划", "sections": [{"order": 1, "title": "退休期保守型与稳健型理财", "learningGoals": ["掌握为退休期保守型和稳健型投资者制定理财规划。"], "knowledgePoints": ["退休期风险与防范原则", "国债逆回购", "货币型基金", "银行理财产品", "利率债券"], "skillObjectives": ["能根据退休期理财的风险防范原则为客户选择合适的投资工具。", "能运用国债逆回购的理财技巧为客户制订理财规划。", "能运用货币型基金的理财技巧为客户制订理财规划。", "能根据银行理财产品的特点为客户选择合适的理财产品。", "能运用利率债券的理财技巧为客户制订理财规划。"], "taskSuggestions": [], "knowledgeObjectives": ["说出退休养老面对的风险。", "说出退休期理财的风险防范原则以及投资工具。", "简述国债逆回购的理财技巧。", "简述货币型基金的理财技巧。", "说出银行理财产品的特点。", "简述利率债券的理财技巧。"]}, {"order": 2, "title": "退休期积极型理财与方案评估", "learningGoals": ["掌握为退休期积极型投资者制定理财规划。", "学会对退休期理财方案进行定期评估和调整。"], "knowledgePoints": ["指数型基金", "以房养老", "理财方案定期评估", "动态调整方法"], "skillObjectives": ["能运用指数型基金的投资技巧为客户制订理财规划。", "能运用以房养老的投资技巧为客户制订理财规划。", "能完整阐述风险告知、理解定期审视的意义。", "能对退休期投资者理财规划方案进行定期评估。", "能根据定期评估结果对退休期理财规划方案进行动态调整。"], "taskSuggestions": [{"slot": "post", "title": "退休期理财方案评估报告", "taskType": "subjective", "rationale": "模拟对一份给定的退休期理财方案进行评估并提出调整建议，培养综合分析与决策能力。"}], "knowledgeObjectives": ["简述指数型基金的投资技巧。", "说出以房养老的概念。", "简述以房养老的投资技巧。", "记住理财规划方案实施中评估与动态调整的方法。"]}], "learningGoals": ["掌握退休期（养老）的理财特点和常用工具。", "能够为退休期不同风险偏好的客户制定保值增值、注重安全的理财方案，并学会定期评估。"], "skillObjectives": ["能根据退休期理财的风险防范原则为客户选择合适的投资工具。", "能运用国债逆回购、货币型基金、银行理财产品、利率债券、指数型基金、以房养老等工具为客户制订理财规划。", "能完整阐述风险告知、理解定期审视的意义。", "能对退休期投资者理财规划方案进行定期评估。", "能根据定期评估结果对退休期理财规划方案进行动态调整。"], "knowledgeObjectives": ["说出退休养老面对的风险及风险防范原则。", "说出退休期理财的风险防范原则以及投资工具。", "简述国债逆回购、货币型基金、银行理财产品、利率债券、指数型基金、以房养老的理财技巧。", "说出以房养老的概念。", "记住理财规划方案实施中评估与动态调整的方法。"]}], "courseGoals": ["培养学生掌握个人理财的基本概念、原理和方法，能够根据不同人生阶段的财务特点，运用各类理财工具，为个人或家庭制定合理的理财规划方案，树立正确的财富观和风险意识。"], "skillObjectives": ["能够识别投资者的风险偏好类型并匹配相应理财产品。", "能够根据生命周期阶段确定理财目标并进行初步资产配置。", "能够编制个人（家庭）收入支出表和资产负债表，并进行简单的财务指标分析。", "能够运用信用卡、储蓄、基金、股票、保险、贷款等工具，为不同人生阶段的客户制定基础理财规划。", "能够收集客户信息，进行财务诊断，并提出改进建议。", "能够对理财规划方案进行初步的可行性分析和定期评估。"], "valueObjectives": ["树立理性消费、量入为出的健康财富观。", "培养诚实守信、合规合法的职业道德。", "强化风险意识，理解“投资有风险，入市需谨慎”的内涵。", "培养为客户负责、持续学习的敬业精神。", "融入社会主义核心价值观，理解个人财富创造与国家发展的关系。"], "knowledgeObjectives": ["掌握个人理财的基本概念、原理和流程。", "了解各类理财产品的特点、风险与收益。", "理解生命周期理论及其在理财规划中的应用。", "掌握货币时间价值与投资风险价值的基本计算方法。", "熟悉个人（家庭）财务报表的编制与分析方法。", "了解不同人生阶段（单身期、成长期、成熟期、退休期）的理财特点、目标与常用工具。"], "globalKnowledgePoints": ["个人理财基本概念与原理", "理财产品分类与特点", "投资者风险偏好与匹配", "生命周期理论", "货币时间价值", "投资风险价值", "个人（家庭）财务报表", "资产配置基础", "信用卡与储蓄理财", "基金、股票、债券投资基础", "保险（人身、年金、分红、投连）理财", "贷款（住房、汽车）理财", "外汇、黄金投资基础", "退休养老规划与风险防范", "理财方案制定、评估与调整"], "assessmentRequirements": ["过程性评价：包括课堂参与、案例分析、小组讨论、模拟操作等。", "终结性评价：包括理论知识笔试和综合理财规划方案设计。", "技能考核：重点考核财务报表编制、理财产品识别、风险偏好判断、基础方案制定等实操能力。", "综合评价：结合知识、技能、素养（如沟通能力、责任意识）进行多维度评价。"]}	{课程大纲,课程结构}
df54c46d-c333-4561-ac8f-69e91b7cf3db	00000000-0000-4000-8000-00000000a202	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	text	finsim-test-syllabus.md	2026-05-13/89bf1b99-8f8d-453e-831f-f94f45cd1e92.md	text/markdown	ready	# 财务管理基础（测试大纲）\n\n## 课程目标\n\n本课程面向高职财经类专业学生，目标包括：理解财务管理基本原理；掌握资金的时间价值；熟悉企业融资与投资决策方法。\n\n## 第一章 财务管理导论\n\n### 1.1 财务管理的目标\n- 利润最大化与股东财富最大化的区别\n- 财务管理的基本职能\n\n### 1.2 财务管理的环境\n- 金融市场与金融工具\n- 公司治理结构\n\n## 第二章 资金的时间价值\n\n### 2.1 终值与现值\n- 单利与复利\n- 终值与现值公式与计算\n\n### 2.2 年金的计算\n- 普通年金、预付年金、永续年金\n- 年金应用：贷款分期、退休金规划\n\n## 第三章 投资决策\n\n### 3.1 投资决策评估方法\n- 净现值法（NPV）\n- 内部收益率法（IRR）\n- 投资回收期法\n\n### 3.2 投资风险分析\n- 敏感性分析\n- 情景分析\n- 决策树法	本课程覆盖财务管理基础原理，包括财务管理目标和外部环境。重点讲解资金的时间价值，如终值、现值和年金计算。涉及投资决策评估方法，如净现值法、内部收益率法和回收期法。还涵盖投资风险分析技术，如敏感性分析、情景分析和决策树法。	{财务管理目标,金融环境,终值,现值,单利,复利,年金,净现值法,内部收益率法,投资回收期法,敏感性分析,情景分析}	\N	2026-05-13 11:20:52.548	2026-05-13 11:22:25.999	\N	\N	syllabus	{"notes": "需要教师确认或补充以下内容：1. 素养/价值/思政融合目标（如财务职业道德、社会责任等）；2. 具体考核要求或评价方式（如考试、作业、项目等）。此外，taskSuggestions仅为草稿建议，可根据实际教学需求调整。", "chapters": [{"order": 0, "title": "财务管理导论", "sections": [{"order": 0, "title": "1.1 财务管理的目标", "learningGoals": ["理解财务管理目标的不同观点及其应用"], "knowledgePoints": ["利润最大化", "股东财富最大化", "财务管理职能"], "skillObjectives": ["能够比较不同财务管理目标的优劣", "能够分析目标在实际案例中的体现"], "taskSuggestions": [{"slot": "pre", "title": "预习测验：财务管理目标基础", "taskType": "quiz", "rationale": "帮助学生激活先验知识，了解学生对财务目标的初步认识，为课堂讲解做准备"}, {"slot": "in", "title": "案例讨论：不同企业财务管理目标的选择", "taskType": "subjective", "rationale": "通过案例分析，加深学生对目标差异的理解，培养批判性思维"}], "knowledgeObjectives": ["掌握利润最大化与股东财富最大化的概念和差异", "了解财务管理的基本职能（如规划、控制、决策）"]}, {"order": 1, "title": "1.2 财务管理的环境", "learningGoals": ["了解财务管理所处的外部和内部环境"], "knowledgePoints": ["金融市场", "金融工具", "公司治理结构"], "skillObjectives": ["能够描述金融市场（如股票市场、债券市场）对企业财务决策的影响", "能够识别公司治理结构中的关键要素"], "taskSuggestions": [{"slot": "in", "title": "模拟金融市场环境体验", "taskType": "simulation", "rationale": "通过模拟活动，让学生直观感受金融市场运作，增强对环境因素的理解"}, {"slot": "post", "title": "课后测验：环境因素识别", "taskType": "quiz", "rationale": "巩固学生对财务管理环境知识点的掌握，检查学习效果"}], "knowledgeObjectives": ["掌握金融市场与金融工具的基本概念", "理解公司治理结构的作用和影响"]}], "learningGoals": ["了解财务管理的基本概念、目标和环境", "认识财务管理在企业中的重要性"], "skillObjectives": ["能够识别和区分不同的财务管理目标", "能够描述财务管理环境对企业决策的影响"], "knowledgeObjectives": ["掌握利润最大化和股东财富最大化的区别", "理解财务管理的基本职能", "了解金融市场、金融工具和公司治理结构"]}, {"order": 1, "title": "资金的时间价值", "sections": [{"order": 0, "title": "2.1 终值与现值", "learningGoals": ["理解终值与现值的概念，并掌握其计算方法"], "knowledgePoints": ["单利", "复利", "终值公式", "现值公式"], "skillObjectives": ["能够根据给定条件计算终值和现值", "能够比较不同利率下的资金价值"], "taskSuggestions": [{"slot": "pre", "title": "预习测验：基础利息计算", "taskType": "quiz", "rationale": "检查学生对单利和复利的先验知识，为课堂深入讲解做铺垫"}, {"slot": "in", "title": "投资增长模拟计算", "taskType": "simulation", "rationale": "通过模拟不同投资场景，让学生实践终值和现值计算，增强应用能力"}], "knowledgeObjectives": ["掌握单利与复利的原理和计算", "熟悉终值与现值公式（如FV=PV*(1+r)^n）"]}, {"order": 1, "title": "2.2 年金的计算", "learningGoals": ["掌握不同类型年金的计算方法，并了解其应用场景"], "knowledgePoints": ["普通年金", "预付年金", "永续年金", "贷款分期", "退休金规划"], "skillObjectives": ["能够计算各类年金的现值和终值", "能够运用年金知识解决实际财务规划问题"], "taskSuggestions": [{"slot": "in", "title": "案例分析：贷款还款计划设计", "taskType": "subjective", "rationale": "通过实际案例，让学生应用年金计算，培养解决实际问题的能力"}, {"slot": "post", "title": "课后测验：年金综合计算", "taskType": "quiz", "rationale": "巩固学生对年金知识点的掌握，并评估计算技能"}], "knowledgeObjectives": ["理解普通年金、预付年金、永续年金的区别", "掌握年金计算公式和应用（如贷款分期、退休金规划）"]}], "learningGoals": ["掌握资金时间价值的基本概念、计算方法和应用"], "skillObjectives": ["能够运用公式计算终值、现值和年金", "能够应用年金进行贷款分期、退休金规划等实际计算"], "knowledgeObjectives": ["理解单利与复利的区别", "掌握终值、现值和年金的计算公式", "了解年金在财务规划中的应用"]}, {"order": 2, "title": "投资决策", "sections": [{"order": 0, "title": "3.1 投资决策评估方法", "learningGoals": ["学习并应用常用的投资决策评估方法"], "knowledgePoints": ["净现值法（NPV）", "内部收益率法（IRR）", "投资回收期法"], "skillObjectives": ["能够计算NPV、IRR和回收期", "能够根据计算结果评估投资项目的可行性"], "taskSuggestions": [{"slot": "pre", "title": "预习测验：投资评估方法基础", "taskType": "quiz", "rationale": "了解学生对NPV、IRR等概念的初始认知，引导课堂重点讲解"}, {"slot": "in", "title": "投资项目评估模拟", "taskType": "simulation", "rationale": "通过模拟真实投资场景，让学生实践评估方法，提升决策技能"}], "knowledgeObjectives": ["掌握净现值法（NPV）的计算和决策规则", "理解内部收益率法（IRR）和投资回收期法的优缺点"]}, {"order": 1, "title": "3.2 投资风险分析", "learningGoals": ["掌握投资风险分析的基本工具和方法"], "knowledgePoints": ["敏感性分析", "情景分析", "决策树法"], "skillObjectives": ["能够进行简单的敏感性分析和情景分析", "能够使用决策树法分析投资风险"], "taskSuggestions": [{"slot": "in", "title": "案例讨论：投资风险情景分析", "taskType": "subjective", "rationale": "通过讨论实际案例，帮助学生应用风险分析工具，培养风险意识"}, {"slot": "post", "title": "课后测验：风险分析方法识别", "taskType": "quiz", "rationale": "巩固学生对风险分析知识点的理解，并评估应用能力"}], "knowledgeObjectives": ["理解敏感性分析、情景分析和决策树法的概念", "了解这些方法在投资风险评估中的应用"]}], "learningGoals": ["掌握投资决策的评估方法和风险分析工具"], "skillObjectives": ["能够运用NPV、IRR和回收期法评估投资项目", "能够进行投资风险分析和情景模拟"], "knowledgeObjectives": ["理解净现值法（NPV）、内部收益率法（IRR）和投资回收期法的原理", "掌握敏感性分析、情景分析和决策树法的基本概念"]}], "courseGoals": ["理解财务管理基本原理", "掌握资金的时间价值", "熟悉企业融资与投资决策方法"], "skillObjectives": ["能够进行资金时间价值的计算和应用", "能够运用投资决策方法评估项目", "能够分析财务管理环境和风险因素"], "valueObjectives": [], "knowledgeObjectives": ["掌握财务管理的基本概念、原理和方法", "理解资金时间价值的理论基础", "熟悉企业融资、投资和风险管理的核心知识"], "globalKnowledgePoints": ["财务管理基本原理", "资金时间价值", "投资决策方法", "风险管理基础"], "assessmentRequirements": []}	{课程大纲,课程结构,测试}
\.


--
-- Data for Name: CourseTeacher; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CourseTeacher" (id, "courseId", "teacherId", "createdAt") FROM stdin;
944edeb5-3d62-4093-98bb-3cd86b95d557	940bbe23-6172-40bf-bc7f-b22a1840a1de	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-04-22 13:31:59.313
491174d6-f51c-4dba-b37a-e17162990bd3	e6fc049c-756f-4442-86da-35a6cdbadd6e	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-04-22 13:32:08.595
\.


--
-- Data for Name: ImportJob; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ImportJob" (id, "teacherId", "taskId", "fileName", "filePath", status, "totalQuestions", "processedQuestions", error, "createdAt", "updatedAt") FROM stdin;
cc6f8ac3-b1f6-4323-8afa-865e334692e5	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	e07a8ba8-6ee1-4d57-836b-a4847296f376	个人理财-题库.pdf	2026-04-26/ee6cd8fd-94c3-4e68-98f8-1f45183f2d0e.pdf	completed	0	0	\N	2026-04-26 14:02:34.909	2026-04-26 14:02:36.591
\.


--
-- Data for Name: QuizConfig; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."QuizConfig" (id, "taskId", mode, "timeLimitMinutes", "showCorrectAnswer", "maxQuestions", "startDifficulty", "difficultyStep", "createdAt", "updatedAt") FROM stdin;
7f4940b9-32c0-48b6-9b0a-6bb84ec98df6	6018c58c-06ce-4a2f-9f0e-df366aca5f28	fixed	30	t	\N	\N	\N	2026-02-21 09:55:53.296	2026-02-21 09:55:53.296
df950f13-c16e-46f8-a074-2ae41419fa45	29b6fa45-3937-4cc4-8ee8-56366bad7eda	fixed	30	t	\N	\N	\N	2026-04-22 06:54:51.507	2026-04-22 06:54:51.507
afcc2779-c4ef-49e7-ae2a-edf496918710	e07a8ba8-6ee1-4d57-836b-a4847296f376	fixed	\N	f	\N	\N	\N	2026-04-26 14:02:32.599	2026-04-26 14:02:32.599
e74a5e0f-1357-470d-83ea-22c2d361bb40	e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53	adaptive	\N	f	\N	\N	\N	2026-04-27 12:56:16.145	2026-04-27 12:56:16.145
f8027955-255f-4e5c-92b6-3002af646ba5	f5532d66-c556-463d-bdf3-e50b5e4b8e90	fixed	30	t	\N	\N	\N	2026-04-29 11:40:04.501	2026-04-29 11:40:04.501
233858ef-783a-473d-ac04-f5ab1c336bdf	00000000-0000-4000-8000-00000000a501	fixed	20	t	\N	\N	\N	2026-04-29 11:40:04.557	2026-04-29 11:40:04.557
f802afa2-ac31-4289-bbdf-68500edaadd5	00000000-0000-4000-8000-00000000b501	fixed	20	t	\N	\N	\N	2026-04-29 11:40:04.558	2026-04-29 11:40:04.558
6f992e18-ed79-4526-904c-721ccc0d6544	f6ae7ba0-ae3b-4143-ba33-e81e2481b7d7	fixed	20	t	\N	\N	\N	2026-04-30 02:50:06.159	2026-04-30 02:50:06.159
15c45cb0-3b03-45ff-93fb-9bda46248c33	3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9	fixed	30	t	\N	\N	\N	2026-04-30 08:52:12.758	2026-04-30 08:52:12.758
\.


--
-- Data for Name: QuizQuestion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."QuizQuestion" (id, "taskId", type, prompt, options, "correctOptionIds", "correctAnswer", points, difficulty, explanation, "order", "createdAt", "updatedAt") FROM stdin;
d5941231-af89-4932-8d5a-27dd46aff98c	6018c58c-06ce-4a2f-9f0e-df366aca5f28	single_choice	以下哪项不属于个人理财的基本步骤？	[{"label": "A", "content": "设定财务目标"}, {"label": "B", "content": "评估财务状况"}, {"label": "C", "content": "股票内幕交易"}, {"label": "D", "content": "制定理财计划"}]	{C}	\N	10	\N	股票内幕交易是违法行为，不属于合法的个人理财步骤。	0	2026-02-21 09:55:53.296	2026-02-21 09:55:53.296
18d8dc62-adb1-46b7-844e-770727ee063d	6018c58c-06ce-4a2f-9f0e-df366aca5f28	single_choice	货币基金的主要特点不包括？	[{"label": "A", "content": "流动性好"}, {"label": "B", "content": "收益稳定"}, {"label": "C", "content": "高风险高收益"}, {"label": "D", "content": "门槛低"}]	{C}	\N	10	\N	货币基金是低风险低收益产品，不属于高风险高收益类型。	1	2026-02-21 09:55:53.296	2026-02-21 09:55:53.296
e9705c24-d82d-43ce-b578-557f095356c0	6018c58c-06ce-4a2f-9f0e-df366aca5f28	multiple_choice	以下哪些属于固定收益类投资产品？（多选）	[{"label": "A", "content": "国债"}, {"label": "B", "content": "股票"}, {"label": "C", "content": "企业债券"}, {"label": "D", "content": "定期存款"}]	{A,C,D}	\N	15	\N	国债、企业债券和定期存款都属于固定收益类产品，股票属于权益类产品。	2	2026-02-21 09:55:53.296	2026-02-21 09:55:53.296
d8490958-3e88-4089-a44a-9b89a48bedb1	6018c58c-06ce-4a2f-9f0e-df366aca5f28	true_false	分散投资可以完全消除所有投资风险。	[{"label": "正确", "content": "正确"}, {"label": "错误", "content": "错误"}]	{错误}	\N	10	\N	分散投资可以降低非系统性风险，但无法消除系统性风险（市场风险）。	3	2026-02-21 09:55:53.296	2026-02-21 09:55:53.296
f3f72b78-04a0-46c3-812e-0f83de34a155	6018c58c-06ce-4a2f-9f0e-df366aca5f28	short_answer	请简要说明什么是'72法则'，以及如何使用它？	[]	\N	72法则是一个快速估算投资翻倍时间的方法。用72除以年化收益率（百分比），得出资金翻倍所需的大约年数。例如，年化收益率为8%，则资金翻倍大约需要72÷8=9年。	15	\N	72法则是理财规划中常用的快速估算工具。	4	2026-02-21 09:55:53.296	2026-02-21 09:55:53.296
788756e1-f7c4-4b79-8695-c562e35358ea	6018c58c-06ce-4a2f-9f0e-df366aca5f28	single_choice	以下哪种投资策略最适合风险厌恶型投资者？	[{"label": "A", "content": "全仓买入成长股"}, {"label": "B", "content": "60%债券 + 40%股票的均衡配置"}, {"label": "C", "content": "杠杆炒期货"}, {"label": "D", "content": "追涨杀跌"}]	{B}	\N	10	\N	均衡配置兼顾收益和风险控制，最适合风险厌恶型投资者。	5	2026-02-21 09:55:53.296	2026-02-21 09:55:53.296
b0266566-5604-4a6f-b613-0484cf709ead	29b6fa45-3937-4cc4-8ee8-56366bad7eda	single_choice	以下哪项不属于个人理财的基本步骤？	[{"label": "A", "content": "设定财务目标"}, {"label": "B", "content": "评估财务状况"}, {"label": "C", "content": "股票内幕交易"}, {"label": "D", "content": "制定理财计划"}]	{C}	\N	10	\N	股票内幕交易是违法行为，不属于合法的个人理财步骤。	0	2026-04-22 06:54:51.507	2026-04-22 06:54:51.507
c0ec95ee-8c21-44ac-872a-54fb86e32a7c	29b6fa45-3937-4cc4-8ee8-56366bad7eda	single_choice	货币基金的主要特点不包括？	[{"label": "A", "content": "流动性好"}, {"label": "B", "content": "收益稳定"}, {"label": "C", "content": "高风险高收益"}, {"label": "D", "content": "门槛低"}]	{C}	\N	10	\N	货币基金是低风险低收益产品，不属于高风险高收益类型。	1	2026-04-22 06:54:51.507	2026-04-22 06:54:51.507
330c0f1c-89fe-4788-8b59-2256079609a9	29b6fa45-3937-4cc4-8ee8-56366bad7eda	multiple_choice	以下哪些属于固定收益类投资产品？（多选）	[{"label": "A", "content": "国债"}, {"label": "B", "content": "股票"}, {"label": "C", "content": "企业债券"}, {"label": "D", "content": "定期存款"}]	{A,C,D}	\N	15	\N	国债、企业债券和定期存款都属于固定收益类产品，股票属于权益类产品。	2	2026-04-22 06:54:51.507	2026-04-22 06:54:51.507
85f5fe84-1040-436d-a4a0-24f3004d6913	29b6fa45-3937-4cc4-8ee8-56366bad7eda	true_false	分散投资可以完全消除所有投资风险。	[{"label": "正确", "content": "正确"}, {"label": "错误", "content": "错误"}]	{错误}	\N	10	\N	分散投资可以降低非系统性风险，但无法消除系统性风险（市场风险）。	3	2026-04-22 06:54:51.507	2026-04-22 06:54:51.507
c4a99c89-ac70-4da1-b15c-4371df1c4ff2	29b6fa45-3937-4cc4-8ee8-56366bad7eda	short_answer	请简要说明什么是'72法则'，以及如何使用它？	[]	\N	72法则是一个快速估算投资翻倍时间的方法。用72除以年化收益率（百分比），得出资金翻倍所需的大约年数。例如，年化收益率为8%，则资金翻倍大约需要72÷8=9年。	15	\N	72法则是理财规划中常用的快速估算工具。	4	2026-04-22 06:54:51.507	2026-04-22 06:54:51.507
f2923352-53ce-47fe-9a37-dfc2b6b5109f	29b6fa45-3937-4cc4-8ee8-56366bad7eda	single_choice	以下哪种投资策略最适合风险厌恶型投资者？	[{"label": "A", "content": "全仓买入成长股"}, {"label": "B", "content": "60%债券 + 40%股票的均衡配置"}, {"label": "C", "content": "杠杆炒期货"}, {"label": "D", "content": "追涨杀跌"}]	{B}	\N	10	\N	均衡配置兼顾收益和风险控制，最适合风险厌恶型投资者。	5	2026-04-22 06:54:51.507	2026-04-22 06:54:51.507
81819fa1-864a-4928-86a7-d3610b615aa3	e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53	single_choice	在深度测试中，以下哪项最能体现‘深度’的含义？	[{"id": "A", "text": "测试用例数量多"}, {"id": "B", "text": "覆盖所有代码行"}, {"id": "C", "text": "深入验证系统内部逻辑和边界条件"}, {"id": "D", "text": "仅测试用户界面功能"}]	{C}	\N	2	\N	深度测试强调对系统内部逻辑、异常路径和边界条件的深入验证，而非仅关注表面功能或代码覆盖率。	0	2026-04-27 12:56:16.169	2026-04-27 12:56:16.169
d5a4f24a-78f3-474a-8e84-237ff57f75c9	e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53	multiple_choice	以下哪些是深度测试中常用的测试技术？（可多选）	[{"id": "A", "text": "等价类划分"}, {"id": "B", "text": "路径覆盖"}, {"id": "C", "text": "模糊测试"}, {"id": "D", "text": "状态转换测试"}]	{B,C,D}	\N	3	\N	深度测试常涉及路径覆盖（深入代码路径）、模糊测试（异常输入探测）和状态转换测试（复杂状态逻辑），而等价类划分属于基础功能测试技术。	1	2026-04-27 12:56:16.169	2026-04-27 12:56:16.169
34ba68b9-45ee-4849-9153-7ccb396df12f	e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53	true_false	深度测试的目标是发现尽可能多的缺陷，无论其严重程度。	[{"id": "T", "text": "对"}, {"id": "F", "text": "错"}]	{F}	\N	1	\N	深度测试更关注高风险、高影响或隐藏较深的缺陷，而非单纯追求数量，尤其重视可能引发系统崩溃或安全漏洞的问题。	2	2026-04-27 12:56:16.169	2026-04-27 12:56:16.169
e7e3a39c-19fe-469e-8717-517d68e3950d	e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53	short_answer	请简述深度测试与广度测试的主要区别。	\N	{}	深度测试聚焦于特定模块或功能的深入验证，包括边界条件、异常处理和内部逻辑；而广度测试覆盖系统整体功能范围，确保各模块基本功能正常，但不深入细节。	3	\N	深度测试重‘深’，广度测试重‘广’，两者互补。	3	2026-04-27 12:56:16.169	2026-04-27 12:56:16.169
0140dc07-5529-45dd-a870-9c6a48452aef	e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53	single_choice	在进行深度测试时，以下哪种情况最可能被忽略但需要特别关注？	[{"id": "A", "text": "正常业务流程"}, {"id": "B", "text": "用户登录成功场景"}, {"id": "C", "text": "并发访问下的资源竞争"}, {"id": "D", "text": "页面加载速度"}]	{C}	\N	2	\N	并发和资源竞争属于深层次的系统行为，在常规测试中容易被忽略，但在深度测试中需重点验证。	4	2026-04-27 12:56:16.169	2026-04-27 12:56:16.169
70b3b833-77d9-413c-8347-4fb2a75705c9	e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53	multiple_choice	实施深度测试前，通常需要哪些准备工作？（可多选）	[{"id": "A", "text": "获取系统架构文档"}, {"id": "B", "text": "编写自动化脚本"}, {"id": "C", "text": "分析代码逻辑和数据流"}, {"id": "D", "text": "明确高风险模块"}]	{A,C,D}	\N	3	\N	深度测试依赖对系统内部的理解，因此需要架构文档、代码分析和风险识别；自动化脚本虽有用，但非必要前提。	5	2026-04-27 12:56:16.169	2026-04-27 12:56:16.169
6458b86d-4c68-4254-a484-e746b1906f69	e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53	true_false	深度测试只能在系统开发完成后进行。	[{"id": "T", "text": "对"}, {"id": "F", "text": "错"}]	{F}	\N	1	\N	深度测试可在单元、集成等阶段进行，越早介入越能发现深层设计或逻辑问题。	6	2026-04-27 12:56:16.169	2026-04-27 12:56:16.169
06676323-4b9d-44a8-8c30-b87b8433a923	e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53	short_answer	为什么在金融系统中特别需要深度测试？	\N	{}	金融系统涉及资金交易、合规性和高安全性，微小逻辑错误可能导致重大经济损失或法律风险，因此必须通过深度测试验证复杂业务规则、异常处理和安全机制。	3	\N	金融系统的高风险特性决定了必须进行深入、严谨的测试。	7	2026-04-27 12:56:16.169	2026-04-27 12:56:16.169
246d05fc-b952-43e6-8e8d-df5f2bbb3902	e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53	single_choice	以下哪项工具最适用于深度测试中的内存泄漏检测？	[{"id": "A", "text": "Selenium"}, {"id": "B", "text": "JMeter"}, {"id": "C", "text": "Valgrind"}, {"id": "D", "text": "Postman"}]	{C}	\N	2	\N	Valgrind 是专门用于检测内存错误和泄漏的工具，适合深度测试；其他工具主要用于功能或性能测试。	8	2026-04-27 12:56:16.169	2026-04-27 12:56:16.169
6c592f99-2d3d-4e10-8ad3-983cf9c5b0ed	e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53	multiple_choice	深度测试中，判断一个测试用例是否‘深入’的标准包括？（可多选）	[{"id": "A", "text": "是否覆盖了多个功能模块"}, {"id": "B", "text": "是否触发了异常处理路径"}, {"id": "C", "text": "是否验证了内部状态一致性"}, {"id": "D", "text": "是否使用了真实用户数据"}]	{B,C}	\N	2	\N	深度体现在对异常路径和内部状态的验证，而非跨模块覆盖或数据真实性（后者属于广度或数据测试范畴）。	9	2026-04-27 12:56:16.169	2026-04-27 12:56:16.169
bec73af3-e5e0-4527-8dcd-6e2bb3680c04	f5532d66-c556-463d-bdf3-e50b5e4b8e90	single_choice	以下哪项不属于个人理财的基本步骤？	[{"label": "A", "content": "设定财务目标"}, {"label": "B", "content": "评估财务状况"}, {"label": "C", "content": "股票内幕交易"}, {"label": "D", "content": "制定理财计划"}]	{C}	\N	10	\N	股票内幕交易是违法行为，不属于合法的个人理财步骤。	0	2026-04-29 11:40:04.501	2026-04-29 11:40:04.501
295ea5e8-f5fc-4f35-b45c-e765c2440b0a	f5532d66-c556-463d-bdf3-e50b5e4b8e90	single_choice	货币基金的主要特点不包括？	[{"label": "A", "content": "流动性好"}, {"label": "B", "content": "收益稳定"}, {"label": "C", "content": "高风险高收益"}, {"label": "D", "content": "门槛低"}]	{C}	\N	10	\N	货币基金是低风险低收益产品，不属于高风险高收益类型。	1	2026-04-29 11:40:04.501	2026-04-29 11:40:04.501
0c3fda5c-4f97-406c-8bae-2d1c764e5039	f5532d66-c556-463d-bdf3-e50b5e4b8e90	multiple_choice	以下哪些属于固定收益类投资产品？（多选）	[{"label": "A", "content": "国债"}, {"label": "B", "content": "股票"}, {"label": "C", "content": "企业债券"}, {"label": "D", "content": "定期存款"}]	{A,C,D}	\N	15	\N	国债、企业债券和定期存款都属于固定收益类产品，股票属于权益类产品。	2	2026-04-29 11:40:04.501	2026-04-29 11:40:04.501
ed7565ec-e808-4b47-a3dd-66b7263585cd	f5532d66-c556-463d-bdf3-e50b5e4b8e90	true_false	分散投资可以完全消除所有投资风险。	[{"label": "正确", "content": "正确"}, {"label": "错误", "content": "错误"}]	{错误}	\N	10	\N	分散投资可以降低非系统性风险，但无法消除系统性风险（市场风险）。	3	2026-04-29 11:40:04.501	2026-04-29 11:40:04.501
47fcec87-45c7-46a4-8a21-6a5ed9833999	f5532d66-c556-463d-bdf3-e50b5e4b8e90	short_answer	请简要说明什么是'72法则'，以及如何使用它？	[]	\N	72法则是一个快速估算投资翻倍时间的方法。用72除以年化收益率（百分比），得出资金翻倍所需的大约年数。例如，年化收益率为8%，则资金翻倍大约需要72÷8=9年。	15	\N	72法则是理财规划中常用的快速估算工具。	4	2026-04-29 11:40:04.501	2026-04-29 11:40:04.501
07857404-3391-47d8-8297-c076cf78e15c	f5532d66-c556-463d-bdf3-e50b5e4b8e90	single_choice	以下哪种投资策略最适合风险厌恶型投资者？	[{"label": "A", "content": "全仓买入成长股"}, {"label": "B", "content": "60%债券 + 40%股票的均衡配置"}, {"label": "C", "content": "杠杆炒期货"}, {"label": "D", "content": "追涨杀跌"}]	{B}	\N	10	\N	均衡配置兼顾收益和风险控制，最适合风险厌恶型投资者。	5	2026-04-29 11:40:04.501	2026-04-29 11:40:04.501
68703099-8392-4bd2-85f7-97977bc1db0d	f6ae7ba0-ae3b-4143-ba33-e81e2481b7d7	single_choice	家庭理财中，风险承受能力主要用于判断什么？	[{"id": "A", "text": "资产配置是否匹配家庭情况"}, {"id": "B", "text": "是否一定选择最高收益产品"}, {"id": "C", "text": "是否完全不投资"}, {"id": "D", "text": "是否忽略现金流"}]	{A}	\N	50	2	风险承受能力用于匹配资产配置。	0	2026-04-30 02:50:06.159	2026-04-30 02:50:06.159
22679edc-b728-4fca-9218-70241082652d	f6ae7ba0-ae3b-4143-ba33-e81e2481b7d7	short_answer	简述紧急备用金在个人理财中的作用。	\N	{}	应对突发支出，保持现金流安全。	50	2	关注现金流与风险缓冲。	1	2026-04-30 02:50:06.159	2026-04-30 02:50:06.159
9076e940-5674-4d97-8563-7055970c5a86	3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9	single_choice	个人理财的定义是什么？	[{"id": "A", "text": "管理个人或家庭的财务资源以实现财务目标和保障"}, {"id": "B", "text": "只关注短期消费和储蓄"}, {"id": "C", "text": "专门投资于高风险资产"}, {"id": "D", "text": "仅由专业财务顾问处理"}]	{A}	\N	3	\N	个人理财涉及全面管理财务资源，包括收入、支出、储蓄、投资和风险管理，以实现长期财务目标。	0	2026-04-30 08:52:12.777	2026-04-30 08:52:12.777
ce9fd4db-5cb3-4c63-ad68-20d019b2189c	3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9	single_choice	以下哪项不是个人理财的核心要素？	[{"id": "A", "text": "预算编制"}, {"id": "B", "text": "随意消费"}, {"id": "C", "text": "投资规划"}, {"id": "D", "text": "风险保障"}]	{B}	\N	3	\N	个人理财的核心要素包括预算、储蓄、投资、保险等，随意消费不属于核心要素，可能导致财务问题。	1	2026-04-30 08:52:12.777	2026-04-30 08:52:12.777
c7ac00ff-9968-488c-be4d-87bc5230e275	3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9	single_choice	个人理财的主要目标是什么？	[{"id": "A", "text": "最大化短期收益"}, {"id": "B", "text": "实现财务安全和长期目标"}, {"id": "C", "text": "避免所有财务风险"}, {"id": "D", "text": "只关注退休规划"}]	{B}	\N	3	\N	个人理财旨在通过合理规划实现财务安全、保障生活并达成各种财务目标，如购房、教育、退休等，而不是追求短期收益或完全避免风险。	2	2026-04-30 08:52:12.777	2026-04-30 08:52:12.777
e113472b-92a0-4fd8-bd6e-0bab7fa376e6	3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9	multiple_choice	个人理财中，风险管理通常包括哪些方面？（多选）	[{"id": "A", "text": "购买保险"}, {"id": "B", "text": "分散投资"}, {"id": "C", "text": "应急基金"}, {"id": "D", "text": "忽略潜在风险"}, {"id": "E", "text": "定期评估财务计划"}]	{A,B,C,E}	\N	3	\N	风险管理涉及保险、分散投资、应急基金和定期评估，以减少财务不确定性；忽略风险不属于有效管理。	3	2026-04-30 08:52:12.777	2026-04-30 08:52:12.777
6a4e5f22-7728-47f4-8758-30377b9188a7	3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9	multiple_choice	以下哪些是个人理财规划的基本步骤？（多选）	[{"id": "A", "text": "设定财务目标"}, {"id": "B", "text": "评估当前财务状况"}, {"id": "C", "text": "制定预算"}, {"id": "D", "text": "执行和监控计划"}, {"id": "E", "text": "从不调整计划"}]	{A,B,C,D}	\N	3	\N	个人理财规划包括设定目标、评估现状、制定预算、执行计划并定期监控和调整；从不调整计划是不合理的。	4	2026-04-30 08:52:12.777	2026-04-30 08:52:12.777
c068b9c4-dd93-4d16-aae3-108a11e5090b	3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9	true_false	个人理财只适用于成年人，学生不需要关注。	[{"id": "T", "text": "对"}, {"id": "F", "text": "错"}]	{}	\N	3	\N	个人理财对所有年龄段都很重要，学生可以通过学习理财知识为未来做准备，培养良好财务习惯。	5	2026-04-30 08:52:12.777	2026-04-30 08:52:12.777
6b7d41b5-b7dc-4966-b0b6-122a5f9ece8e	3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9	true_false	储蓄是个人理财中唯一重要的部分。	[{"id": "T", "text": "对"}, {"id": "F", "text": "错"}]	{}	\N	3	\N	个人理财包括多个方面，如预算、投资、保险等，储蓄只是其中一部分，需要综合规划。	6	2026-04-30 08:52:12.777	2026-04-30 08:52:12.777
3a058ff4-9adb-4ad5-b32a-05e7a7199d44	3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9	short_answer	简要说明个人理财的重要性，并列举至少三个核心要素。	\N	{}	个人理财的重要性在于帮助个人管理财务资源，实现财务目标，应对不确定性，保障生活质量。核心要素包括：1. 预算编制；2. 储蓄与投资；3. 风险管理；4. 税务规划等。	3	\N	此题评估学生对个人理财整体概念的理解，需涵盖重要性和核心要素。	7	2026-04-30 08:52:12.777	2026-04-30 08:52:12.777
\.


--
-- Data for Name: QuizSubmission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."QuizSubmission" (id, "submissionId", answers, "startedAt", "finishedAt", "durationSeconds", evaluation, "createdAt", "updatedAt", "conceptTags") FROM stdin;
52784510-e589-4cbc-bc8f-cb2b306665fa	00000000-0000-4000-8000-00000000a701	{}	\N	\N	\N	{"feedback": "复利计算和现金流方向需要复盘"}	2026-04-29 11:40:04.582	2026-04-29 11:40:04.582	{复利计算,现金流}
76e4a0c3-4184-41f7-ae0a-42a7febf1016	00000000-0000-4000-8000-00000000a703	{}	\N	\N	\N	{"feedback": "复利公式掌握不稳"}	2026-04-29 11:40:04.591	2026-04-29 11:40:04.591	{复利计算}
50d55212-2715-4ef4-bbf0-d37065c9632e	00000000-0000-4000-8000-00000000b701	{}	\N	\N	\N	{"feedback": "预算管理掌握较好"}	2026-04-29 11:40:04.611	2026-04-29 11:40:04.611	{预算管理}
ad640fc1-5c03-454a-9894-5c47679f8a8e	7f11c15d-34f7-4edf-963d-c6fc0f81bd33	{"22679edc-b728-4fca-9218-70241082652d": "应对突发支出", "68703099-8392-4bd2-85f7-97977bc1db0d": "A"}	\N	\N	620	{"feedback": "掌握较好。", "quizBreakdown": [{"score": 50, "comment": "正确", "correct": true, "maxScore": 50, "questionId": "68703099-8392-4bd2-85f7-97977bc1db0d"}, {"score": 40, "comment": "现金流缓冲解释不完整", "correct": true, "maxScore": 50, "questionId": "22679edc-b728-4fca-9218-70241082652d"}]}	2026-04-30 02:50:06.195	2026-04-30 02:50:06.195	{风险承受能力,现金流管理}
f6545abc-d982-49a5-a14e-a0d3b76bfee8	a48c3799-9656-4b7b-91dc-5d1e4e527be6	{"22679edc-b728-4fca-9218-70241082652d": "预防现金流紧张", "68703099-8392-4bd2-85f7-97977bc1db0d": "B"}	\N	\N	510	{"feedback": "风险收益匹配与现金流解释需要加强。", "quizBreakdown": [{"score": 0, "comment": "混淆高收益与匹配原则", "correct": false, "maxScore": 50, "questionId": "68703099-8392-4bd2-85f7-97977bc1db0d"}, {"score": 55, "comment": "现金流缓冲解释不完整", "correct": false, "maxScore": 50, "questionId": "22679edc-b728-4fca-9218-70241082652d"}]}	2026-04-30 02:50:06.224	2026-04-30 02:50:06.224	{风险承受能力,现金流管理}
1c1c9a8f-dd4b-4e4d-9bcc-2a3337c60619	d4f2f5f8-0db4-49db-9860-6967a85d172e	{"22679edc-b728-4fca-9218-70241082652d": "未作答", "68703099-8392-4bd2-85f7-97977bc1db0d": "B"}	\N	\N	180	{"feedback": "风险收益匹配与现金流解释需要加强。", "quizBreakdown": [{"score": 0, "comment": "混淆高收益与匹配原则", "correct": false, "maxScore": 50, "questionId": "68703099-8392-4bd2-85f7-97977bc1db0d"}, {"score": 0, "comment": "未作答", "correct": false, "maxScore": 50, "questionId": "22679edc-b728-4fca-9218-70241082652d"}]}	2026-04-30 02:50:06.229	2026-04-30 02:50:06.229	{风险承受能力,现金流管理}
85a7a282-401b-45a3-84d4-77c9f153df14	ce37c24e-86b6-4b03-815e-fc71eed84a9a	[{"questionId": "bec73af3-e5e0-4527-8dcd-6e2bb3680c04", "selectedOptionIds": ["C"]}, {"questionId": "295ea5e8-f5fc-4f35-b45c-e765c2440b0a", "selectedOptionIds": ["C"]}, {"questionId": "0c3fda5c-4f97-406c-8bae-2d1c764e5039", "selectedOptionIds": ["A", "C", "D"]}, {"questionId": "ed7565ec-e808-4b47-a3dd-66b7263585cd", "selectedOptionIds": ["false"]}, {"questionId": "47fcec87-45c7-46a4-8a21-6a5ed9833999", "textAnswer": "72法则是估算本金翻倍时间的经验公式，用72除以年化收益率即可估算翻倍所需年数。例如年化收益率6%，约12年翻倍；也可以用72除以年数估算需要的收益率。"}, {"questionId": "07857404-3391-47d8-8297-c076cf78e15c", "selectedOptionIds": ["B"]}]	\N	\N	279	{"feedback": "测验已完成，得分 60/70", "maxScore": 70, "totalScore": 60, "quizBreakdown": [{"score": 10, "comment": "回答正确", "correct": true, "maxScore": 10, "questionId": "bec73af3-e5e0-4527-8dcd-6e2bb3680c04"}, {"score": 10, "comment": "回答正确", "correct": true, "maxScore": 10, "questionId": "295ea5e8-f5fc-4f35-b45c-e765c2440b0a"}, {"score": 15, "comment": "回答正确", "correct": true, "maxScore": 15, "questionId": "0c3fda5c-4f97-406c-8bae-2d1c764e5039"}, {"score": 0, "comment": "正确答案: 错误", "correct": false, "maxScore": 10, "questionId": "ed7565ec-e808-4b47-a3dd-66b7263585cd"}, {"score": 15, "comment": "学生作答准确涵盖了72法则的核心内容，包括定义、计算方法和示例，并补充了反向应用，与参考答案完全匹配。", "correct": true, "maxScore": 15, "questionId": "47fcec87-45c7-46a4-8a21-6a5ed9833999"}, {"score": 10, "comment": "回答正确", "correct": true, "maxScore": 10, "questionId": "07857404-3391-47d8-8297-c076cf78e15c"}]}	2026-04-30 06:41:33.855	2026-04-30 06:42:30.557	{个人理财规划,固定收益投资,分散投资,72法则,风险偏好}
9d84d669-326d-49ff-85a7-e6db253c3e6b	ce7f935d-5ed0-4af0-9aeb-53a527de372c	[{"questionId": "9076e940-5674-4d97-8563-7055970c5a86"}, {"questionId": "ce9fd4db-5cb3-4c63-ad68-20d019b2189c"}]	\N	\N	\N	{"feedback": "测验已完成，原始得分 0/24", "maxScore": 24, "totalScore": 0, "latePenalty": {"rate": 0.2, "label": "迟交扣分 20%", "applied": false, "adjustedScore": 0, "originalScore": 0, "penaltyAmount": 0}, "quizBreakdown": [{"score": 0, "comment": "正确答案: A", "correct": false, "maxScore": 3, "questionId": "9076e940-5674-4d97-8563-7055970c5a86"}, {"score": 0, "comment": "正确答案: B", "correct": false, "maxScore": 3, "questionId": "ce9fd4db-5cb3-4c63-ad68-20d019b2189c"}, {"score": 0, "comment": "未作答", "correct": false, "maxScore": 3, "questionId": "c7ac00ff-9968-488c-be4d-87bc5230e275"}, {"score": 0, "comment": "未作答", "correct": false, "maxScore": 3, "questionId": "e113472b-92a0-4fd8-bd6e-0bab7fa376e6"}, {"score": 0, "comment": "未作答", "correct": false, "maxScore": 3, "questionId": "6a4e5f22-7728-47f4-8758-30377b9188a7"}, {"score": 0, "comment": "未作答", "correct": false, "maxScore": 3, "questionId": "c068b9c4-dd93-4d16-aae3-108a11e5090b"}, {"score": 0, "comment": "未作答", "correct": false, "maxScore": 3, "questionId": "6b7d41b5-b7dc-4966-b0b6-122a5f9ece8e"}, {"score": 0, "comment": "未作答", "correct": false, "maxScore": 3, "questionId": "3a058ff4-9adb-4ad5-b32a-05e7a7199d44"}]}	2026-05-02 09:45:12.832	2026-05-02 09:46:15.751	{个人理财基础,理财核心要素,财务规划步骤,风险管理}
94a125b6-deb7-48d4-bfd6-d15b1ecd98d2	4a3f639d-ab10-4d2c-bd74-9ac0f7cf5c4e	[{"questionId": "68703099-8392-4bd2-85f7-97977bc1db0d", "selectedOptionIds": ["B"]}, {"questionId": "22679edc-b728-4fca-9218-70241082652d", "textAnswer": "高风险一般对应高收益。投资者应根据自身风险承受能力进行资产配置，以平衡收益与风险。"}]	\N	\N	68	{"feedback": "测验已完成，原始得分 0/100", "maxScore": 100, "totalScore": 0, "latePenalty": {"rate": 0.2, "label": "迟交扣分 20%", "applied": false, "adjustedScore": 0, "originalScore": 0, "penaltyAmount": 0}, "quizBreakdown": [{"score": 0, "comment": "正确答案: A", "correct": false, "maxScore": 50, "questionId": "68703099-8392-4bd2-85f7-97977bc1db0d"}, {"score": 0, "comment": "作答内容与题目完全无关。题目考查紧急备用金的作用（应对突发支出、保障现金流），而学生回答的是风险收益关系及资产配置原则。核心要点未命中，得 0 分。", "correct": false, "maxScore": 50, "questionId": "22679edc-b728-4fca-9218-70241082652d"}]}	2026-05-02 09:58:18.461	2026-05-02 10:04:16.435	{风险承受能力,紧急备用金,流动性管理,家庭理财规划}
\.


--
-- Data for Name: ScheduleSlot; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ScheduleSlot" (id, "courseId", "dayOfWeek", "slotIndex", "startWeek", "endWeek", "timeLabel", classroom, "createdBy", "createdAt", "weekType") FROM stdin;
aaa070c0-3224-4796-af95-ce5b4c29d6de	940bbe23-6172-40bf-bc7f-b22a1840a1de	1	2	1	16	10:00-11:40	金融楼 301	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.324	all
87b3054f-e145-4471-92e7-7568864ae788	940bbe23-6172-40bf-bc7f-b22a1840a1de	3	4	1	16	14:00-15:40	金融楼 301	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.328	all
5e030f0c-d33a-4843-b846-12728847503c	e6fc049c-756f-4442-86da-35a6cdbadd6e	1	2	1	16	10:00-11:40	金融楼 301	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.522	all
d48c2b25-a390-42ad-ad94-6be7c29e75d0	e6fc049c-756f-4442-86da-35a6cdbadd6e	3	4	1	16	14:00-15:40	金融楼 301	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.524	all
483db1d8-0ef3-48c6-a9f3-316dbf2afb4e	8f7f653c-9177-44f6-b764-80f7f779b2ef	7	2	1	16	10:25-12:00	\N	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-04-26 13:11:21.187	all
a774c901-e6ea-4f4e-9a9f-8f266525c07f	8f7f653c-9177-44f6-b764-80f7f779b2ef	7	3	1	16	14:00-15:35	\N	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-04-26 13:11:27.207	all
ed263576-60e7-4fea-b023-aa7523dd64ae	8f7f653c-9177-44f6-b764-80f7f779b2ef	7	4	1	16	15:55-17:30	\N	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-04-26 13:11:30.448	all
1ef8f447-569b-4bd5-a657-1a56bc53bb16	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	1	2	1	16	10:00-11:40	金融楼 301	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.534	all
d2eb1b3c-3f03-49e4-b2e9-dd1703563c76	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	3	4	1	16	14:00-15:40	金融楼 301	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.54	all
\.


--
-- Data for Name: ScoringCriterion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ScoringCriterion" (id, "taskId", name, description, "maxPoints", "order", "createdAt") FROM stdin;
f07d5da9-45f0-4cd1-a9d4-5986a41d2199	50194450-47c2-4cee-b2fa-2aa6b634fb5f	需求分析	是否充分了解客户的财务状况和理财目标	25	0	2026-02-21 09:55:53.279
fb85d6b6-f94f-4090-96ee-a9850b30ed10	50194450-47c2-4cee-b2fa-2aa6b634fb5f	风险评估	是否合理评估客户的风险承受能力	20	1	2026-02-21 09:55:53.279
08fdc14a-ed13-4ec6-b043-4733f1ab7bdc	50194450-47c2-4cee-b2fa-2aa6b634fb5f	方案推荐	推荐的理财方案是否合理、多样化	25	2	2026-02-21 09:55:53.279
bde82dfc-156e-4f1b-8cd8-c851fbf7218d	50194450-47c2-4cee-b2fa-2aa6b634fb5f	沟通技巧	沟通是否专业、耐心、通俗易懂	15	3	2026-02-21 09:55:53.279
c9fd514f-381b-44b3-b2bc-db87d20ed5fd	50194450-47c2-4cee-b2fa-2aa6b634fb5f	合规意识	是否充分披露风险、遵守合规要求	15	4	2026-02-21 09:55:53.279
b8f20887-03de-43ef-ab1e-08e0a2f1ec34	aff902a3-a669-4181-91ea-613519b9f4d2	客户分析	对客户财务状况和需求的分析是否全面	20	0	2026-02-21 09:55:53.306
a0c5b979-6f1c-46a0-9739-892c93ae8d21	aff902a3-a669-4181-91ea-613519b9f4d2	方案设计	投资方案是否合理、具体、可操作	30	1	2026-02-21 09:55:53.306
e9a5b7a8-f7da-4dc3-8b02-f614dbf91e74	aff902a3-a669-4181-91ea-613519b9f4d2	风险分析	对各类风险的分析是否深入	25	2	2026-02-21 09:55:53.306
76c21b19-aa1c-46c6-b0e1-eb03f93923fb	aff902a3-a669-4181-91ea-613519b9f4d2	文字表达	报告的结构、逻辑和语言表达	15	3	2026-02-21 09:55:53.306
f1e88dd7-617e-4f5a-95f1-627888a65da3	aff902a3-a669-4181-91ea-613519b9f4d2	创新性	是否有独到见解或创新方案	10	4	2026-02-21 09:55:53.306
a6ee0b9c-dd25-42a3-8bf3-08a3b916c281	a308c7ba-2713-4c2d-9441-c92927e3f9f4	需求分析	是否充分了解客户的财务状况和理财目标	25	0	2026-04-22 06:54:51.498
3536727c-5b59-40ab-a460-fe4010c2bbcc	a308c7ba-2713-4c2d-9441-c92927e3f9f4	风险评估	是否合理评估客户的风险承受能力	20	1	2026-04-22 06:54:51.498
5af1ac30-d3b4-4b3e-a8fd-1133c4e23bfe	a308c7ba-2713-4c2d-9441-c92927e3f9f4	方案推荐	推荐的理财方案是否合理、多样化	25	2	2026-04-22 06:54:51.498
c299e3af-c37c-41d3-a5df-a6536d375347	a308c7ba-2713-4c2d-9441-c92927e3f9f4	沟通技巧	沟通是否专业、耐心、通俗易懂	15	3	2026-04-22 06:54:51.498
84d816a2-bffa-4ccc-a0ff-71f6a8044dcd	a308c7ba-2713-4c2d-9441-c92927e3f9f4	合规意识	是否充分披露风险、遵守合规要求	15	4	2026-04-22 06:54:51.498
1708f564-1dab-4046-b808-18c025aed39c	ca705f3a-e604-47a8-8e28-e12f6bf0d9ad	客户分析	对客户财务状况和需求的分析是否全面	20	0	2026-04-22 06:54:51.512
fc8609a6-0e71-4b27-81ae-fdde3a87953b	ca705f3a-e604-47a8-8e28-e12f6bf0d9ad	方案设计	投资方案是否合理、具体、可操作	30	1	2026-04-22 06:54:51.512
7bfe100e-512f-4437-8582-6c23b0695782	ca705f3a-e604-47a8-8e28-e12f6bf0d9ad	风险分析	对各类风险的分析是否深入	25	2	2026-04-22 06:54:51.512
3daf1bff-6194-4bd6-8e5a-8c766165f91a	ca705f3a-e604-47a8-8e28-e12f6bf0d9ad	文字表达	报告的结构、逻辑和语言表达	15	3	2026-04-22 06:54:51.512
fa4b274a-6eb3-4ad4-90d8-20bba8fda930	ca705f3a-e604-47a8-8e28-e12f6bf0d9ad	创新性	是否有独到见解或创新方案	10	4	2026-04-22 06:54:51.512
202a0e7d-6b5b-4a83-809e-8f54d66b7fa9	77999372-a6e0-4a49-8a01-5e978d08bdb6	需求分析	是否充分了解客户的财务状况和理财目标	25	0	2026-04-29 11:40:04.487
718fe33c-8a83-4ed6-84b3-cea7d994b492	77999372-a6e0-4a49-8a01-5e978d08bdb6	风险评估	是否合理评估客户的风险承受能力	20	1	2026-04-29 11:40:04.487
01455f91-082d-4bf2-841c-8a983f42e28d	77999372-a6e0-4a49-8a01-5e978d08bdb6	方案推荐	推荐的理财方案是否合理、多样化	25	2	2026-04-29 11:40:04.487
b8feee0a-c212-4228-a1c6-34e02d359bb4	77999372-a6e0-4a49-8a01-5e978d08bdb6	沟通技巧	沟通是否专业、耐心、通俗易懂	15	3	2026-04-29 11:40:04.487
b4634da0-a9e6-47a7-b482-7021a5846f39	77999372-a6e0-4a49-8a01-5e978d08bdb6	合规意识	是否充分披露风险、遵守合规要求	15	4	2026-04-29 11:40:04.487
98ed65bc-e1f0-4717-b85c-a451491f15c5	cd4bb0e4-edbf-4191-bf5e-7d2eb5ac392d	客户分析	对客户财务状况和需求的分析是否全面	20	0	2026-04-29 11:40:04.512
873adfe5-cf20-4eb4-bea0-291417db672f	cd4bb0e4-edbf-4191-bf5e-7d2eb5ac392d	方案设计	投资方案是否合理、具体、可操作	30	1	2026-04-29 11:40:04.512
e54ea65b-50cd-4dd4-a541-fc79dcfb1f7f	cd4bb0e4-edbf-4191-bf5e-7d2eb5ac392d	风险分析	对各类风险的分析是否深入	25	2	2026-04-29 11:40:04.512
2d0d4800-3cff-435a-bf21-333b79024c11	cd4bb0e4-edbf-4191-bf5e-7d2eb5ac392d	文字表达	报告的结构、逻辑和语言表达	15	3	2026-04-29 11:40:04.512
f4c3ec6a-7149-4806-b93c-06b93d73dd61	cd4bb0e4-edbf-4191-bf5e-7d2eb5ac392d	创新性	是否有独到见解或创新方案	10	4	2026-04-29 11:40:04.512
83e07f7e-5295-4f1c-afcb-6ce974ec6183	d8097130-8847-4a51-aa30-dffa6345f59c	收支识别	能识别固定支出、弹性支出和结余。	40	0	2026-04-30 02:50:06.236
65723ff6-df90-4214-ad5e-758c04c22a81	d8097130-8847-4a51-aa30-dffa6345f59c	建议可执行性	建议具体、适合中高职学生理解。	60	1	2026-04-30 02:50:06.236
f25293a6-b51f-46b4-8f14-3202fd59f4da	5e69a393-3175-4cef-a92a-c44612593f4d	需求澄清	主动询问家庭财务状况和目标。	35	0	2026-04-30 02:50:06.289
4634e35f-1e8b-4cc2-a20f-ca92bb6503ab	5e69a393-3175-4cef-a92a-c44612593f4d	风险收益解释	能用通俗语言解释高收益和高风险关系。	35	1	2026-04-30 02:50:06.289
9bebad25-3669-41b7-ae57-6826d66047be	5e69a393-3175-4cef-a92a-c44612593f4d	行动建议	给出备用金和资产配置建议。	30	2	2026-04-30 02:50:06.289
\.


--
-- Data for Name: Section; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Section" (id, "courseId", "chapterId", title, "order", "createdBy", "createdAt") FROM stdin;
3e52d6bd-830c-4121-b67c-7c97766294fa	940bbe23-6172-40bf-bc7f-b22a1840a1de	d73bf6ea-9c1b-4d44-a190-5165917a14c2	财务目标设定	1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.268
244012b6-2ce6-4295-806f-b999b9d8660f	940bbe23-6172-40bf-bc7f-b22a1840a1de	d73bf6ea-9c1b-4d44-a190-5165917a14c2	收支管理	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.269
29f7596d-b224-4df9-854b-a8cb1b391e06	940bbe23-6172-40bf-bc7f-b22a1840a1de	a44443f2-af76-4e45-b467-d6f55576e212	银行存款与理财	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.271
6599331b-6331-4344-b730-1905fedc20ba	940bbe23-6172-40bf-bc7f-b22a1840a1de	a44443f2-af76-4e45-b467-d6f55576e212	基金投资基础	1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.272
ca1bf9e6-17f8-469b-b719-766b898532a3	940bbe23-6172-40bf-bc7f-b22a1840a1de	a44443f2-af76-4e45-b467-d6f55576e212	股票投资入门	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.273
25528206-74b3-4243-bc2c-bab0ad85f61d	940bbe23-6172-40bf-bc7f-b22a1840a1de	894fbab1-f4b1-4c39-a57c-c95d73577ed8	风险认知与评估	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.275
1672905c-51a7-4b5e-90c8-afcbdfd5bdd9	940bbe23-6172-40bf-bc7f-b22a1840a1de	894fbab1-f4b1-4c39-a57c-c95d73577ed8	资产配置策略	1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.277
47cc432b-7960-4a53-9c6f-6c8a2934e754	940bbe23-6172-40bf-bc7f-b22a1840a1de	d73bf6ea-9c1b-4d44-a190-5165917a14c2	深度	3	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 11:20:38.17
11a08e07-87b3-474f-bb34-d56634b56b1f	8f7f653c-9177-44f6-b764-80f7f779b2ef	d22f7150-645d-4f1f-af94-c41efb4bca67	粉线	0	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-04-13 13:30:59.892
5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	什么是个人理财	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.491
65053639-55f2-44bd-9f44-65a6d7d60bb3	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	财务目标设定	1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.493
43e8371f-14b4-476d-9afe-20613d0c9485	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	收支管理	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.493
43058dc8-2254-4403-9c01-4d968546cb01	e6fc049c-756f-4442-86da-35a6cdbadd6e	3e7e8bac-c2a8-4da8-9065-87c2d77a32bb	银行存款与理财	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.494
fa7a864c-0bd5-4bd2-8a76-293910c0a161	e6fc049c-756f-4442-86da-35a6cdbadd6e	3e7e8bac-c2a8-4da8-9065-87c2d77a32bb	基金投资基础	1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.495
4a2eddb9-b30f-44e9-b902-4ddaf64690b2	e6fc049c-756f-4442-86da-35a6cdbadd6e	3e7e8bac-c2a8-4da8-9065-87c2d77a32bb	股票投资入门	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.496
d4a078e7-6fab-4101-9163-36d3168a2c73	e6fc049c-756f-4442-86da-35a6cdbadd6e	c80664af-66db-4127-bd6a-46bb15513be1	风险认知与评估	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.497
765148b3-8a2d-42cd-93a3-46b47360f280	e6fc049c-756f-4442-86da-35a6cdbadd6e	c80664af-66db-4127-bd6a-46bb15513be1	资产配置策略	1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.497
1ace5e74-6a79-40ca-afcf-229abfe0e1d8	940bbe23-6172-40bf-bc7f-b22a1840a1de	d73bf6ea-9c1b-4d44-a190-5165917a14c2	什么是个人理财	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.265
2709804c-dbb1-488b-85b3-9b5a2287ab68	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	e8d705d0-3d1f-480a-8a97-0e71d0e6a832	什么是个人理财	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.478
7b472d00-d948-48f6-ac0f-22b37e469817	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	e8d705d0-3d1f-480a-8a97-0e71d0e6a832	财务目标设定	1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.48
e608d521-429e-43a4-abc4-03c6f7c68041	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	e8d705d0-3d1f-480a-8a97-0e71d0e6a832	收支管理	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.481
a8a0169f-eade-41b9-b4a6-d3f115b9ebbc	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	fdbbe65f-5645-43a6-9468-23dcb3b252a6	银行存款与理财	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.482
58d1cee7-23f4-4b0d-bec0-eb2337d365e0	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	fdbbe65f-5645-43a6-9468-23dcb3b252a6	基金投资基础	1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.483
4180971c-3a10-4c36-8003-1f2d6f061a93	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	fdbbe65f-5645-43a6-9468-23dcb3b252a6	股票投资入门	2	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.484
bc034d9f-8f65-48f7-85b6-a62b1648eee2	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	2af5c382-dbc8-49d9-ac9c-1ae722ce55ad	风险认知与评估	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.485
becc4615-d8ae-4a26-b944-2dc32e790064	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	2af5c382-dbc8-49d9-ac9c-1ae722ce55ad	资产配置策略	1	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.486
00000000-0000-4000-8000-00000000a401	00000000-0000-4000-8000-00000000a201	00000000-0000-4000-8000-00000000a301	复利与现金流	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.551
00000000-0000-4000-8000-00000000a402	00000000-0000-4000-8000-00000000a201	00000000-0000-4000-8000-00000000a302	风险识别	0	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.553
\.


--
-- Data for Name: SimulationConfig; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SimulationConfig" (id, "taskId", scenario, "openingLine", "dialogueRequirements", "studyBuddyContext", "evaluatorPersona", "strictnessLevel", "createdAt", "updatedAt", "systemPrompt") FROM stdin;
ceaadabe-dc50-4ddb-b90e-3d3e471a32de	a308c7ba-2713-4c2d-9441-c92927e3f9f4	你是王女士，45岁，公司中层管理人员。你有100万存款想要理财。你的月收入2万，月支出1万。你有一个读高中的孩子，计划3年后出国留学。你对投资比较保守，之前只买过银行理财产品。	你好，我是王女士。我听朋友说可以来这里做理财咨询，我有一些积蓄想做些投资，但不太懂金融产品。	\N	理财咨询模拟场景：中年女性客户，保守型投资偏好，有子女教育需求。	你是一位资深理财教育评估专家，关注学生的沟通技巧和专业建议质量。	MODERATE	2026-04-22 06:54:51.498	2026-04-22 06:54:51.498	\N
a2aaf287-103b-424c-83ff-8efbf426b701	77999372-a6e0-4a49-8a01-5e978d08bdb6	你是王女士，45岁，公司中层管理人员。你有100万存款想要理财。你的月收入2万，月支出1万。你有一个读高中的孩子，计划3年后出国留学。你对投资比较保守，之前只买过银行理财产品。	你好，我是王女士。我听朋友说可以来这里做理财咨询，我有一些积蓄想做些投资，但不太懂金融产品。	\N	理财咨询模拟场景：中年女性客户，保守型投资偏好，有子女教育需求。	你是一位资深理财教育评估专家，关注学生的沟通技巧和专业建议质量。	MODERATE	2026-04-29 11:40:04.487	2026-04-29 11:40:04.487	\N
9e1098ea-aa4d-4728-bdf8-fb3eda39c9da	00000000-0000-4000-8000-00000000a502	ANL-2 客户希望评估家庭现金流和风险承受能力。	老师，我想确认这位客户适合怎样的资产配置。	\N	\N	\N	MODERATE	2026-04-29 11:40:04.559	2026-04-29 11:40:04.559	\N
521583ab-d021-4e28-951e-14a5ae50474b	5e69a393-3175-4cef-a92a-c44612593f4d	客户希望购买高收益产品，但家庭短期现金流紧张。学生需要澄清需求并解释风险收益关系。	我想买收益最高的产品，越快赚钱越好。	至少询问收入支出、备用金和风险承受能力。	\N	\N	MODERATE	2026-04-30 02:50:06.289	2026-04-30 02:50:06.289	\N
af51bbab-e32a-46be-b6cb-d2ef6be3fe95	50194450-47c2-4cee-b2fa-2aa6b634fb5f	你是王女士，45岁，公司中层管理人员。你有100万存款想要理财。你的月收入2万，月支出1万。你有一个读高中的孩子，计划3年后出国留学。你对投资比较保守，之前只买过银行理财产品。	你好，我是王女士。我听朋友说可以来这里做理财咨询，我有一些积蓄想做些投资，但不太懂金融产品。	\N	理财咨询模拟场景：中年女性客户，保守型投资偏好，有子女教育需求。	你是一位资深理财教育评估专家，关注学生的沟通技巧和专业建议质量。	MODERATE	2026-02-21 09:55:53.279	2026-02-21 09:55:53.279	你是李志华，38 岁，深圳一家互联网公司高级产品经理，离婚带两个孩子（10 岁和 8 岁），月收入税后 5 万。你比较谨慎，最在意孩子教育金和家庭医疗应急。回答时用第一人称、语气克制、每条 2-3 句中文。{scenario}
\.


--
-- Data for Name: SimulationSubmission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SimulationSubmission" (id, "submissionId", transcript, assets, evaluation, "createdAt", "updatedAt", "conceptTags") FROM stdin;
8de6496b-9470-476e-9f2c-d0d5beedf9e2	1e4bcf48-c6a3-4c43-a333-0fa2b556916b	[{"role": "assistant", "content": "我想买收益最高的产品，越快赚钱越好。"}, {"role": "student", "content": "我先了解你的收入支出和备用金，再判断风险是否合适。"}]	{"growth": 15, "stable": 45, "emergencyFund": 40}	{"feedback": "能澄清需求并解释风险。", "rubricBreakdown": [{"score": 32, "comment": "需求澄清 表现较好", "maxScore": 35, "criterionId": "f25293a6-b51f-46b4-8f14-3202fd59f4da"}, {"score": 30, "comment": "风险收益解释 表现较好", "maxScore": 35, "criterionId": "4634e35f-1e8b-4cc2-a20f-ca92bb6503ab"}, {"score": 26, "comment": "行动建议 表现较好", "maxScore": 30, "criterionId": "9bebad25-3669-41b7-ae57-6826d66047be"}]}	2026-04-30 02:50:06.324	2026-04-30 02:50:06.324	{风险收益权衡,客户需求澄清,资产配置}
419c9d25-484f-4b62-adec-8db7bdb40c24	00000000-0000-4000-8000-00000000a704	[]	\N	{"feedback": "风险承受能力判断偏保守"}	2026-04-29 11:40:04.594	2026-04-29 11:40:04.594	{风险评估,现金流}
001ba166-d21b-4c6a-a9d2-8ff7849e523e	16ed122e-75da-4390-86c0-6c1668f5dccd	[{"role": "assistant", "content": "我想买收益最高的产品，越快赚钱越好。"}, {"role": "student", "content": "可以买高收益，但有风险。"}]	{"growth": 70, "stable": 20, "emergencyFund": 10}	{"feedback": "对风险收益解释不足，客户需求澄清不够。", "rubricBreakdown": [{"score": 18, "comment": "需求澄清 需要加强", "maxScore": 35, "criterionId": "f25293a6-b51f-46b4-8f14-3202fd59f4da"}, {"score": 18, "comment": "风险收益解释 需要加强", "maxScore": 35, "criterionId": "4634e35f-1e8b-4cc2-a20f-ca92bb6503ab"}, {"score": 22, "comment": "行动建议 需要加强", "maxScore": 30, "criterionId": "9bebad25-3669-41b7-ae57-6826d66047be"}]}	2026-04-30 02:50:06.338	2026-04-30 02:50:06.338	{风险收益权衡,客户需求澄清,资产配置}
4823f671-4e63-4201-b0c1-a9a9a7af6735	fac13b95-5a52-41cc-a6c5-91dd95944eac	[{"role": "assistant", "content": "我想买收益最高的产品，越快赚钱越好。"}, {"role": "student", "content": "可以买高收益，但有风险。"}]	{"growth": 70, "stable": 20, "emergencyFund": 10}	{"feedback": "对风险收益解释不足，客户需求澄清不够。", "rubricBreakdown": [{"score": 10, "comment": "需求澄清 需要加强", "maxScore": 35, "criterionId": "f25293a6-b51f-46b4-8f14-3202fd59f4da"}, {"score": 12, "comment": "风险收益解释 需要加强", "maxScore": 35, "criterionId": "4634e35f-1e8b-4cc2-a20f-ca92bb6503ab"}, {"score": 20, "comment": "行动建议 需要加强", "maxScore": 30, "criterionId": "9bebad25-3669-41b7-ae57-6826d66047be"}]}	2026-04-30 02:50:06.347	2026-04-30 02:50:06.347	{风险收益权衡,客户需求澄清,资产配置}
8ece3b35-4555-4c7b-82c1-d34fb5878992	4145932c-a4a8-4d3d-9916-83c3a973fd0c	[{"id": "c253b3d9-b795-40cf-b2a4-54b23c719038", "mood": "NEUTRAL", "role": "ai", "text": "我想买收益最高的产品，越快赚钱越好。", "timestamp": "2026-04-30T06:42:19.574Z"}, {"id": "bcc59b9b-c496-4ba1-afc6-6f26b64f20f7", "role": "student", "text": "我先了解一下您的现金流情况：目前每月结余、已有备用金和未来三个月的大额支出是什么？如果短期现金流紧张，不能只追求最高收益，需要先保留应急资金，再考虑稳健配置。", "timestamp": "2026-04-30T06:43:03.021Z"}, {"id": "95041245-55bc-4e9b-a5e0-593c1539e327", "mood": "CONFUSED", "role": "ai", "text": "我的每月结余确实不多，备用金也勉强够用，下个月家里还有笔不小的开支。但我还是希望能找到收益高点的产品，尽快让钱增值，你有什么好办法吗？", "moodScore": 0.6, "timestamp": "2026-04-30T06:43:23.559Z"}, {"id": "f6aee275-cc41-4747-aee1-032435f12d22", "role": "student", "text": "在这种情况下，我建议先把下个月的大额支出和3到6个月必要支出放在备用金，再把可投资部分放入低波动产品。高收益通常伴随本金波动和流动性风险，若短期要用钱，不适合重仓高风险产品。", "timestamp": "2026-04-30T06:45:02.668Z"}, {"id": "9b1a4c55-fb50-4284-a1c2-14a3d4432f88", "mood": "NEUTRAL", "role": "ai", "text": "我明白你的意思了，但高收益产品真的完全不能考虑吗？有没有什么折中的办法，既能控制风险，又能比低波动产品收益好一点？我确实希望钱能快点增值。", "moodScore": 0.35, "timestamp": "2026-04-30T06:45:22.840Z"}, {"id": "a6363ff9-3bc6-47ce-b261-10cf6d786b43", "role": "student", "text": "可以折中：先把下个月的大额支出和3到6个月必要支出放在备用金，再把可投资部分分成两层，约60%放在现金和短期低风险产品，30%做稳健理财，最多10%用长期不用的钱尝试成长型投资。这样不会影响短期现金流，也保留少量增值机会。", "timestamp": "2026-04-30T06:51:32.296Z"}, {"id": "642867cd-2554-449a-bc3a-6039e94ef716", "mood": "NEUTRAL", "role": "ai", "text": "这个折中方案听起来挺合理的，能帮我控制风险。不过，那10%的成长型投资具体能投什么产品呢？另外，我其实还在为孩子未来的教育基金做准备，这部分投资能灵活一点吗？", "moodScore": 0.3, "timestamp": "2026-04-30T06:51:53.569Z"}]	{"sections": [{"items": [{"label": "紧急备用金", "value": 0}, {"label": "稳健理财", "value": 0}, {"label": "成长投资", "value": 0}], "label": "资金安排"}], "snapshots": []}	{"feedback": "理财经理在对话中表现全面，主动澄清客户需求，用通俗语言解释风险收益关系，并提供具体的资产配置建议。客户反馈积极，表示理解并接受建议。", "maxScore": 100, "totalScore": 100, "conceptTags": ["风险收益关系", "资产配置", "备用金管理", "现金流管理"], "rubricBreakdown": [{"score": 35, "comment": "理财经理主动询问家庭财务状况，如'目前每月结余、已有备用金和未来三个月的大额支出是什么？'，并在后续对话中考虑客户提到的教育基金目标，有效澄清了需求。", "maxScore": 35, "criterionId": "f25293a6-b51f-46b4-8f14-3202fd59f4da"}, {"score": 35, "comment": "理财经理用通俗语言解释了风险收益关系，如'高收益通常伴随本金波动和流动性风险，若短期要用钱，不适合重仓高风险产品'，客户回应'我明白你的意思了'，表明解释清晰有效。", "maxScore": 35, "criterionId": "4634e35f-1e8b-4cc2-a20f-ca92bb6503ab"}, {"score": 30, "comment": "理财经理给出了具体行动建议，包括'先把下个月的大额支出和3到6个月必要支出放在备用金'和分层资产配置（约60%低风险、30%稳健、10%成长型），以平衡风险和收益，建议明确可行。", "maxScore": 30, "criterionId": "9bebad25-3669-41b7-ae57-6826d66047be"}]}	2026-04-30 06:54:56.063	2026-04-30 06:55:28.417	{风险收益关系,资产配置,备用金管理,现金流管理}
47ec4c57-6949-444f-abce-a24aca6b3d73	32b9381c-8b6c-44cd-93ce-1d18b1049020	[{"id": "4e6fd33b-3de6-4583-9e4c-68af4c501862", "mood": "NEUTRAL", "role": "ai", "text": "你好，我是王女士。我听朋友说可以来这里做理财咨询，我有一些积蓄想做些投资，但不太懂金融产品。", "timestamp": "2026-05-02T09:32:54.417Z"}, {"id": "016ad64e-78cd-4ba5-a3ec-d3e4f7091825", "role": "student", "text": "您好王女士，欢迎来理财咨询。能先了解一下您的目标吗？是想为孩子留学准备资金，还是有别的需求？", "timestamp": "2026-05-02T09:33:17.767Z"}, {"id": "28859caf-60d7-461e-9ed4-1d543c963297", "mood": "HAPPY", "role": "ai", "text": "是的，我主要想为孩子准备留学费用，他现在读高中，大概三年后就要出国了。我自己还有些存款，但不太敢冒风险，之前只买过银行理财。", "moodScore": 0.2, "timestamp": "2026-05-02T09:33:21.161Z"}]	{"sections": [{"items": [{"label": "银行存款/货币基金", "value": 0}, {"label": "债券/债券基金", "value": 0}, {"label": "混合基金", "value": 0}, {"label": "股票/股票基金", "value": 0}, {"label": "保险产品", "value": 0}], "label": "资产配置方案"}], "snapshots": []}	{"feedback": "理财经理在开场问候和目标询问上表现专业（如“能先了解一下您的目标吗？”），沟通态度礼貌。但在需求分析上不够深入，未主动核实客户具体的收支状况及存款金额（客户仅说“有些积蓄”）。最关键的是，最终资产配置方案所有项均为 0，意味着未提供任何实质性的理财建议，导致方案推荐项得分为 0。此外，对话中完全缺失风险揭示和合规声明，对于保守型客户未解释潜在风险。建议补充完整的财务信息收集流程，制定具体的资产配置方案，并加强合规话术。", "maxScore": 100, "totalScore": 25, "conceptTags": ["理财目标规划", "风险偏好评估", "资产配置", "合规披露", "需求分析"], "latePenalty": {"rate": 0.2, "label": "迟交扣分 20%", "applied": false, "adjustedScore": 25, "originalScore": 25, "penaltyAmount": 0}, "rubricBreakdown": [{"score": 10, "comment": "询问了理财目标（孩子留学），但未在对话中主动收集收入、支出及具体存款金额等关键财务数据，依赖客户自述。", "maxScore": 25, "criterionId": "202a0e7d-6b5b-4a83-809e-8f54d66b7fa9"}, {"score": 5, "comment": "被动接受了客户“不太敢冒风险”的自述，未进行正式的风险承受能力评估或追问细节。", "maxScore": 20, "criterionId": "718fe33c-8a83-4ed6-84b3-cea7d994b492"}, {"score": 0, "comment": "提交的资产配置方案中所有资产类别数值均为 0，未提供任何具体的产品推荐或配置比例。", "maxScore": 25, "criterionId": "01455f91-082d-4bf2-841c-8a983f42e28d"}, {"score": 10, "comment": "沟通语气专业、耐心，开场白得体，但对话过短，未展示深入解释复杂概念的能力。", "maxScore": 15, "criterionId": "b8feee0a-c212-4228-a1c6-34e02d359bb4"}, {"score": 0, "comment": "对话及方案中均未包含任何风险揭示、免责声明或合规性提示。", "maxScore": 15, "criterionId": "b4634da0-a9e6-47a7-b482-7021a5846f39"}]}	2026-05-02 09:33:29.491	2026-05-02 09:37:33.64	{理财目标规划,风险偏好评估,资产配置,合规披露,需求分析}
9519d83c-fb69-4f0c-b066-939cfe4ceeb3	a37cb4dc-2fce-4b18-9c04-381bb1d514cb	[{"id": "8c8b6312-039d-41a4-8afe-e56b5f3d5392", "mood": "NEUTRAL", "role": "ai", "text": "你好，我是王女士。我听朋友说可以来这里做理财咨询，我有一些积蓄想做些投资，但不太懂金融产品。", "timestamp": "2026-05-07T01:34:49.424Z"}, {"id": "398981bd-c9c0-4c8c-85c3-0d605645ce77", "role": "student", "text": "您好，我想了解一下您的理财目标和孩子教育金的规划", "timestamp": "2026-05-07T01:35:02.860Z"}, {"id": "b5923faa-9a63-4712-a3e1-8c1127d6a90d", "mood": "HAPPY", "role": "ai", "text": "我主要想为孩子的教育金做准备，他三年后要出国留学。我对投资比较保守，之前只买过银行理财产品，希望找到风险较低、稳定的方式。", "moodScore": 0.1, "timestamp": "2026-05-07T01:35:35.774Z"}, {"id": "777302fe-0d89-46d4-82e0-6a34b6eb9e2b", "role": "student", "text": "明白了。结合您的保守偏好和3年时间窗口，我建议60%中低风险债基+30%货币基金+10%教育金保险。您觉得这个比例怎么样？", "timestamp": "2026-05-07T01:38:51.839Z"}, {"id": "ab5cde58-d870-4111-9558-55ae3be3d086", "mood": "NEUTRAL", "role": "ai", "text": "我理解您的建议，但债基的风险我有些担心，它比银行理财产品风险高吗？另外，教育金保险的回报和流动性如何？", "moodScore": 0.3, "timestamp": "2026-05-07T01:39:14.936Z"}]	{"sections": [{"items": [{"label": "银行存款/货币基金", "value": 0}, {"label": "债券/债券基金", "value": 0}, {"label": "混合基金", "value": 0}, {"label": "股票/股票基金", "value": 0}, {"label": "保险产品", "value": 0}], "label": "资产配置方案"}], "snapshots": []}	{"feedback": "理财经理在需求分析和风险评估方面表现较好，了解了客户的理财目标和风险偏好，并推荐了合理的资产配置方案。但在沟通技巧和合规意识上存在不足，未充分回应客户疑问和披露风险。整体方案符合客户保守偏好和3年时间窗口，但需加强风险解释和客户互动。", "maxScore": 100, "totalScore": 56, "conceptTags": ["资产配置", "风险偏好", "教育金规划", "债券基金", "货币基金"], "latePenalty": {"rate": 0.2, "label": "迟交扣分 20%", "applied": true, "adjustedScore": 56, "originalScore": 70, "penaltyAmount": 14}, "rubricBreakdown": [{"score": 15, "comment": "理财经理了解了客户的理财目标（为孩子教育金，3年后出国）和风险偏好（保守），如客户说'我主要想为孩子的教育金做准备，他三年后要出国留学。我对投资比较保守'。但未主动询问具体财务状况如存款、收入、支出，需求分析不够全面，仅基于对话推断。", "maxScore": 25, "criterionId": "f07d5da9-45f0-4cd1-a9d4-5986a41d2199"}, {"score": 18, "comment": "理财经理合理评估了客户的风险承受能力，基于客户'投资比较保守'的表述，在建议中体现了中低风险产品，如'结合您的保守偏好和3年时间窗口'。评估准确，符合客户风险偏好。", "maxScore": 20, "criterionId": "fb85d6b6-f94f-4090-96ee-a9850b30ed10"}, {"score": 22, "comment": "推荐的60%中低风险债基+30%货币基金+10%教育金保险方案合理、多样化，考虑了3年时间窗口和保守偏好，产品组合覆盖了债券、货币和保险，符合教育金规划需求。", "maxScore": 25, "criterionId": "08fdc14a-ed13-4ec6-b043-4733f1ab7bdc"}, {"score": 10, "comment": "沟通基本专业，但不够耐心和通俗易懂。理财经理直接给出建议，但客户提出疑问'债基的风险我有些担心'时，对话结束，未进一步解释或互动，沟通技巧有待提升。", "maxScore": 15, "criterionId": "bde82dfc-156e-4f1b-8cd8-c851fbf7218d"}, {"score": 5, "comment": "合规意识不足，未充分披露风险。客户询问'债基的风险我有些担心，它比银行理财产品风险高吗？'和'教育金保险的回报和流动性如何？'，但理财经理未回应，缺乏风险披露和合规解释。", "maxScore": 15, "criterionId": "c9fd514f-381b-44b3-b2bc-db87d20ed5fd"}]}	2026-05-07 01:39:18.39	2026-05-07 01:39:42.418	{资产配置,风险偏好,教育金规划,债券基金,货币基金}
\.


--
-- Data for Name: StudentGroup; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StudentGroup" (id, "teacherId", "classId", name, type, meta, "createdAt", "updatedAt") FROM stdin;
bb89b285-82ca-4f46-952e-c8a4a964494e	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	deedd844-e302-4b20-903d-d9b1d0e12439	[QA-V2-202604300250] 三学生诊断组	manual	\N	2026-04-30 02:50:06.138	2026-04-30 02:50:06.138
fa57f9b9-a37b-465b-8f39-cd825e8e5662	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	deedd844-e302-4b20-903d-d9b1d0e12439	加强组	manual	\N	2026-05-02 07:40:31.708	2026-05-02 07:40:31.708
\.


--
-- Data for Name: StudentGroupMember; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StudentGroupMember" (id, "groupId", "studentId", "createdAt") FROM stdin;
7226340f-6f52-4d34-8462-da66a7d12a94	bb89b285-82ca-4f46-952e-c8a4a964494e	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	2026-04-30 02:50:06.138
f599f459-f4b6-431b-b50e-fedd2f45414d	bb89b285-82ca-4f46-952e-c8a4a964494e	eb623313-3cc8-4da2-ac8f-0a1d5cd656bb	2026-04-30 02:50:06.138
34d1b38d-a7a5-4d8d-8f67-b6d858116ce2	bb89b285-82ca-4f46-952e-c8a4a964494e	d6be46c1-1c04-46a7-a3ae-b493d25d4414	2026-04-30 02:50:06.138
7b01f163-835c-42de-abbd-fa104a2b780e	fa57f9b9-a37b-465b-8f39-cd825e8e5662	62235d2c-a740-4db0-93e7-e28251354cba	2026-05-02 07:40:41.736
b505b52b-43b5-4205-a610-192bae297f60	fa57f9b9-a37b-465b-8f39-cd825e8e5662	236c3795-f19f-4107-a681-0bc0e1d21d62	2026-05-02 07:40:41.736
52ad9d84-028f-4033-9b7f-80d96b436b31	fa57f9b9-a37b-465b-8f39-cd825e8e5662	edad1bc2-43ae-4598-8e12-1053ef4eb964	2026-05-02 07:40:41.736
\.


--
-- Data for Name: StudyBuddyPost; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StudyBuddyPost" (id, "studentId", "taskId", "taskInstanceId", title, question, mode, anonymous, status, "aiReply", "replyGeneratedAt", messages, "createdAt", "updatedAt", "isPreview") FROM stdin;
88e9eaf7-a25c-4d66-870e-801eb301e6f7	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	50194450-47c2-4cee-b2fa-2aa6b634fb5f	\N	深度	问题	socratic	t	error	\N	\N	[{"role": "student", "content": "问题", "createdAt": "2026-02-21T13:49:58.735Z"}]	2026-02-21 13:49:58.737	2026-02-21 13:50:01.015	f
8470d927-a31f-46c6-9d86-f381f6976693	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	50194450-47c2-4cee-b2fa-2aa6b634fb5f	\N	123	123	socratic	f	error	\N	\N	[{"role": "student", "content": "123", "createdAt": "2026-02-21T14:05:00.920Z"}]	2026-02-21 14:05:00.928	2026-02-21 14:05:38.553	f
0560d6a9-b2a8-4302-8f11-2e398d18dbe4	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	50194450-47c2-4cee-b2fa-2aa6b634fb5f	da3724bf-cdb5-43c4-b8a4-2849ac97f191	11	11	socratic	f	error	\N	\N	[{"role": "student", "content": "11", "createdAt": "2026-02-22T10:28:13.358Z"}]	2026-02-22 10:28:13.359	2026-02-22 10:28:14.79	f
db24db36-518c-4d18-96e1-12f7c4c3af17	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	50194450-47c2-4cee-b2fa-2aa6b634fb5f	e34afdc0-dc06-4072-aa5c-d1b945de0850	1	1	socratic	f	error	\N	\N	[{"role": "student", "content": "1", "createdAt": "2026-02-22T11:04:26.561Z"}]	2026-02-22 11:04:26.563	2026-02-22 11:04:28.383	f
4c122ff3-5f2c-4264-92d5-09ba7e8c92b9	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	50194450-47c2-4cee-b2fa-2aa6b634fb5f	e34afdc0-dc06-4072-aa5c-d1b945de0850	1	1	socratic	f	answered	您好！很高兴能与您一起探讨理财咨询的相关内容。在我们开始之前，我想先了解一些关于您的情况：您是否有过投资或理财的经验？您对风险的承受能力如何？这些信息可以帮助我们更好地进行接下来的模拟练习。	2026-02-22 11:11:33.951	[{"role": "student", "content": "1", "createdAt": "2026-02-22T11:11:31.086Z"}, {"role": "ai", "content": "您好！很高兴能与您一起探讨理财咨询的相关内容。在我们开始之前，我想先了解一些关于您的情况：您是否有过投资或理财的经验？您对风险的承受能力如何？这些信息可以帮助我们更好地进行接下来的模拟练习。", "createdAt": "2026-02-22T11:11:33.951Z"}]	2026-02-22 11:11:31.088	2026-02-22 11:11:33.954	f
c233c73b-ffb9-4e37-8a1c-6063ce617d64	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	50194450-47c2-4cee-b2fa-2aa6b634fb5f	e34afdc0-dc06-4072-aa5c-d1b945de0850	1	2	direct	f	answered	好的，针对投资比较保守的客户（如中年女性客户，有子女教育需求），我们可以按照以下步骤进行理财咨询服务：\n\n---\n\n### **第一步：了解客户的基本情况和财务目标**\n1. **年龄与家庭状况**  \n   - 了解客户的年龄、是否有配偶、子女数量及年龄等。\n2. **收入与支出情况**  \n   - 了解客户的月收入、固定支出（如房贷、生活费等）以及可支配资金。\n3. **风险承受能力**  \n   - 客户为保守型投资者，偏好低风险产品，如银行存款、国债、货币基金等。\n4. **理财目标**  \n   - 明确客户的主要理财目标，例如：\n     - 子女教育费用准备（如大学学费）；\n     - 短期或长期的资金需求；\n     - 是否有退休规划等。\n\n---\n\n### **第二步：分析客户的风险偏好与投资目标**\n- 保守型投资者通常不希望本金遭受损失，更看重资金的安全性和稳定性。\n- 根据客户的需求，可以建议以下方向：\n  - 稳健型理财产品（如银行理财产品、债券基金、货币基金等）；\n  - 教育储蓄计划（如教育金保险、教育储蓄账户等）；\n  - 资产配置建议，以分散风险并满足不同时间段的资金需求。\n\n---\n\n### **第三步：制定适合保守型投资者的理财方案**\n根据客户情况，可以提出如下建议：\n\n#### 1. **短期资金管理（如1-3年）**\n- 建议使用**货币市场基金**、**银行活期/定期存款**或**国债逆回购**。\n- 优点：流动性强、风险低、收益略高于普通存款。\n\n#### 2. **中期资金管理（如3-5年）**\n- 推荐**稳健型理财产品**或**债券基金**。\n- 优点：收益略高于存款，风险可控。\n\n#### 3. **长期资金管理（如5年以上）**\n- 可考虑**教育金保险**、**养老年金保险**等。\n- 优点：保障性强，兼顾收益与安全性，适合子女教育储备。\n\n#### 4. **资产配置建议**\n- 避免将全部资金投入高风险产品，建议采用“金字塔”式配置：\n  - 50%以上配置在低风险产品（如银行存款、货币基金）；\n  - 30%-40%配置在中等风险产品（如债券基金、稳健型理财产品）；\n  - 10%-20%配置在中高风险产品（如指数基金、混合型基金），视客户接受程度而定。\n\n---\n\n### **第四步：提供具体产品推荐（根据客户需求）**\n根据客户的具体情况，可以推荐以下产品：\n\n| 产品类型       | 特点                           | 适合客户群体         |\n|----------------|--------------------------------|----------------------|\n| 银行存款       | 安全、灵活、收益稳定           | 保守型客户、短期需求 |\n| 货币基金       | 流动性强、收益略高于存款       | 短期资金管理         |\n| 国债           | 政府担保、风险极低             | 中短期资金管理       |\n| 教育金保险     | 保障性+收益性结合              | 有子女教育需求       |\n| 稳健型理财产品 | 收益略高、风险可控             | 中长期资金管理       |\n\n---\n\n### **第五步：持续跟踪与调整**\n- 建议客户定期（如每季度或半年）回顾投资组合的表现；\n- 根据市场变化和客户自身情况，及时调整投资策略；\n- 提供必要的金融知识普及，增强客户的风险意识和理财能力。\n\n---\n\n如果需要，我可以进一步模拟具体的对话场景，帮助您理解如何向客户解释这些理财建议。是否需要继续？	2026-02-22 11:12:26.65	[{"role": "student", "content": "2", "createdAt": "2026-02-22T11:11:50.661Z"}, {"role": "ai", "content": "您好！请问您具体需要帮助的是什么？您可以告诉我您的问题或需要模拟的理财咨询场景，我会以清晰、分步骤的方式为您解答。", "createdAt": "2026-02-22T11:11:52.596Z"}, {"role": "student", "content": "投资比较保守的客户如何服务", "createdAt": "2026-02-22T11:12:13.654Z"}, {"role": "ai", "content": "好的，针对投资比较保守的客户（如中年女性客户，有子女教育需求），我们可以按照以下步骤进行理财咨询服务：\\n\\n---\\n\\n### **第一步：了解客户的基本情况和财务目标**\\n1. **年龄与家庭状况**  \\n   - 了解客户的年龄、是否有配偶、子女数量及年龄等。\\n2. **收入与支出情况**  \\n   - 了解客户的月收入、固定支出（如房贷、生活费等）以及可支配资金。\\n3. **风险承受能力**  \\n   - 客户为保守型投资者，偏好低风险产品，如银行存款、国债、货币基金等。\\n4. **理财目标**  \\n   - 明确客户的主要理财目标，例如：\\n     - 子女教育费用准备（如大学学费）；\\n     - 短期或长期的资金需求；\\n     - 是否有退休规划等。\\n\\n---\\n\\n### **第二步：分析客户的风险偏好与投资目标**\\n- 保守型投资者通常不希望本金遭受损失，更看重资金的安全性和稳定性。\\n- 根据客户的需求，可以建议以下方向：\\n  - 稳健型理财产品（如银行理财产品、债券基金、货币基金等）；\\n  - 教育储蓄计划（如教育金保险、教育储蓄账户等）；\\n  - 资产配置建议，以分散风险并满足不同时间段的资金需求。\\n\\n---\\n\\n### **第三步：制定适合保守型投资者的理财方案**\\n根据客户情况，可以提出如下建议：\\n\\n#### 1. **短期资金管理（如1-3年）**\\n- 建议使用**货币市场基金**、**银行活期/定期存款**或**国债逆回购**。\\n- 优点：流动性强、风险低、收益略高于普通存款。\\n\\n#### 2. **中期资金管理（如3-5年）**\\n- 推荐**稳健型理财产品**或**债券基金**。\\n- 优点：收益略高于存款，风险可控。\\n\\n#### 3. **长期资金管理（如5年以上）**\\n- 可考虑**教育金保险**、**养老年金保险**等。\\n- 优点：保障性强，兼顾收益与安全性，适合子女教育储备。\\n\\n#### 4. **资产配置建议**\\n- 避免将全部资金投入高风险产品，建议采用“金字塔”式配置：\\n  - 50%以上配置在低风险产品（如银行存款、货币基金）；\\n  - 30%-40%配置在中等风险产品（如债券基金、稳健型理财产品）；\\n  - 10%-20%配置在中高风险产品（如指数基金、混合型基金），视客户接受程度而定。\\n\\n---\\n\\n### **第四步：提供具体产品推荐（根据客户需求）**\\n根据客户的具体情况，可以推荐以下产品：\\n\\n| 产品类型       | 特点                           | 适合客户群体         |\\n|----------------|--------------------------------|----------------------|\\n| 银行存款       | 安全、灵活、收益稳定           | 保守型客户、短期需求 |\\n| 货币基金       | 流动性强、收益略高于存款       | 短期资金管理         |\\n| 国债           | 政府担保、风险极低             | 中短期资金管理       |\\n| 教育金保险     | 保障性+收益性结合              | 有子女教育需求       |\\n| 稳健型理财产品 | 收益略高、风险可控             | 中长期资金管理       |\\n\\n---\\n\\n### **第五步：持续跟踪与调整**\\n- 建议客户定期（如每季度或半年）回顾投资组合的表现；\\n- 根据市场变化和客户自身情况，及时调整投资策略；\\n- 提供必要的金融知识普及，增强客户的风险意识和理财能力。\\n\\n---\\n\\n如果需要，我可以进一步模拟具体的对话场景，帮助您理解如何向客户解释这些理财建议。是否需要继续？", "createdAt": "2026-02-22T11:12:26.650Z"}]	2026-02-22 11:11:50.662	2026-02-22 11:12:26.654	f
4f32f334-802c-430b-a8b5-7b50c56cb739	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	50194450-47c2-4cee-b2fa-2aa6b634fb5f	da3724bf-cdb5-43c4-b8a4-2849ac97f191	nihao 	Nihau	socratic	f	answered	你好！很高兴你开始参与这个理财咨询模拟。  \n在我们继续之前，我想先问问：  \n1. 你觉得这位中年女性客户最迫切的财务目标可能是什么？  \n2. 考虑到她是保守型投资者，你认为哪些投资工具可能适合她？	2026-04-13 14:40:02.213	[{"role": "student", "content": "Nihau", "createdAt": "2026-04-13T14:39:59.283Z"}, {"role": "ai", "content": "你好！很高兴你开始参与这个理财咨询模拟。  \\n在我们继续之前，我想先问问：  \\n1. 你觉得这位中年女性客户最迫切的财务目标可能是什么？  \\n2. 考虑到她是保守型投资者，你认为哪些投资工具可能适合她？", "createdAt": "2026-04-13T14:40:02.213Z"}]	2026-04-13 14:39:59.286	2026-04-13 14:40:02.216	f
597c73f3-16a2-4372-af89-bfa15e3f82af	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	50194450-47c2-4cee-b2fa-2aa6b634fb5f	e34afdc0-dc06-4072-aa5c-d1b945de0850	保守客户如何服务	保守客户如何服务	socratic	t	answered	您提到对基金类产品不了解，这是很正常的。那么，您认为理财顾问在面对这样的客户时，是否需要先让她了解一些基础知识，而不是直接推荐产品？如果要让她了解基础，您觉得应该从哪些方面开始？比如风险、收益、流动性，还是其他方面？	2026-02-22 11:14:01.26	[{"role": "student", "content": "保守客户如何服务", "createdAt": "2026-02-22T11:13:13.624Z"}, {"role": "ai", "content": "在服务一位保守型投资偏好的中年女性客户时，我们首先需要了解她的核心需求和风险承受能力。您认为，作为理财顾问，我们应该从哪些方面入手来建立信任并满足她的财务目标呢？", "createdAt": "2026-02-22T11:13:16.096Z"}, {"role": "student", "content": "如何回答：好的，庄经理，您建议的这种组合听起来比较稳健，但我还是有点担心风险。毕竟100万不是小数目，我之前只买过银行理财，对基金类产品了解不多，您能详细说说每种产品的特点和可能的风险吗？", "createdAt": "2026-02-22T11:13:36.036Z"}, {"role": "ai", "content": "您提到担心风险，同时也表达了对基金类产品了解不多的顾虑。那么，您认为在这种情况下，理财顾问应该如何回应才能既缓解客户的担忧，又能让她更好地理解产品呢？是否需要通过一些方式来帮助她建立对产品的信心？", "createdAt": "2026-02-22T11:13:38.318Z"}, {"role": "student", "content": "我不太了解，你觉得呢", "createdAt": "2026-02-22T11:13:59.051Z"}, {"role": "ai", "content": "您提到对基金类产品不了解，这是很正常的。那么，您认为理财顾问在面对这样的客户时，是否需要先让她了解一些基础知识，而不是直接推荐产品？如果要让她了解基础，您觉得应该从哪些方面开始？比如风险、收益、流动性，还是其他方面？", "createdAt": "2026-02-22T11:14:01.259Z"}]	2026-02-22 11:13:13.625	2026-02-22 11:14:01.261	f
d6bffcf9-88c2-4e08-86d8-e6b4005492cc	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	50194450-47c2-4cee-b2fa-2aa6b634fb5f	e34afdc0-dc06-4072-aa5c-d1b945de0850	nihao	nihao	socratic	f	answered	你好！你提到的边际税率确实是个关键概念。我很高兴你关注到这一点。\n\n在回应你的问题之前，我想先确认一下：你是否已经理解了什么是边际税率？比如，它和平均税率有什么不同？\n\n另外，在我们这个中年女性客户的理财咨询场景中，你觉得了解她的边际税率会对哪方面的建议有帮助？比如税务规划、投资选择，还是退休安排？	2026-04-27 01:30:26.881	[{"role": "student", "content": "nihao", "createdAt": "2026-02-25T00:56:54.264Z"}, {"role": "ai", "content": "你好！很高兴见到你。  \\n在开始之前，我想先问问：你对这次理财咨询模拟有什么初步的想法吗？  \\n或者，你觉得这位中年女性客户最关心的理财目标可能是什么？", "createdAt": "2026-02-25T00:56:57.165Z"}, {"role": "student", "content": "PR-STU-2 测试: 我想问一下边际税率的实际计算方式", "createdAt": "2026-04-27T01:30:22.802Z"}, {"role": "ai", "content": "你好！你提到的边际税率确实是个关键概念。我很高兴你关注到这一点。\\n\\n在回应你的问题之前，我想先确认一下：你是否已经理解了什么是边际税率？比如，它和平均税率有什么不同？\\n\\n另外，在我们这个中年女性客户的理财咨询场景中，你觉得了解她的边际税率会对哪方面的建议有帮助？比如税务规划、投资选择，还是退休安排？", "createdAt": "2026-04-27T01:30:26.881Z"}]	2026-02-25 00:56:54.265	2026-04-27 01:30:26.883	f
43c82f44-aba5-47ca-bfc5-ba0529850dc4	236c3795-f19f-4107-a681-0bc0e1d21d62	50194450-47c2-4cee-b2fa-2aa6b634fb5f	2e700d5e-fa7e-4f13-b000-03f660414b89	测试	这个题目具体讲什么 同时告诉我你用什么回答	direct	f	answered	这个题目是关于理财咨询的模拟练习，具体要求你扮演理财顾问，为一位具有特定背景和需求的客户提供理财建议。模拟的目标是让你练习如何根据客户的具体情况，制定符合其风险偏好和财务目标的理财方案。\n\n这个题目的具体内容包括以下几个方面：\n1. 客户背景：这是一位中年女性客户。\n2. 投资偏好：她的风险承受能力较低，属于保守型投资者。\n3. 核心需求：她有一个明确的财务目标，即为子女的教育进行资金准备。\n\n为了回答这个问题，我将采用以下步骤为你进行讲解和模拟：\n1. 第一步，分析客户画像。我会根据题目给定的中年女性、保守型偏好等信息，梳理她可能的风险承受能力、家庭责任和财务状况特点。\n2. 第二步，确立理财目标。我会明确将“子女教育金准备”作为核心目标来规划。\n3. 第三步，制定资产配置建议。基于保守型偏好，我会重点考虑如何配置低风险产品（如存款、国债、低风险银行理财等）来达成教育金目标，并解释其中的风险控制逻辑。\n4. 第四步，进行沟通话术示范。我会模拟如何向这位客户清晰、耐心地解释方案，确保她能理解并做出决策。\n5. 整个回答会直接围绕这个模拟任务展开，不会涉及其他无关的金融话题，以帮助你掌握针对特定客户类型进行理财咨询的方法。	2026-04-30 06:28:45.436	[{"role": "student", "content": "这个题目具体讲什么 同时告诉我你用什么回答", "createdAt": "2026-04-30T06:28:29.116Z"}, {"role": "ai", "content": "这个题目是关于理财咨询的模拟练习，具体要求你扮演理财顾问，为一位具有特定背景和需求的客户提供理财建议。模拟的目标是让你练习如何根据客户的具体情况，制定符合其风险偏好和财务目标的理财方案。\\n\\n这个题目的具体内容包括以下几个方面：\\n1. 客户背景：这是一位中年女性客户。\\n2. 投资偏好：她的风险承受能力较低，属于保守型投资者。\\n3. 核心需求：她有一个明确的财务目标，即为子女的教育进行资金准备。\\n\\n为了回答这个问题，我将采用以下步骤为你进行讲解和模拟：\\n1. 第一步，分析客户画像。我会根据题目给定的中年女性、保守型偏好等信息，梳理她可能的风险承受能力、家庭责任和财务状况特点。\\n2. 第二步，确立理财目标。我会明确将“子女教育金准备”作为核心目标来规划。\\n3. 第三步，制定资产配置建议。基于保守型偏好，我会重点考虑如何配置低风险产品（如存款、国债、低风险银行理财等）来达成教育金目标，并解释其中的风险控制逻辑。\\n4. 第四步，进行沟通话术示范。我会模拟如何向这位客户清晰、耐心地解释方案，确保她能理解并做出决策。\\n5. 整个回答会直接围绕这个模拟任务展开，不会涉及其他无关的金融话题，以帮助你掌握针对特定客户类型进行理财咨询的方法。", "createdAt": "2026-04-30T06:28:45.436Z"}]	2026-04-30 06:28:29.119	2026-04-30 06:28:45.439	f
0f0ec308-cc05-4c1a-8e10-eb08181912c9	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	50194450-47c2-4cee-b2fa-2aa6b634fb5f	2e700d5e-fa7e-4f13-b000-03f660414b89	预览测试问题	这节课应该怎么理解风险承受能力？	socratic	f	answered	你提出了一个很关键的问题！风险承受能力确实是理财规划中的核心概念之一。\n\n首先，你能想到“风险承受能力”可能和客户的年龄、收入或家庭状况有关吗？  \n其次，在我们这个模拟场景中，客户是一位中年女性，投资偏好保守，还有子女教育的需求——你觉得这些信息会怎样影响她的风险承受能力呢？	2026-05-02 14:07:18.249	[{"role": "student", "content": "这节课应该怎么理解风险承受能力？", "createdAt": "2026-05-02T14:07:13.104Z"}, {"role": "ai", "content": "你提出了一个很关键的问题！风险承受能力确实是理财规划中的核心概念之一。\\n\\n首先，你能想到“风险承受能力”可能和客户的年龄、收入或家庭状况有关吗？  \\n其次，在我们这个模拟场景中，客户是一位中年女性，投资偏好保守，还有子女教育的需求——你觉得这些信息会怎样影响她的风险承受能力呢？", "createdAt": "2026-05-02T14:07:18.249Z", "contextSources": []}]	2026-05-02 14:07:13.106	2026-05-02 14:07:18.251	t
\.


--
-- Data for Name: StudyBuddySummary; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StudyBuddySummary" (id, "taskId", "generatedAt", "topQuestions", "knowledgeGaps", "createdAt") FROM stdin;
\.


--
-- Data for Name: SubjectiveConfig; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SubjectiveConfig" (id, "taskId", prompt, "allowTextAnswer", "allowedAttachmentTypes", "referenceAnswer", "evaluatorPersona", "strictnessLevel", "createdAt", "updatedAt") FROM stdin;
f7be3fb8-9fa0-4303-89d8-7e63e4633348	aff902a3-a669-4181-91ea-613519b9f4d2	假设你是一名刚入职的理财顾问，你的第一个客户是一位30岁的IT工程师，年薪40万，单身，风险承受能力中等偏高。请为他设计一份投资组合方案，并写一篇分析报告。报告需要包含：1）客户画像分析；2）投资目标设定；3）具体产品推荐和配置比例；4）风险提示。	t	{pdf,docx,xlsx}	优秀答案应包含：全面的客户画像（年龄、收入、风险偏好）、明确的投资目标（短中长期）、多元化的产品推荐（含配置比例和理由）、详细的风险提示和应对策略。	你是一位严谨的金融教育评审，关注分析深度和实操性。	MODERATE	2026-02-21 09:55:53.306	2026-02-21 09:55:53.306
1a563bac-6805-4460-a122-a249efe75b89	ca705f3a-e604-47a8-8e28-e12f6bf0d9ad	假设你是一名刚入职的理财顾问，你的第一个客户是一位30岁的IT工程师，年薪40万，单身，风险承受能力中等偏高。请为他设计一份投资组合方案，并写一篇分析报告。报告需要包含：1）客户画像分析；2）投资目标设定；3）具体产品推荐和配置比例；4）风险提示。	t	{pdf,docx,xlsx}	优秀答案应包含：全面的客户画像（年龄、收入、风险偏好）、明确的投资目标（短中长期）、多元化的产品推荐（含配置比例和理由）、详细的风险提示和应对策略。	你是一位严谨的金融教育评审，关注分析深度和实操性。	MODERATE	2026-04-22 06:54:51.512	2026-04-22 06:54:51.512
3dba2a62-e942-40cd-a8c6-af1b66434e9a	cd4bb0e4-edbf-4191-bf5e-7d2eb5ac392d	假设你是一名刚入职的理财顾问，你的第一个客户是一位30岁的IT工程师，年薪40万，单身，风险承受能力中等偏高。请为他设计一份投资组合方案，并写一篇分析报告。报告需要包含：1）客户画像分析；2）投资目标设定；3）具体产品推荐和配置比例；4）风险提示。	t	{pdf,docx,xlsx}	优秀答案应包含：全面的客户画像（年龄、收入、风险偏好）、明确的投资目标（短中长期）、多元化的产品推荐（含配置比例和理由）、详细的风险提示和应对策略。	你是一位严谨的金融教育评审，关注分析深度和实操性。	MODERATE	2026-04-29 11:40:04.512	2026-04-29 11:40:04.512
3cebc2c0-c9e8-49a7-a92d-47796b15a74e	00000000-0000-4000-8000-00000000a503	用不超过 300 字解释一份稳健型资产配置方案。	t	{}	\N	\N	MODERATE	2026-04-29 11:40:04.56	2026-04-29 11:40:04.56
46c1ae75-a99b-454d-9ac9-a035e332338b	d8097130-8847-4a51-aa30-dffa6345f59c	根据给定家庭月收入和支出，写出预算优化建议。	t	{}	\N	\N	MODERATE	2026-04-30 02:50:06.236	2026-04-30 02:50:06.236
\.


--
-- Data for Name: SubjectiveSubmission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SubjectiveSubmission" (id, "submissionId", "textAnswer", "extractedText", evaluation, "createdAt", "updatedAt", "conceptTags") FROM stdin;
e8eeccce-75e4-4874-b2aa-185f77a039ce	205d9ffd-b8ab-444c-aa6e-e59c96713206	家庭预算应先区分固定支出、弹性支出和储蓄目标。固定支出如房租、交通和餐费要保证，弹性支出如娱乐、网购可以设上限。建议先预留3到6个月必要生活费作为应急金，再把每月结余按储蓄、学习提升和稳健理财分配。短期有大额支出时，不应为了高收益压缩现金流。	\N	{"feedback": "学生正确识别了固定支出、弹性支出和结余的概念，并给出了具体的预算优化建议，如设上限、预留应急金和分配结余，语言适合中高职学生理解。但建议未基于具体的收入和支出数据，缺乏个性化应用，因此在收支识别和可执行性上扣分。", "maxScore": 100, "totalScore": 75, "rubricBreakdown": [{"score": 30, "comment": "学生识别了固定支出（如房租、交通、餐费）、弹性支出（如娱乐、网购）和结余（通过储蓄目标和应急金），并举例说明，但未应用给定的具体家庭月收入和支出数据，因此扣分。", "maxScore": 40, "criterionId": "83e07f7e-5295-4f1c-afcb-6ce974ec6183"}, {"score": 45, "comment": "建议具体且可执行，如设上限、预留3-6个月应急金、分配结余用于储蓄、学习和理财，并避免压缩现金流，适合中高职学生理解。但建议是通用的，未基于具体数据进行个性化优化。", "maxScore": 60, "criterionId": "65723ff6-df90-4214-ad5e-758c04c22a81"}]}	2026-04-30 07:07:53.105	2026-04-30 07:08:19.979	{预算规划,应急基金,资产配置,现金流管理}
d899a472-0def-44d8-9968-8d713b4e0d8e	00000000-0000-4000-8000-00000000a706	配置方案理由不足。	\N	{"feedback": "配置理由需要补充数据依据"}	2026-04-29 11:40:04.603	2026-04-29 11:40:04.603	{}
05827fe5-7cc4-46ef-8e66-2745fbd02624	f819d49d-5740-4219-898d-5ac834300948	减少消费，尽量多存钱。	\N	{"feedback": "能提出预算调整，但需更量化。", "rubricBreakdown": [{"score": 28, "comment": "收支识别 基本达标", "maxScore": 40, "criterionId": "83e07f7e-5295-4f1c-afcb-6ce974ec6183"}, {"score": 34, "comment": "建议可执行性 基本达标", "maxScore": 60, "criterionId": "65723ff6-df90-4214-ad5e-758c04c22a81"}]}	2026-04-30 02:50:06.274	2026-04-30 02:50:06.274	{预算管理,现金流管理}
e443f76e-5055-49f4-bb81-11753795249c	0b84b6c1-61f2-4651-9a2a-d36fda0e8dd5	减少消费，尽量多存钱。	\N	{"feedback": "建议过于笼统，可执行性不足。", "rubricBreakdown": [{"score": 20, "comment": "收支识别 维度较弱", "maxScore": 40, "criterionId": "83e07f7e-5295-4f1c-afcb-6ce974ec6183"}, {"score": 28, "comment": "建议可执行性 维度较弱", "maxScore": 60, "criterionId": "65723ff6-df90-4214-ad5e-758c04c22a81"}]}	2026-04-30 02:50:06.279	2026-04-30 02:50:06.279	{预算管理,现金流管理}
2a162b93-37ef-4810-803c-024d979e81e5	899deebd-fb2f-42d2-8c78-05883e61294a	投资组合分析报告：基于客户王女士的财务状况(45岁、月收入2万、月支出1万、100万存款、3年后子女留学需求)，建议采用稳健配置策略：保守60万(定存20+债基30+保险10)，中性30万配置混合基金，进攻10万配置股票基金。风险评估为中低，需避免高波动产品。	\N	{"feedback": "严重偏离题目要求。题目明确指定客户为'30 岁 IT 工程师、年薪 40 万、单身、中高风险'，但作答完全套用了另一套客户模板（45 岁王女士、子女留学等）。虽然具备基本的报告结构和资产配置逻辑，但因核心前提错误，方案无法得分。需严格审题，针对指定客户画像进行分析。", "maxScore": 100, "totalScore": 20, "latePenalty": {"rate": 0.2, "label": "迟交扣分 20%", "applied": false, "adjustedScore": 20, "originalScore": 20, "penaltyAmount": 0}, "rubricBreakdown": [{"score": 0, "comment": "客户画像完全错误。未分析题目指定的 30 岁 IT 工程师，而是分析了无关的 45 岁王女士，得 0 分。", "maxScore": 20, "criterionId": "98ed65bc-e1f0-4717-b85c-a451491f15c5"}, {"score": 5, "comment": "配置方案虽有具体比例（60/30/10），但基于错误的风险偏好（中低 vs 题目要求中高），缺乏针对性，仅给结构分。", "maxScore": 30, "criterionId": "873adfe5-cf20-4eb4-bea0-291417db672f"}, {"score": 5, "comment": "风险提示过于简略，仅一句话，且未针对题目要求的'中高风险'承受能力进行匹配分析。", "maxScore": 25, "criterionId": "e54ea65b-50cd-4dd4-a541-fc79dcfb1f7f"}, {"score": 10, "comment": "语言表达清晰，结构基本完整，但篇幅过短，不符合'分析报告'的深度要求。", "maxScore": 15, "criterionId": "2d0d4800-3cff-435a-bf21-333b79024c11"}, {"score": 0, "comment": "无创新见解，套用通用模板且未适配题目场景。", "maxScore": 10, "criterionId": "f4c3ec6a-7149-4806-b93c-06b93d73dd61"}]}	2026-05-02 09:38:54.899	2026-05-02 09:40:18.121	{客户画像,资产配置,风险偏好,投资组合}
d0faf16f-514a-4621-8174-930704e4ba5b	17045c66-06a3-4d1f-866d-4dfe0cab7a51	客户是一位30岁IT工程师，收入稳定且风险承受能力中等偏高，投资目标应以长期增值和流动性安全并重。建议保留6个月生活费作为货币基金或活期理财，剩余资金按60%指数基金和权益基金、25%债券基金、10%银行理财、5%现金进行配置。权益部分用于长期增长，债券和现金降低波动。需要提醒客户市场波动、集中持仓、流动性和职业收入风险，并每半年复盘一次配置。	\N	{"feedback": "方案核心逻辑正确，资产配置比例符合中等偏高风险偏好，且能识别 IT 行业特有的职业收入风险，值得肯定。主要扣分点在于报告结构缺失，未按要求分章节阐述，投资目标设定不够具体（缺乏短中长期量化目标），文字表达略显单薄。建议后续练习中注重报告格式规范及目标的具体化。", "maxScore": 100, "totalScore": 73, "latePenalty": {"rate": 0.2, "label": "迟交扣分 20%", "applied": false, "adjustedScore": 73, "originalScore": 73, "penaltyAmount": 0}, "rubricBreakdown": [{"score": 15, "comment": "涵盖了年龄、职业、风险偏好等基本信息，但对财务状况的分析较浅，未详细推算可投资资金规模。", "maxScore": 20, "criterionId": "1708f564-1dab-4046-b808-18c025aed39c"}, {"score": 22, "comment": "配置比例合理且具操作性，但投资目标设定不够明确，缺乏短中长期具体目标的区分。", "maxScore": 30, "criterionId": "fc8609a6-0e71-4b27-81ae-fdde3a87953b"}, {"score": 20, "comment": "风险识别较全面，特别是提到了职业收入风险，但应对策略略显单一，仅提到复盘。", "maxScore": 25, "criterionId": "7bfe100e-512f-4437-8582-6c23b0695782"}, {"score": 10, "comment": "语言通顺逻辑清晰，但未按照报告格式分点陈述，结构完整性不足。", "maxScore": 15, "criterionId": "3daf1bff-6194-4bd6-8e5a-8c766165f91a"}, {"score": 6, "comment": "配置方案较为常规，结合职业特点的风险提示有一定亮点，但整体创新性一般。", "maxScore": 10, "criterionId": "fa4b274a-6eb3-4ad4-90d8-20bba8fda930"}]}	2026-05-01 05:17:40.964	2026-05-02 09:45:01.493	{资产配置,风险偏好,流动性管理,职业风险,投资目标}
ab22daf1-324c-43df-bc5e-8336b6bd751a	fe5271f2-a596-432d-8be5-7365da2508d9	先保留紧急备用金，再压缩非必要支出。	\N	{"feedback": "能提出预算调整，但需更量化。", "rubricBreakdown": [{"score": 36, "comment": "收支识别 基本达标", "maxScore": 40, "criterionId": "83e07f7e-5295-4f1c-afcb-6ce974ec6183"}, {"score": 50, "comment": "建议可执行性 基本达标", "maxScore": 60, "criterionId": "65723ff6-df90-4214-ad5e-758c04c22a81"}]}	2026-04-30 02:50:06.261	2026-04-30 02:50:06.261	{预算管理,现金流管理}
\.


--
-- Data for Name: Submission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Submission" (id, "studentId", "taskId", "taskType", status, score, "maxScore", "taskInstanceId", "submittedAt", "gradedAt", "createdAt", "updatedAt", "releasedAt") FROM stdin;
f819d49d-5740-4219-898d-5ac834300948	eb623313-3cc8-4da2-ac8f-0a1d5cd656bb	d8097130-8847-4a51-aa30-dffa6345f59c	subjective	graded	62.00	100.00	57c9940b-4d55-4760-9697-2d88d1c40933	2026-04-30 01:18:06.158	2026-04-30 01:38:06.158	2026-04-30 02:50:06.274	2026-04-30 02:50:06.274	2026-04-30 01:43:06.158
0b84b6c1-61f2-4651-9a2a-d36fda0e8dd5	d6be46c1-1c04-46a7-a3ae-b493d25d4414	d8097130-8847-4a51-aa30-dffa6345f59c	subjective	graded	48.00	100.00	57c9940b-4d55-4760-9697-2d88d1c40933	2026-04-30 01:26:06.158	2026-04-30 01:46:06.158	2026-04-30 02:50:06.279	2026-04-30 02:50:06.279	2026-04-30 01:51:06.158
16ed122e-75da-4390-86c0-6c1668f5dccd	eb623313-3cc8-4da2-ac8f-0a1d5cd656bb	5e69a393-3175-4cef-a92a-c44612593f4d	simulation	graded	58.00	100.00	c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11	2026-04-30 01:58:06.158	2026-04-30 02:13:06.158	2026-04-30 02:50:06.338	2026-04-30 02:50:06.338	2026-04-30 02:18:06.158
fac13b95-5a52-41cc-a6c5-91dd95944eac	d6be46c1-1c04-46a7-a3ae-b493d25d4414	5e69a393-3175-4cef-a92a-c44612593f4d	simulation	graded	42.00	100.00	c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11	2026-04-30 02:06:06.158	2026-04-30 02:21:06.158	2026-04-30 02:50:06.347	2026-04-30 02:50:06.347	2026-04-30 02:26:06.158
ce37c24e-86b6-4b03-815e-fc71eed84a9a	236c3795-f19f-4107-a681-0bc0e1d21d62	f5532d66-c556-463d-bdf3-e50b5e4b8e90	quiz	graded	60.00	70.00	483fbaf6-60d2-4444-a5fe-da03536b1215	2026-04-30 06:41:33.827	2026-04-30 06:42:30.544	2026-04-30 06:41:33.827	2026-04-30 06:42:30.546	\N
00000000-0000-4000-8000-00000000a701	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	00000000-0000-4000-8000-00000000a501	quiz	graded	15.00	20.00	00000000-0000-4000-8000-00000000a601	2026-04-20 08:00:00	2026-04-20 09:00:00	2026-04-29 11:40:04.566	2026-04-29 11:40:04.566	\N
00000000-0000-4000-8000-00000000a702	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	00000000-0000-4000-8000-00000000a501	quiz	submitted	\N	\N	00000000-0000-4000-8000-00000000a601	2026-04-21 08:00:00	\N	2026-04-29 11:40:04.589	2026-04-29 11:40:04.589	\N
00000000-0000-4000-8000-00000000a703	eb623313-3cc8-4da2-ac8f-0a1d5cd656bb	00000000-0000-4000-8000-00000000a501	quiz	graded	60.00	100.00	00000000-0000-4000-8000-00000000a601	2026-04-20 08:10:00	2026-04-20 09:10:00	2026-04-29 11:40:04.59	2026-04-29 11:40:04.59	\N
00000000-0000-4000-8000-00000000a704	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	00000000-0000-4000-8000-00000000a502	simulation	graded	55.00	100.00	00000000-0000-4000-8000-00000000a602	2026-04-22 08:00:00	2026-04-22 09:00:00	2026-04-29 11:40:04.593	2026-04-29 11:40:04.593	\N
00000000-0000-4000-8000-00000000a705	d6be46c1-1c04-46a7-a3ae-b493d25d4414	00000000-0000-4000-8000-00000000a502	simulation	submitted	\N	\N	00000000-0000-4000-8000-00000000a602	2026-04-22 08:30:00	\N	2026-04-29 11:40:04.6	2026-04-29 11:40:04.6	\N
00000000-0000-4000-8000-00000000a706	54b6889f-a70b-4f3d-937a-8124c49baa80	00000000-0000-4000-8000-00000000a503	subjective	graded	17.00	30.00	00000000-0000-4000-8000-00000000a603	2026-04-23 08:00:00	2026-04-23 09:00:00	2026-04-29 11:40:04.601	2026-04-29 11:40:04.601	\N
00000000-0000-4000-8000-00000000b701	98c66e4b-c71e-4ca5-bacd-8825d8c3c21b	00000000-0000-4000-8000-00000000b501	quiz	graded	90.00	100.00	00000000-0000-4000-8000-00000000b601	2026-04-24 08:00:00	2026-04-24 09:00:00	2026-04-29 11:40:04.609	2026-04-29 11:40:04.609	\N
7f11c15d-34f7-4edf-963d-c6fc0f81bd33	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	f6ae7ba0-ae3b-4143-ba33-e81e2481b7d7	quiz	graded	90.00	100.00	b7ca71ef-7239-4844-b0bd-29e1b444be61	2026-04-30 00:20:06.158	2026-04-30 00:50:06.158	2026-04-30 02:50:06.195	2026-04-30 02:50:06.195	2026-04-30 01:00:06.158
a48c3799-9656-4b7b-91dc-5d1e4e527be6	eb623313-3cc8-4da2-ac8f-0a1d5cd656bb	f6ae7ba0-ae3b-4143-ba33-e81e2481b7d7	quiz	graded	55.00	100.00	b7ca71ef-7239-4844-b0bd-29e1b444be61	2026-04-30 00:28:06.158	2026-04-30 00:58:06.158	2026-04-30 02:50:06.224	2026-04-30 02:50:06.224	2026-04-30 01:08:06.158
d4f2f5f8-0db4-49db-9860-6967a85d172e	d6be46c1-1c04-46a7-a3ae-b493d25d4414	f6ae7ba0-ae3b-4143-ba33-e81e2481b7d7	quiz	graded	35.00	100.00	b7ca71ef-7239-4844-b0bd-29e1b444be61	2026-04-30 00:36:06.158	2026-04-30 01:06:06.158	2026-04-30 02:50:06.229	2026-04-30 02:50:06.229	2026-04-30 01:16:06.158
4145932c-a4a8-4d3d-9916-83c3a973fd0c	236c3795-f19f-4107-a681-0bc0e1d21d62	5e69a393-3175-4cef-a92a-c44612593f4d	simulation	graded	100.00	100.00	c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11	2026-04-30 06:54:56.05	2026-04-30 06:55:28.404	2026-04-30 06:54:56.05	2026-04-30 06:55:28.409	\N
205d9ffd-b8ab-444c-aa6e-e59c96713206	236c3795-f19f-4107-a681-0bc0e1d21d62	d8097130-8847-4a51-aa30-dffa6345f59c	subjective	graded	75.00	100.00	57c9940b-4d55-4760-9697-2d88d1c40933	2026-04-30 07:07:53.094	2026-04-30 07:08:19.968	2026-04-30 07:07:53.094	2026-04-30 07:08:19.972	\N
899deebd-fb2f-42d2-8c78-05883e61294a	32575dd0-e927-408b-ba9f-7f003bfd60d6	cd4bb0e4-edbf-4191-bf5e-7d2eb5ac392d	subjective	graded	20.00	100.00	d8099300-e7ff-4aac-8505-b3533a82fd39	2026-05-02 09:38:54.894	2026-05-02 09:40:18.115	2026-05-02 09:38:54.894	2026-05-02 09:40:18.116	\N
32b9381c-8b6c-44cd-93ce-1d18b1049020	edad1bc2-43ae-4598-8e12-1053ef4eb964	77999372-a6e0-4a49-8a01-5e978d08bdb6	simulation	graded	25.00	100.00	f1494008-e987-4576-b5e5-4a304d0ec822	2026-05-02 09:33:29.477	2026-05-02 09:37:33.63	2026-05-02 09:33:29.477	2026-05-02 09:41:13.678	2026-05-02 09:41:13.677
17045c66-06a3-4d1f-866d-4dfe0cab7a51	236c3795-f19f-4107-a681-0bc0e1d21d62	ca705f3a-e604-47a8-8e28-e12f6bf0d9ad	subjective	graded	73.00	100.00	a5d8f119-e3cd-426f-8ea9-e57f77608ffe	2026-05-01 05:17:40.926	2026-05-02 09:45:01.488	2026-05-01 05:17:40.926	2026-05-02 09:45:01.489	\N
ce7f935d-5ed0-4af0-9aeb-53a527de372c	236c3795-f19f-4107-a681-0bc0e1d21d62	3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9	quiz	graded	0.00	24.00	449ae28c-8913-43f5-adda-dc296885071b	2026-05-02 09:45:12.823	2026-05-02 09:46:15.747	2026-05-02 09:45:12.823	2026-05-02 09:46:15.748	\N
4a3f639d-ab10-4d2c-bd74-9ac0f7cf5c4e	236c3795-f19f-4107-a681-0bc0e1d21d62	f6ae7ba0-ae3b-4143-ba33-e81e2481b7d7	quiz	graded	0.00	100.00	b7ca71ef-7239-4844-b0bd-29e1b444be61	2026-05-02 09:58:18.454	2026-05-02 10:04:16.429	2026-05-02 09:58:18.454	2026-05-02 10:05:36.772	2026-05-02 10:05:36.771
a37cb4dc-2fce-4b18-9c04-381bb1d514cb	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	50194450-47c2-4cee-b2fa-2aa6b634fb5f	simulation	graded	56.00	100.00	e34afdc0-dc06-4072-aa5c-d1b945de0850	2026-05-07 01:39:18.374	2026-05-07 01:39:42.409	2026-05-07 01:39:18.374	2026-05-07 01:39:42.41	\N
1e4bcf48-c6a3-4c43-a333-0fa2b556916b	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	5e69a393-3175-4cef-a92a-c44612593f4d	simulation	graded	88.00	100.00	c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11	2026-04-30 01:50:06.158	2026-04-30 02:05:06.158	2026-04-30 02:50:06.324	2026-04-30 02:50:06.324	2026-04-30 02:10:06.158
fe5271f2-a596-432d-8be5-7365da2508d9	dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	d8097130-8847-4a51-aa30-dffa6345f59c	subjective	graded	86.00	100.00	57c9940b-4d55-4760-9697-2d88d1c40933	2026-04-30 01:10:06.158	2026-04-30 01:30:06.158	2026-04-30 02:50:06.261	2026-04-30 02:50:06.261	2026-04-30 01:35:06.158
\.


--
-- Data for Name: Task; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Task" (id, "taskType", "taskName", requirements, visibility, "practiceEnabled", "creatorId", "courseName", "chapterName", "createdAt", "updatedAt") FROM stdin;
50194450-47c2-4cee-b2fa-2aa6b634fb5f	simulation	客户理财咨询模拟	1. 了解客户的财务状况\n2. 评估客户的风险承受能力\n3. 推荐合适的理财产品\n4. 解释投资风险	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-02-21 09:55:53.279	2026-02-21 09:55:53.279
6018c58c-06ce-4a2f-9f0e-df366aca5f28	quiz	理财基础知识测验	\N	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-02-21 09:55:53.296	2026-02-21 09:55:53.296
aff902a3-a669-4181-91ea-613519b9f4d2	subjective	个人投资组合分析报告	1. 分析至少3种不同类型的金融产品\n2. 说明选择理由和风险评估\n3. 给出具体的配置比例建议	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-02-21 09:55:53.306	2026-02-21 09:55:53.306
d7ffa2a5-1351-4d2f-9693-b1e9c02fdf04	quiz	测验1	\N	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-02-22 10:21:30.257	2026-02-22 10:21:30.257
a308c7ba-2713-4c2d-9441-c92927e3f9f4	simulation	客户理财咨询模拟	1. 了解客户的财务状况\n2. 评估客户的风险承受能力\n3. 推荐合适的理财产品\n4. 解释投资风险	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-04-22 06:54:51.498	2026-04-22 06:54:51.498
29b6fa45-3937-4cc4-8ee8-56366bad7eda	quiz	理财基础知识测验	\N	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-04-22 06:54:51.507	2026-04-22 06:54:51.507
ca705f3a-e604-47a8-8e28-e12f6bf0d9ad	subjective	个人投资组合分析报告	1. 分析至少3种不同类型的金融产品\n2. 说明选择理由和风险评估\n3. 给出具体的配置比例建议	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-04-22 06:54:51.512	2026-04-22 06:54:51.512
00000000-0000-0000-0000-000000000b04	quiz	B4 独立测验	\N	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-04-22 06:57:49.694	2026-04-22 06:57:49.694
e07a8ba8-6ee1-4d57-836b-a4847296f376	quiz	PDF导入测验	\N	private	f	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	\N	\N	2026-04-26 14:02:32.575	2026-04-26 14:02:32.575
e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53	quiz	深度测试	\N	private	f	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	\N	\N	2026-04-27 12:56:16.131	2026-04-27 12:56:16.131
77999372-a6e0-4a49-8a01-5e978d08bdb6	simulation	客户理财咨询模拟	1. 了解客户的财务状况\n2. 评估客户的风险承受能力\n3. 推荐合适的理财产品\n4. 解释投资风险	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-04-29 11:40:04.487	2026-04-29 11:40:04.487
f5532d66-c556-463d-bdf3-e50b5e4b8e90	quiz	理财基础知识测验	\N	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-04-29 11:40:04.501	2026-04-29 11:40:04.501
cd4bb0e4-edbf-4191-bf5e-7d2eb5ac392d	subjective	个人投资组合分析报告	1. 分析至少3种不同类型的金融产品\n2. 说明选择理由和风险评估\n3. 给出具体的配置比例建议	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-04-29 11:40:04.512	2026-04-29 11:40:04.512
00000000-0000-4000-8000-00000000a501	quiz	ANL-2 复利测验	\N	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-04-29 11:40:04.553	2026-04-29 11:40:04.553
00000000-0000-4000-8000-00000000a502	simulation	ANL-2 客户风险评估模拟	\N	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-04-29 11:40:04.555	2026-04-29 11:40:04.555
00000000-0000-4000-8000-00000000a503	subjective	ANL-2 资产配置简答	\N	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-04-29 11:40:04.555	2026-04-29 11:40:04.555
00000000-0000-4000-8000-00000000b501	quiz	ANL-2 B 班独立测验	\N	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	\N	\N	2026-04-29 11:40:04.556	2026-04-29 11:40:04.556
f6ae7ba0-ae3b-4143-ba33-e81e2481b7d7	quiz	[QA-V2-202604300250] 风险收益基础测验	用于验证 analytics-v2 题库诊断与弱点标签。	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	个人理财规划	理财基础概念	2026-04-30 02:50:06.159	2026-04-30 02:50:06.159
d8097130-8847-4a51-aa30-dffa6345f59c	subjective	[QA-V2-202604300250] 家庭预算分析报告	用于验证 analytics-v2 主观题 rubric 诊断。	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	个人理财规划	理财基础概念	2026-04-30 02:50:06.236	2026-04-30 02:50:06.236
5e69a393-3175-4cef-a92a-c44612593f4d	simulation	[QA-V2-202604300250] 客户风险沟通模拟	用于验证 analytics-v2 模拟对话 rubric 诊断。	private	f	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	个人理财规划	理财基础概念	2026-04-30 02:50:06.289	2026-04-30 02:50:06.289
3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9	quiz	个人理财基础概念测验	本测验旨在评估学生对个人理财基本概念的理解，包括定义、重要性和核心要素，适合中高职课堂使用。	private	f	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	\N	\N	2026-04-30 08:52:12.738	2026-04-30 08:52:12.738
\.


--
-- Data for Name: TaskBuildDraft; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TaskBuildDraft" (id, "courseId", "chapterId", "sectionId", slot, "taskType", title, description, status, progress, "sourceIds", "missingFields", "draftPayload", error, "createdBy", "createdAt", "updatedAt", "asyncJobId") FROM stdin;
f46ad4bd-d4cd-4300-9be6-c573e750cda5	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	65053639-55f2-44bd-9f44-65a6d7d60bb3	pre	quiz	test	\N	ready	100	{a67de771-1a52-40dd-9e88-234eba4245be}	{任务描述,答案与选项}	{"form": {"dueAt": "", "prompt": "", "quizMode": "fixed", "scenario": "", "taskName": "test", "taskType": "quiz", "questions": [{"stem": "【待确认】稳定投资,避免频繁操作.基金定投是长期的理财规划,是一项有纪律的投资,不是短期进出获利的工具.\\n\\n22,在个人理财规划中,单身期稳健型投资者的核心目标是什么?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": ",追求高收益,承担高风险"}, {"id": "B", "text": ",平衡收益与风险,注重资金安全"}, {"id": "C", "text": ",完全规避风险,只投资储蓄产品"}, {"id": "D", "text": ",以短期投机为主,不考虑长期规划 23,以下关于基金的说法,哪一项是错误的?"}, {"id": "A", "text": ",基金由专业基金经理进行管理"}, {"id": "B", "text": ",基金投资门槛普遍较低,适合普通投资者"}, {"id": "C", "text": ",基金收益一定高于银行存款利率"}, {"id": "D", "text": ",基金种类繁多,可满足不同投资者的需求 24,如果一个投资者想通过购买基金来实现每月固定收益,最适合选择哪种基金?"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}], "wordLimit": "", "showResult": false, "simPersona": "你是一个普通人，对理财知识了解不多，但愿意学习和听取专业建议。\\n你有自己的顾虑和偏好，但你不是一个\\"油盐不进\\"的人。当理财经理给出合理解释时，你会逐渐理解和接受。\\n你会主动提出与对话目标相关的问题，推动对话朝有意义的方向发展。", "description": "", "openingLine": "", "totalPoints": 100, "requirements": [""], "maxAttachments": "3", "simConstraints": "不要暴露你是 AI 或模拟角色。\\n不要重复理财经理刚说过的话。\\n不要无端制造对抗或拒绝所有建议。", "allowAttachment": false, "scoringCriteria": [{"name": "", "maxPoints": 10, "description": ""}], "shuffleQuestions": false, "simDialogueStyle": "用中文回复，语气自然，像真实客户聊天一样。不要使用 Markdown 符号或列表格式。\\n每条回复 2-4 句话。可以分享自己的想法、提出疑问、或回应理财经理的建议。\\n当理财经理解释得好时，表示认可并追问更深入的问题。\\n当理财经理说得不清楚时，礼貌地请求进一步解释，而不是直接拒绝。\\n不要一味表达不信任或完全拒绝风险。你是来寻求帮助的，不是来刁难人的。", "timeLimitMinutes": "", "allocationSections": [{"items": [{"label": "", "defaultValue": 0}], "label": ""}]}, "context": {"slot": "pre", "chapterTitle": "理财基础概念", "sectionTitle": "财务目标设定"}, "teacherBrief": "", "draftSourceLabel": "题库导入：个人理财-题库.pdf。通过结构化解析直接识别 1 题（共扫到 3 个题块）。 AI 未能调用（AI 返回格式不完整），但已通过结构化解析直接导入 1 题。", "selectedSourceIds": ["a67de771-1a52-40dd-9e88-234eba4245be"], "questionBankReview": {"action": "import", "issues": [], "summary": "通过结构化解析直接识别 1 题（共扫到 3 个题块）。 AI 未能调用（AI 返回格式不完整），但已通过结构化解析直接导入 1 题。", "updatedAt": "2026-05-05T09:51:34.554Z", "suggestions": [], "sourceSummary": [{"id": "a67de771-1a52-40dd-9e88-234eba4245be", "fileName": "个人理财-题库.pdf", "conceptTags": ["稳健型投资者", "保守型投资者", "基金类型与特点", "资产配置", "投资风险控制"]}]}}	\N	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-05 03:46:59.085	2026-05-05 09:51:34.567	7100a8fb-4cd4-4437-9968-38912dfc00c5
e96eda2b-3de5-441d-a3eb-a775489701d1	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	65053639-55f2-44bd-9f44-65a6d7d60bb3	pre	quiz	PDF 导入任务测试	\N	draft	100	{a67de771-1a52-40dd-9e88-234eba4245be}	{任务描述}	{"form": {"dueAt": "", "prompt": "", "quizMode": "fixed", "scenario": "", "taskName": "PDF 导入任务测试", "taskType": "quiz", "questions": [{"stem": "【待确认】稳定投资,避免频繁操作.基金定投是长期的理财规划,是一项有纪律的投资,不是短期进出获利的工具.\\n\\n22,在个人理财规划中,单身期稳健型投资者的核心目标是什么?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": ",追求高收益,承担高风险"}, {"id": "B", "text": ",平衡收益与风险,注重资金安全"}, {"id": "C", "text": ",完全规避风险,只投资储蓄产品"}, {"id": "D", "text": ",以短期投机为主,不考虑长期规划 23,以下关于基金的说法,哪一项是错误的?"}, {"id": "A", "text": ",基金由专业基金经理进行管理"}, {"id": "B", "text": ",基金投资门槛普遍较低,适合普通投资者"}, {"id": "C", "text": ",基金收益一定高于银行存款利率"}, {"id": "D", "text": ",基金种类繁多,可满足不同投资者的需求 24,如果一个投资者想通过购买基金来实现每月固定收益,最适合选择哪种基金?"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}], "wordLimit": "", "showResult": false, "simPersona": "你是一个普通人，对理财知识了解不多，但愿意学习和听取专业建议。\\n你有自己的顾虑和偏好，但你不是一个\\"油盐不进\\"的人。当理财经理给出合理解释时，你会逐渐理解和接受。\\n你会主动提出与对话目标相关的问题，推动对话朝有意义的方向发展。", "description": "", "openingLine": "", "totalPoints": 100, "requirements": [""], "maxAttachments": "3", "simConstraints": "不要暴露你是 AI 或模拟角色。\\n不要重复理财经理刚说过的话。\\n不要无端制造对抗或拒绝所有建议。", "allowAttachment": false, "scoringCriteria": [{"name": "", "maxPoints": 10, "description": ""}], "shuffleQuestions": false, "simDialogueStyle": "用中文回复，语气自然，像真实客户聊天一样。不要使用 Markdown 符号或列表格式。\\n每条回复 2-4 句话。可以分享自己的想法、提出疑问、或回应理财经理的建议。\\n当理财经理解释得好时，表示认可并追问更深入的问题。\\n当理财经理说得不清楚时，礼貌地请求进一步解释，而不是直接拒绝。\\n不要一味表达不信任或完全拒绝风险。你是来寻求帮助的，不是来刁难人的。", "timeLimitMinutes": "", "allocationSections": [{"items": [{"label": "", "defaultValue": 0}], "label": ""}]}, "context": {"slot": "pre", "chapterTitle": "理财基础概念", "sectionTitle": "财务目标设定"}, "teacherBrief": "", "draftSourceLabel": "素材质检与优化：个人理财-题库.pdf。检查了个人理财规划题库，发现解析缺失、题型分布与描述不符、一道题答案疑似错误以及导入数据混乱等问题。", "selectedSourceIds": ["a67de771-1a52-40dd-9e88-234eba4245be"], "questionBankReview": {"action": "import", "issues": [{"message": "大多数题目缺少解析，只有简答题21提供了答案。建议为所有题目补充解析以增强学习效果。", "severity": "warning", "sourceRef": "素材第1-30题", "questionIndex": 0}, {"message": "题型分布与描述不符：素材摘要描述题型包括判断题、单选题、多选题和简答题，但实际题目29和30是填空题。", "severity": "warning", "sourceRef": "第5页，题目29-30", "questionIndex": 28}, {"message": "答案疑似错误：题目11，保守型投资者最适合基金定投，但保守型投资者风险承受能力低，基金定投涉及市场风险，可能更适合货币基金或定期存款。建议核实答案。", "severity": "warning", "sourceRef": "第2页，题目11", "questionIndex": 10}, {"message": "当前题目导入混乱：在‘当前题目’部分，题干包含无关文本‘稳定投资,避免频繁操作.基金定投是长期的理财规划,是一项有纪律的投资,不是短期进出获利的工具.’，可能从简答题21的答案中误入。建议检查导入数据。", "severity": "info", "sourceRef": "当前题目部分", "questionIndex": 0}], "summary": "素材质检与优化：个人理财-题库.pdf。检查了个人理财规划题库，发现解析缺失、题型分布与描述不符、一道题答案疑似错误以及导入数据混乱等问题。", "updatedAt": "2026-05-05T10:29:49.019Z", "suggestions": [], "sourceSummary": []}}	\N	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-05-05 10:23:28.412	2026-05-05 10:29:49.135	42bcaadb-4d8e-4d79-a92a-957d79448411
b11de978-d1ab-4dd0-860b-94ffc868d341	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	65053639-55f2-44bd-9f44-65a6d7d60bb3	pre	quiz	PDF导入测试-S2-1856	QA agent S2 PDF import test	ready	100	{a67de771-1a52-40dd-9e88-234eba4245be}	{答案与选项}	{"form": {"dueAt": "", "prompt": "", "quizMode": "fixed", "scenario": "", "taskName": "PDF导入测试-S2-1856", "taskType": "quiz", "questions": [{"stem": "【待确认】稳健型投资者在进行资产配置时，主要配置高波动性的金融产品。", "type": "true_false", "points": 1, "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}, {"stem": "【待确认】下列哪种金融工具最适合稳健型投资者?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": "期货合约"}, {"id": "B", "text": "货币市场基金"}, {"id": "C", "text": "期权交易"}, {"id": "D", "text": "创业投资基金"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}, {"stem": "【待确认】以下哪个选项不是稳健型投资者常见的投资渠道?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": "定期存款"}, {"id": "B", "text": "债券基金"}, {"id": "C", "text": "股票型基金"}, {"id": "D", "text": "银行理财产品"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["C"]}, {"stem": "【待确认】关于稳健型投资目标，以下说法错误的是?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": "注重长期资本增值"}, {"id": "B", "text": "追求资金的绝对安全"}, {"id": "C", "text": "允许较高的短期波动"}, {"id": "D", "text": "希望获得稳定的现金流"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["C"]}, {"stem": "【待确认】稳健型投资者可以将大部分资金投入到高收益的P2P平台。", "type": "true_false", "points": 1, "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}, {"stem": "【待确认】稳健型投资者不需要关注宏观经济变化。", "type": "true_false", "points": 1, "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}, {"stem": "【待确认】稳健型投资者在选择基金时，首要考虑的因素是?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": "历史收益"}, {"id": "B", "text": "基金经理的名气"}, {"id": "C", "text": "风险水平"}, {"id": "D", "text": "基金规模"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["C"]}, {"stem": "【待确认】下列哪种投资方式最适合稳健型投资者的资产配置?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": "全部投资于股票"}, {"id": "B", "text": "70%债券+30%股票"}, {"id": "C", "text": "全部投资于房地产"}, {"id": "D", "text": "60%股票+40%现金"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}, {"stem": "【待确认】稳健型投资者的投资目标可以随时改变，无需考虑原有计划。", "type": "true_false", "points": 1, "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}, {"stem": "【待确认】稳健型投资者应尽量避免任何投资风险。", "type": "true_false", "points": 1, "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}, {"stem": "【待确认】下列哪种投资方式最适合保守型投资者?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": "股票投资"}, {"id": "B", "text": "基金定投"}, {"id": "C", "text": "期货交易"}, {"id": "D", "text": "创业投资"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}, {"stem": "【待确认】保守型投资者在资产配置中，应避免哪些行为?", "type": "multiple_choice", "points": 1, "options": [{"id": "A", "text": "高杠杆投资"}, {"id": "B", "text": "分散投资"}, {"id": "C", "text": "频繁交易"}, {"id": "D", "text": "集中投资于低风险资产"}, {"id": "E", "text": "盲目追求高收益"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["A", "C", "E"]}, {"stem": "【待确认】保守型理财只适合年轻人，不适合中年人。", "type": "true_false", "points": 1, "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}, {"stem": "【待确认】关于基金投资，下列说法错误的是?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": "基金可以帮助投资者实现分散投资"}, {"id": "B", "text": "基金由专业经理人进行管理"}, {"id": "C", "text": "基金只适合高净值人群"}, {"id": "D", "text": "基金投资可以降低个体投资者的操作成本"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["C"]}, {"stem": "【待确认】基金的费用率通常由哪些组成?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": "管理费、托管费和销售服务费"}, {"id": "B", "text": "利息和手续费"}, {"id": "C", "text": "分红率和赎回费"}, {"id": "D", "text": "交易费和印花税"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["A"]}, {"stem": "【待确认】以下哪种基金允许投资者随时申购和赎回?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": "封闭式基金"}, {"id": "B", "text": "开放式基金"}, {"id": "C", "text": "ETF"}, {"id": "D", "text": "LOF"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}, {"stem": "【待确认】基金投资的优势包括以下哪些?", "type": "multiple_choice", "points": 1, "options": [{"id": "A", "text": "投资门槛低"}, {"id": "B", "text": "专业管理"}, {"id": "C", "text": "分散风险"}, {"id": "D", "text": "收益确定"}, {"id": "E", "text": "流动性高"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["A", "B", "C", "E"]}, {"stem": "【待确认】关于基金的赎回规则，下列说法正确的是?", "type": "multiple_choice", "points": 1, "options": [{"id": "A", "text": "开放式基金可随时赎回"}, {"id": "B", "text": "封闭式基金不可赎回"}, {"id": "C", "text": "赎回时可能收取一定费用"}, {"id": "D", "text": "赎回不影响基金运作"}, {"id": "E", "text": "赎回后资金立即到账"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["A", "B", "C", "D"]}, {"stem": "【待确认】基金的费用率越高，说明基金表现越好。", "type": "true_false", "points": 1, "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}, {"stem": "【待确认】封闭式基金的份额可以在交易所买卖。", "type": "true_false", "points": 1, "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["A"]}, {"stem": "【待确认】请简述基金理财的风险控制。(简答题)", "type": "short_answer", "points": 1, "options": [], "explanation": "导入提示：解析待确认", "correctAnswer": "(1)选择适合自己的基金类型。就长期统计平均而言，在同等条件下，股票基金的收益较高，风险也较高，混合基金次之，债券基金再次之，货币市场基金的收益和风险最低。投资人应根据自身的风险偏好来挑选适合投资的基金类型。\\n\\n(2)对自身财务状况进行长远规划。成熟市场的数据显示，基金的投资周期越长，亏损的可能性越小，基金定投投资超过十年的，亏损的几率接近于零。投资人还应根据自己的收入水平、投资理财规划和生活开支来合理安排基金定投比例，达到家庭资产增值目的。\\n\\n(3)稳定投资，避免频繁操作。基金定投是长期的理财规划，是一项有纪律的投资，不是短期进出获利的工具。", "correctOptionIds": []}, {"stem": "【待确认】在个人理财规划中，单身期稳健型投资者的核心目标是什么?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": "追求高收益，承担高风险"}, {"id": "B", "text": "平衡收益与风险，注重资金安全"}, {"id": "C", "text": "完全规避风险，只投资储蓄产品"}, {"id": "D", "text": "以短期投机为主，不考虑长期规划"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}, {"stem": "【待确认】以下关于基金的说法，哪一项是错误的?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": "基金由专业基金经理进行管理"}, {"id": "B", "text": "基金投资门槛普遍较低，适合普通投资者"}, {"id": "C", "text": "基金收益一定高于银行存款利率"}, {"id": "D", "text": "基金种类繁多，可满足不同投资者的需求"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["C"]}, {"stem": "【待确认】如果一个投资者想通过购买基金来实现每月固定收益，最适合选择哪种基金?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": "股票型基金"}, {"id": "B", "text": "货币市场基金"}, {"id": "C", "text": "QDII基金"}, {"id": "D", "text": "REITs基金"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["B"]}, {"stem": "【待确认】下列哪项不属于基金信息披露的主要内容?", "type": "single_choice", "points": 1, "options": [{"id": "A", "text": "基金净值"}, {"id": "B", "text": "基金经理变动"}, {"id": "C", "text": "基金公司的办公地址"}, {"id": "D", "text": "持仓比例变化"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["C"]}, {"stem": "【待确认】以下哪些是基金投资的特点?", "type": "multiple_choice", "points": 1, "options": [{"id": "A", "text": "由专业经理人管理"}, {"id": "B", "text": "投资门槛高，适合富裕人群"}, {"id": "C", "text": "投资分散，降低单一风险"}, {"id": "D", "text": "流动性差，无法随时赎回"}, {"id": "E", "text": "具有一定的收益预期但不保本"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["A", "C", "E"]}, {"stem": "【待确认】关于稳健型投资组合的构建，以下说法正确的是?", "type": "multiple_choice", "points": 1, "options": [{"id": "A", "text": "应避免配置高波动率资产"}, {"id": "B", "text": "应尽量减少债券比例以提高收益"}, {"id": "C", "text": "需要考虑现金流需求"}, {"id": "D", "text": "应以股票为主导资产"}, {"id": "E", "text": "应注重资产配置的多样化"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["A", "C", "E"]}, {"stem": "【待确认】以下哪些是基金风险的主要来源?", "type": "multiple_choice", "points": 1, "options": [{"id": "A", "text": "市场波动风险"}, {"id": "B", "text": "信用风险"}, {"id": "C", "text": "流动性风险"}, {"id": "D", "text": "汇率风险"}, {"id": "E", "text": "基金公司办公地点太远"}], "explanation": "导入提示：解析待确认", "correctAnswer": "", "correctOptionIds": ["A", "B", "C", "D"]}, {"stem": "【待确认】一只基金的资产配置比例为:股票30%，债券60%，现金10%，这种配置体现了____型投资理念，其主要目的是为了在收益与____之间取得平衡。", "type": "short_answer", "points": 1, "options": [], "explanation": "导入提示：解析待确认", "correctAnswer": "稳健\\n\\n风险", "correctOptionIds": []}, {"stem": "【待确认】稳健型投资者通常会采用____策略，在投资过程中重视长期规划，同时根据自身风险承受能力调整资产配置，以确保资金的安全性和____。", "type": "short_answer", "points": 1, "options": [], "explanation": "导入提示：解析待确认", "correctAnswer": "分散投资；稳定性；", "correctOptionIds": []}], "wordLimit": "", "showResult": false, "simPersona": "你是一个普通人，对理财知识了解不多，但愿意学习和听取专业建议。\\n你有自己的顾虑和偏好，但你不是一个\\"油盐不进\\"的人。当理财经理给出合理解释时，你会逐渐理解和接受。\\n你会主动提出与对话目标相关的问题，推动对话朝有意义的方向发展。", "description": "QA agent S2 PDF import test", "openingLine": "", "totalPoints": 100, "requirements": [""], "maxAttachments": "3", "simConstraints": "不要暴露你是 AI 或模拟角色。\\n不要重复理财经理刚说过的话。\\n不要无端制造对抗或拒绝所有建议。", "allowAttachment": false, "scoringCriteria": [{"name": "", "maxPoints": 10, "description": ""}], "shuffleQuestions": false, "simDialogueStyle": "用中文回复，语气自然，像真实客户聊天一样。不要使用 Markdown 符号或列表格式。\\n每条回复 2-4 句话。可以分享自己的想法、提出疑问、或回应理财经理的建议。\\n当理财经理解释得好时，表示认可并追问更深入的问题。\\n当理财经理说得不清楚时，礼貌地请求进一步解释，而不是直接拒绝。\\n不要一味表达不信任或完全拒绝风险。你是来寻求帮助的，不是来刁难人的。", "timeLimitMinutes": "", "allocationSections": [{"items": [{"label": "", "defaultValue": 0}], "label": ""}]}, "context": {"slot": "pre", "chapterTitle": "理财基础概念", "sectionTitle": "财务目标设定"}, "teacherBrief": "", "draftSourceLabel": "题库导入：个人理财-题库.pdf。通过结构化解析直接识别 30 题（共扫到 30 个题块）。", "selectedSourceIds": ["a67de771-1a52-40dd-9e88-234eba4245be"], "questionBankReview": {"action": "import", "issues": [], "summary": "通过结构化解析直接识别 30 题（共扫到 30 个题块）。", "updatedAt": "2026-05-05T10:56:21.466Z", "suggestions": [], "sourceSummary": [{"id": "a67de771-1a52-40dd-9e88-234eba4245be", "fileName": "个人理财-题库.pdf", "conceptTags": ["稳健型投资者", "保守型投资者", "基金类型与特点", "资产配置", "投资风险控制"]}]}}	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-05-05 10:56:21.227	2026-05-05 10:56:21.502	62c4f1d2-d662-428c-93a8-1ad7182eb93d
\.


--
-- Data for Name: TaskInstance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TaskInstance" (id, title, description, "taskId", "taskType", "classId", "groupIds", "courseId", "chapterId", "sectionId", slot, "dueAt", "publishAt", "publishedAt", status, "attemptsAllowed", "taskSnapshot", "createdBy", "createdAt", "updatedAt", "autoReleaseAt", "releaseMode") FROM stdin;
e34afdc0-dc06-4072-aa5c-d1b945de0850	客户理财咨询模拟练习	模拟与保守型客户的理财咨询对话	50194450-47c2-4cee-b2fa-2aa6b634fb5f	simulation	deedd844-e302-4b20-903d-d9b1d0e12439	\N	940bbe23-6172-40bf-bc7f-b22a1840a1de	894fbab1-f4b1-4c39-a57c-c95d73577ed8	1672905c-51a7-4b5e-90c8-afcbdfd5bdd9	post	2026-03-07 09:55:53.309	\N	2026-02-21 09:55:53.309	published	3	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.31	2026-02-21 09:55:53.31	\N	manual
017f5aa6-f12f-4f48-a747-0f90cf6040a7	理财基础知识随堂测验	测试对理财基本概念的掌握程度	6018c58c-06ce-4a2f-9f0e-df366aca5f28	quiz	deedd844-e302-4b20-903d-d9b1d0e12439	\N	940bbe23-6172-40bf-bc7f-b22a1840a1de	d73bf6ea-9c1b-4d44-a190-5165917a14c2	244012b6-2ce6-4295-806f-b999b9d8660f	in	2026-02-28 09:55:53.309	\N	2026-02-21 09:55:53.314	published	2	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.315	2026-02-21 09:55:53.315	\N	manual
05504760-ad34-4b53-8b93-890b61cd24af	个人投资组合分析报告	为模拟客户设计投资方案并撰写分析报告	aff902a3-a669-4181-91ea-613519b9f4d2	subjective	deedd844-e302-4b20-903d-d9b1d0e12439	\N	940bbe23-6172-40bf-bc7f-b22a1840a1de	a44443f2-af76-4e45-b467-d6f55576e212	6599331b-6331-4344-b730-1905fedc20ba	post	2026-03-14 09:55:53.309	\N	2026-02-21 09:55:53.316	published	1	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 09:55:53.316	2026-02-21 09:55:53.316	\N	manual
2e700d5e-fa7e-4f13-b000-03f660414b89	客户理财咨询模拟	\N	50194450-47c2-4cee-b2fa-2aa6b634fb5f	simulation	deedd844-e302-4b20-903d-d9b1d0e12439	{}	940bbe23-6172-40bf-bc7f-b22a1840a1de	d73bf6ea-9c1b-4d44-a190-5165917a14c2	1ace5e74-6a79-40ca-afcf-229abfe0e1d8	pre	2026-02-21 10:35:00	\N	2026-02-21 10:35:41.108	published	\N	{"id": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "taskName": "客户理财咨询模拟", "taskType": "simulation", "createdAt": "2026-02-21T09:55:53.279Z", "creatorId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "updatedAt": "2026-02-21T09:55:53.279Z", "courseName": null, "quizConfig": null, "visibility": "private", "chapterName": null, "requirements": "1. 了解客户的财务状况\\n2. 评估客户的风险承受能力\\n3. 推荐合适的理财产品\\n4. 解释投资风险", "quizQuestions": [], "practiceEnabled": false, "scoringCriteria": [{"id": "f07d5da9-45f0-4cd1-a9d4-5986a41d2199", "name": "需求分析", "order": 0, "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "createdAt": "2026-02-21T09:55:53.279Z", "maxPoints": 25, "description": "是否充分了解客户的财务状况和理财目标"}, {"id": "fb85d6b6-f94f-4090-96ee-a9850b30ed10", "name": "风险评估", "order": 1, "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "createdAt": "2026-02-21T09:55:53.279Z", "maxPoints": 20, "description": "是否合理评估客户的风险承受能力"}, {"id": "08fdc14a-ed13-4ec6-b043-4733f1ab7bdc", "name": "方案推荐", "order": 2, "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "createdAt": "2026-02-21T09:55:53.279Z", "maxPoints": 25, "description": "推荐的理财方案是否合理、多样化"}, {"id": "bde82dfc-156e-4f1b-8cd8-c851fbf7218d", "name": "沟通技巧", "order": 3, "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "createdAt": "2026-02-21T09:55:53.279Z", "maxPoints": 15, "description": "沟通是否专业、耐心、通俗易懂"}, {"id": "c9fd514f-381b-44b3-b2bc-db87d20ed5fd", "name": "合规意识", "order": 4, "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "createdAt": "2026-02-21T09:55:53.279Z", "maxPoints": 15, "description": "是否充分披露风险、遵守合规要求"}], "simulationConfig": {"id": "af51bbab-e32a-46be-b6cb-d2ef6be3fe95", "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "scenario": "你是王女士，45岁，公司中层管理人员。你有100万存款想要理财。你的月收入2万，月支出1万。你有一个读高中的孩子，计划3年后出国留学。你对投资比较保守，之前只买过银行理财产品。", "createdAt": "2026-02-21T09:55:53.279Z", "updatedAt": "2026-02-21T09:55:53.279Z", "openingLine": "你好，我是王女士。我听朋友说可以来这里做理财咨询，我有一些积蓄想做些投资，但不太懂金融产品。", "strictnessLevel": "MODERATE", "evaluatorPersona": "你是一位资深理财教育评估专家，关注学生的沟通技巧和专业建议质量。", "studyBuddyContext": "理财咨询模拟场景：中年女性客户，保守型投资偏好，有子女教育需求。", "dialogueRequirements": null}, "subjectiveConfig": null, "allocationSections": [{"id": "04eea8a3-917f-4afc-b854-77f0ef7bdf83", "items": [{"id": "39472968-97b3-4ea6-b596-74b61a695b8e", "label": "银行存款/货币基金", "order": 0, "createdAt": "2026-02-21T09:55:53.279Z", "sectionId": "04eea8a3-917f-4afc-b854-77f0ef7bdf83"}, {"id": "7ecad371-20bb-45ed-adcf-3011775d4089", "label": "债券/债券基金", "order": 1, "createdAt": "2026-02-21T09:55:53.279Z", "sectionId": "04eea8a3-917f-4afc-b854-77f0ef7bdf83"}, {"id": "979c6948-a813-4158-a921-3e05fa0ea713", "label": "混合基金", "order": 2, "createdAt": "2026-02-21T09:55:53.279Z", "sectionId": "04eea8a3-917f-4afc-b854-77f0ef7bdf83"}, {"id": "2a9dfac8-69e5-4ca6-96fe-b50140d02089", "label": "股票/股票基金", "order": 3, "createdAt": "2026-02-21T09:55:53.279Z", "sectionId": "04eea8a3-917f-4afc-b854-77f0ef7bdf83"}, {"id": "e8a38dc9-ce49-414b-8a7a-bebbc36da6d7", "label": "保险产品", "order": 4, "createdAt": "2026-02-21T09:55:53.279Z", "sectionId": "04eea8a3-917f-4afc-b854-77f0ef7bdf83"}], "label": "资产配置方案", "order": 0, "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "createdAt": "2026-02-21T09:55:53.279Z"}]}	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 10:35:40.378	2026-02-21 10:35:41.11	\N	manual
da3724bf-cdb5-43c4-b8a4-2849ac97f191	客户理财咨询模拟	\N	50194450-47c2-4cee-b2fa-2aa6b634fb5f	simulation	deedd844-e302-4b20-903d-d9b1d0e12439	{}	940bbe23-6172-40bf-bc7f-b22a1840a1de	d73bf6ea-9c1b-4d44-a190-5165917a14c2	3e52d6bd-830c-4121-b67c-7c97766294fa	in	2026-02-28 06:32:00	\N	2026-02-21 11:24:34.492	published	\N	{"id": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "taskName": "客户理财咨询模拟", "taskType": "simulation", "createdAt": "2026-02-21T09:55:53.279Z", "creatorId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "updatedAt": "2026-02-21T09:55:53.279Z", "courseName": null, "quizConfig": null, "visibility": "private", "chapterName": null, "requirements": "1. 了解客户的财务状况\\n2. 评估客户的风险承受能力\\n3. 推荐合适的理财产品\\n4. 解释投资风险", "quizQuestions": [], "practiceEnabled": false, "scoringCriteria": [{"id": "f07d5da9-45f0-4cd1-a9d4-5986a41d2199", "name": "需求分析", "order": 0, "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "createdAt": "2026-02-21T09:55:53.279Z", "maxPoints": 25, "description": "是否充分了解客户的财务状况和理财目标"}, {"id": "fb85d6b6-f94f-4090-96ee-a9850b30ed10", "name": "风险评估", "order": 1, "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "createdAt": "2026-02-21T09:55:53.279Z", "maxPoints": 20, "description": "是否合理评估客户的风险承受能力"}, {"id": "08fdc14a-ed13-4ec6-b043-4733f1ab7bdc", "name": "方案推荐", "order": 2, "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "createdAt": "2026-02-21T09:55:53.279Z", "maxPoints": 25, "description": "推荐的理财方案是否合理、多样化"}, {"id": "bde82dfc-156e-4f1b-8cd8-c851fbf7218d", "name": "沟通技巧", "order": 3, "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "createdAt": "2026-02-21T09:55:53.279Z", "maxPoints": 15, "description": "沟通是否专业、耐心、通俗易懂"}, {"id": "c9fd514f-381b-44b3-b2bc-db87d20ed5fd", "name": "合规意识", "order": 4, "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "createdAt": "2026-02-21T09:55:53.279Z", "maxPoints": 15, "description": "是否充分披露风险、遵守合规要求"}], "simulationConfig": {"id": "af51bbab-e32a-46be-b6cb-d2ef6be3fe95", "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "scenario": "你是王女士，45岁，公司中层管理人员。你有100万存款想要理财。你的月收入2万，月支出1万。你有一个读高中的孩子，计划3年后出国留学。你对投资比较保守，之前只买过银行理财产品。", "createdAt": "2026-02-21T09:55:53.279Z", "updatedAt": "2026-02-21T09:55:53.279Z", "openingLine": "你好，我是王女士。我听朋友说可以来这里做理财咨询，我有一些积蓄想做些投资，但不太懂金融产品。", "strictnessLevel": "MODERATE", "evaluatorPersona": "你是一位资深理财教育评估专家，关注学生的沟通技巧和专业建议质量。", "studyBuddyContext": "理财咨询模拟场景：中年女性客户，保守型投资偏好，有子女教育需求。", "dialogueRequirements": null}, "subjectiveConfig": null, "allocationSections": [{"id": "04eea8a3-917f-4afc-b854-77f0ef7bdf83", "items": [{"id": "39472968-97b3-4ea6-b596-74b61a695b8e", "label": "银行存款/货币基金", "order": 0, "createdAt": "2026-02-21T09:55:53.279Z", "sectionId": "04eea8a3-917f-4afc-b854-77f0ef7bdf83"}, {"id": "7ecad371-20bb-45ed-adcf-3011775d4089", "label": "债券/债券基金", "order": 1, "createdAt": "2026-02-21T09:55:53.279Z", "sectionId": "04eea8a3-917f-4afc-b854-77f0ef7bdf83"}, {"id": "979c6948-a813-4158-a921-3e05fa0ea713", "label": "混合基金", "order": 2, "createdAt": "2026-02-21T09:55:53.279Z", "sectionId": "04eea8a3-917f-4afc-b854-77f0ef7bdf83"}, {"id": "2a9dfac8-69e5-4ca6-96fe-b50140d02089", "label": "股票/股票基金", "order": 3, "createdAt": "2026-02-21T09:55:53.279Z", "sectionId": "04eea8a3-917f-4afc-b854-77f0ef7bdf83"}, {"id": "e8a38dc9-ce49-414b-8a7a-bebbc36da6d7", "label": "保险产品", "order": 4, "createdAt": "2026-02-21T09:55:53.279Z", "sectionId": "04eea8a3-917f-4afc-b854-77f0ef7bdf83"}], "label": "资产配置方案", "order": 0, "taskId": "50194450-47c2-4cee-b2fa-2aa6b634fb5f", "createdAt": "2026-02-21T09:55:53.279Z"}]}	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-21 11:24:34.384	2026-02-22 10:15:57.105	\N	manual
2587a565-e28d-4bbb-8b39-1335473cd88c	测验1	\N	d7ffa2a5-1351-4d2f-9693-b1e9c02fdf04	quiz	deedd844-e302-4b20-903d-d9b1d0e12439	{}	940bbe23-6172-40bf-bc7f-b22a1840a1de	d73bf6ea-9c1b-4d44-a190-5165917a14c2	244012b6-2ce6-4295-806f-b999b9d8660f	post	2026-02-26 10:21:00	\N	2026-02-22 10:21:30.939	published	\N	{"id": "d7ffa2a5-1351-4d2f-9693-b1e9c02fdf04", "taskName": "测验1", "taskType": "quiz", "createdAt": "2026-02-22T10:21:30.257Z", "creatorId": "4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5", "updatedAt": "2026-02-22T10:21:30.257Z", "courseName": null, "quizConfig": null, "visibility": "private", "chapterName": null, "requirements": null, "quizQuestions": [], "practiceEnabled": false, "scoringCriteria": [], "simulationConfig": null, "subjectiveConfig": null, "allocationSections": []}	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-02-22 10:21:30.291	2026-02-22 10:21:30.94	\N	manual
f504facb-1d2b-4fcd-b04e-36182cbd88bb	客户理财咨询模拟练习	模拟与保守型客户的理财咨询对话	a308c7ba-2713-4c2d-9441-c92927e3f9f4	simulation	deedd844-e302-4b20-903d-d9b1d0e12439	\N	e6fc049c-756f-4442-86da-35a6cdbadd6e	c80664af-66db-4127-bd6a-46bb15513be1	765148b3-8a2d-42cd-93a3-46b47360f280	post	2026-05-06 06:54:51.515	\N	2026-04-22 06:54:51.515	published	3	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.515	2026-04-22 06:54:51.515	\N	manual
a5d8f119-e3cd-426f-8ea9-e57f77608ffe	个人投资组合分析报告	为模拟客户设计投资方案并撰写分析报告	ca705f3a-e604-47a8-8e28-e12f6bf0d9ad	subjective	deedd844-e302-4b20-903d-d9b1d0e12439	\N	e6fc049c-756f-4442-86da-35a6cdbadd6e	3e7e8bac-c2a8-4da8-9065-87c2d77a32bb	fa7a864c-0bd5-4bd2-8a76-293910c0a161	post	2026-05-13 06:54:51.515	\N	2026-04-22 06:54:51.518	published	1	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.519	2026-04-22 06:54:51.519	\N	manual
9201ff97-d2fb-43e7-a5b0-23d763d55477	B4 独立测验	\N	00000000-0000-0000-0000-000000000b04	quiz	deedd844-e302-4b20-903d-d9b1d0e12439	\N	\N	\N	\N	\N	2026-04-29 06:58:16.639	\N	2026-04-22 06:58:16.639	published	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:58:16.642	2026-04-22 06:58:16.642	\N	manual
ca3b34d3-815e-49ac-b760-21df5ec4eb74	理财基础知识随堂测验	测试对理财基本概念的掌握程度	29b6fa45-3937-4cc4-8ee8-56366bad7eda	quiz	deedd844-e302-4b20-903d-d9b1d0e12439	\N	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	43e8371f-14b4-476d-9afe-20613d0c9485	in	2026-04-29 06:54:51.515	\N	2026-04-22 06:54:51.518	published	2	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-22 06:54:51.518	2026-04-26 17:07:41.636	\N	manual
7db59a62-e806-44c6-b102-e767f61ed8bb	PDF导入测验	\N	e07a8ba8-6ee1-4d57-836b-a4847296f376	quiz	deedd844-e302-4b20-903d-d9b1d0e12439	{}	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a	pre	2026-04-26 15:07:00	\N	2026-04-26 14:06:53.125	published	\N	{"id": "e07a8ba8-6ee1-4d57-836b-a4847296f376", "taskName": "PDF导入测验", "taskType": "quiz", "createdAt": "2026-04-26T14:02:32.575Z", "creatorId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "updatedAt": "2026-04-26T14:02:32.575Z", "courseName": null, "quizConfig": {"id": "afcc2779-c4ef-49e7-ae2a-edf496918710", "mode": "fixed", "taskId": "e07a8ba8-6ee1-4d57-836b-a4847296f376", "createdAt": "2026-04-26T14:02:32.599Z", "updatedAt": "2026-04-26T14:02:32.599Z", "maxQuestions": null, "difficultyStep": null, "startDifficulty": null, "timeLimitMinutes": null, "showCorrectAnswer": false}, "visibility": "private", "chapterName": null, "requirements": null, "quizQuestions": [], "practiceEnabled": false, "scoringCriteria": [], "simulationConfig": null, "subjectiveConfig": null, "allocationSections": []}	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-04-26 14:06:52.043	2026-04-26 14:06:53.126	\N	manual
a7d9b380-49fd-4ce2-9d95-000935ac0c5a	深度测试	\N	e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53	quiz	deedd844-e302-4b20-903d-d9b1d0e12439	{}	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a	in	2026-04-30 12:53:00	\N	2026-04-27 12:56:16.247	published	\N	{"id": "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53", "taskName": "深度测试", "taskType": "quiz", "createdAt": "2026-04-27T12:56:16.131Z", "creatorId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "updatedAt": "2026-04-27T12:56:16.131Z", "courseName": null, "quizConfig": {"id": "e74a5e0f-1357-470d-83ea-22c2d361bb40", "mode": "adaptive", "taskId": "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53", "createdAt": "2026-04-27T12:56:16.145Z", "updatedAt": "2026-04-27T12:56:16.145Z", "maxQuestions": null, "difficultyStep": null, "startDifficulty": null, "timeLimitMinutes": null, "showCorrectAnswer": false}, "visibility": "private", "chapterName": null, "requirements": null, "quizQuestions": [{"id": "81819fa1-864a-4928-86a7-d3610b615aa3", "type": "single_choice", "order": 0, "points": 2, "prompt": "在深度测试中，以下哪项最能体现‘深度’的含义？", "taskId": "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53", "options": [{"id": "A", "text": "测试用例数量多"}, {"id": "B", "text": "覆盖所有代码行"}, {"id": "C", "text": "深入验证系统内部逻辑和边界条件"}, {"id": "D", "text": "仅测试用户界面功能"}], "createdAt": "2026-04-27T12:56:16.169Z", "updatedAt": "2026-04-27T12:56:16.169Z", "difficulty": null, "explanation": "深度测试强调对系统内部逻辑、异常路径和边界条件的深入验证，而非仅关注表面功能或代码覆盖率。", "correctAnswer": null, "correctOptionIds": ["C"]}, {"id": "d5a4f24a-78f3-474a-8e84-237ff57f75c9", "type": "multiple_choice", "order": 1, "points": 3, "prompt": "以下哪些是深度测试中常用的测试技术？（可多选）", "taskId": "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53", "options": [{"id": "A", "text": "等价类划分"}, {"id": "B", "text": "路径覆盖"}, {"id": "C", "text": "模糊测试"}, {"id": "D", "text": "状态转换测试"}], "createdAt": "2026-04-27T12:56:16.169Z", "updatedAt": "2026-04-27T12:56:16.169Z", "difficulty": null, "explanation": "深度测试常涉及路径覆盖（深入代码路径）、模糊测试（异常输入探测）和状态转换测试（复杂状态逻辑），而等价类划分属于基础功能测试技术。", "correctAnswer": null, "correctOptionIds": ["B", "C", "D"]}, {"id": "34ba68b9-45ee-4849-9153-7ccb396df12f", "type": "true_false", "order": 2, "points": 1, "prompt": "深度测试的目标是发现尽可能多的缺陷，无论其严重程度。", "taskId": "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53", "options": [{"id": "T", "text": "对"}, {"id": "F", "text": "错"}], "createdAt": "2026-04-27T12:56:16.169Z", "updatedAt": "2026-04-27T12:56:16.169Z", "difficulty": null, "explanation": "深度测试更关注高风险、高影响或隐藏较深的缺陷，而非单纯追求数量，尤其重视可能引发系统崩溃或安全漏洞的问题。", "correctAnswer": null, "correctOptionIds": ["F"]}, {"id": "e7e3a39c-19fe-469e-8717-517d68e3950d", "type": "short_answer", "order": 3, "points": 3, "prompt": "请简述深度测试与广度测试的主要区别。", "taskId": "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53", "options": null, "createdAt": "2026-04-27T12:56:16.169Z", "updatedAt": "2026-04-27T12:56:16.169Z", "difficulty": null, "explanation": "深度测试重‘深’，广度测试重‘广’，两者互补。", "correctAnswer": "深度测试聚焦于特定模块或功能的深入验证，包括边界条件、异常处理和内部逻辑；而广度测试覆盖系统整体功能范围，确保各模块基本功能正常，但不深入细节。", "correctOptionIds": []}, {"id": "0140dc07-5529-45dd-a870-9c6a48452aef", "type": "single_choice", "order": 4, "points": 2, "prompt": "在进行深度测试时，以下哪种情况最可能被忽略但需要特别关注？", "taskId": "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53", "options": [{"id": "A", "text": "正常业务流程"}, {"id": "B", "text": "用户登录成功场景"}, {"id": "C", "text": "并发访问下的资源竞争"}, {"id": "D", "text": "页面加载速度"}], "createdAt": "2026-04-27T12:56:16.169Z", "updatedAt": "2026-04-27T12:56:16.169Z", "difficulty": null, "explanation": "并发和资源竞争属于深层次的系统行为，在常规测试中容易被忽略，但在深度测试中需重点验证。", "correctAnswer": null, "correctOptionIds": ["C"]}, {"id": "70b3b833-77d9-413c-8347-4fb2a75705c9", "type": "multiple_choice", "order": 5, "points": 3, "prompt": "实施深度测试前，通常需要哪些准备工作？（可多选）", "taskId": "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53", "options": [{"id": "A", "text": "获取系统架构文档"}, {"id": "B", "text": "编写自动化脚本"}, {"id": "C", "text": "分析代码逻辑和数据流"}, {"id": "D", "text": "明确高风险模块"}], "createdAt": "2026-04-27T12:56:16.169Z", "updatedAt": "2026-04-27T12:56:16.169Z", "difficulty": null, "explanation": "深度测试依赖对系统内部的理解，因此需要架构文档、代码分析和风险识别；自动化脚本虽有用，但非必要前提。", "correctAnswer": null, "correctOptionIds": ["A", "C", "D"]}, {"id": "6458b86d-4c68-4254-a484-e746b1906f69", "type": "true_false", "order": 6, "points": 1, "prompt": "深度测试只能在系统开发完成后进行。", "taskId": "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53", "options": [{"id": "T", "text": "对"}, {"id": "F", "text": "错"}], "createdAt": "2026-04-27T12:56:16.169Z", "updatedAt": "2026-04-27T12:56:16.169Z", "difficulty": null, "explanation": "深度测试可在单元、集成等阶段进行，越早介入越能发现深层设计或逻辑问题。", "correctAnswer": null, "correctOptionIds": ["F"]}, {"id": "06676323-4b9d-44a8-8c30-b87b8433a923", "type": "short_answer", "order": 7, "points": 3, "prompt": "为什么在金融系统中特别需要深度测试？", "taskId": "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53", "options": null, "createdAt": "2026-04-27T12:56:16.169Z", "updatedAt": "2026-04-27T12:56:16.169Z", "difficulty": null, "explanation": "金融系统的高风险特性决定了必须进行深入、严谨的测试。", "correctAnswer": "金融系统涉及资金交易、合规性和高安全性，微小逻辑错误可能导致重大经济损失或法律风险，因此必须通过深度测试验证复杂业务规则、异常处理和安全机制。", "correctOptionIds": []}, {"id": "246d05fc-b952-43e6-8e8d-df5f2bbb3902", "type": "single_choice", "order": 8, "points": 2, "prompt": "以下哪项工具最适用于深度测试中的内存泄漏检测？", "taskId": "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53", "options": [{"id": "A", "text": "Selenium"}, {"id": "B", "text": "JMeter"}, {"id": "C", "text": "Valgrind"}, {"id": "D", "text": "Postman"}], "createdAt": "2026-04-27T12:56:16.169Z", "updatedAt": "2026-04-27T12:56:16.169Z", "difficulty": null, "explanation": "Valgrind 是专门用于检测内存错误和泄漏的工具，适合深度测试；其他工具主要用于功能或性能测试。", "correctAnswer": null, "correctOptionIds": ["C"]}, {"id": "6c592f99-2d3d-4e10-8ad3-983cf9c5b0ed", "type": "multiple_choice", "order": 9, "points": 2, "prompt": "深度测试中，判断一个测试用例是否‘深入’的标准包括？（可多选）", "taskId": "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53", "options": [{"id": "A", "text": "是否覆盖了多个功能模块"}, {"id": "B", "text": "是否触发了异常处理路径"}, {"id": "C", "text": "是否验证了内部状态一致性"}, {"id": "D", "text": "是否使用了真实用户数据"}], "createdAt": "2026-04-27T12:56:16.169Z", "updatedAt": "2026-04-27T12:56:16.169Z", "difficulty": null, "explanation": "深度体现在对异常路径和内部状态的验证，而非跨模块覆盖或数据真实性（后者属于广度或数据测试范畴）。", "correctAnswer": null, "correctOptionIds": ["B", "C"]}], "practiceEnabled": false, "scoringCriteria": [], "simulationConfig": null, "subjectiveConfig": null, "allocationSections": []}	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-04-27 12:56:16.214	2026-04-27 12:56:16.25	\N	manual
f1494008-e987-4576-b5e5-4a304d0ec822	客户理财咨询模拟练习	模拟与保守型客户的理财咨询对话	77999372-a6e0-4a49-8a01-5e978d08bdb6	simulation	deedd844-e302-4b20-903d-d9b1d0e12439	\N	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	2af5c382-dbc8-49d9-ac9c-1ae722ce55ad	becc4615-d8ae-4a26-b944-2dc32e790064	post	2026-05-13 11:40:04.518	\N	2026-04-29 11:40:04.518	published	3	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.519	2026-04-29 11:40:04.519	\N	manual
483fbaf6-60d2-4444-a5fe-da03536b1215	理财基础知识随堂测验	测试对理财基本概念的掌握程度	f5532d66-c556-463d-bdf3-e50b5e4b8e90	quiz	deedd844-e302-4b20-903d-d9b1d0e12439	\N	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	e8d705d0-3d1f-480a-8a97-0e71d0e6a832	e608d521-429e-43a4-abc4-03c6f7c68041	in	2026-05-06 11:40:04.518	\N	2026-04-29 11:40:04.525	published	2	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.525	2026-04-29 11:40:04.525	\N	manual
d8099300-e7ff-4aac-8505-b3533a82fd39	个人投资组合分析报告	为模拟客户设计投资方案并撰写分析报告	cd4bb0e4-edbf-4191-bf5e-7d2eb5ac392d	subjective	deedd844-e302-4b20-903d-d9b1d0e12439	\N	ec619c34-99ed-4e45-9f97-2bcd43c1bcb1	fdbbe65f-5645-43a6-9468-23dcb3b252a6	58d1cee7-23f4-4b0d-bec0-eb2337d365e0	post	2026-05-20 11:40:04.518	\N	2026-04-29 11:40:04.527	published	1	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.528	2026-04-29 11:40:04.528	\N	manual
00000000-0000-4000-8000-00000000a601	ANL-2 复利测验	\N	00000000-0000-4000-8000-00000000a501	quiz	deedd844-e302-4b20-903d-d9b1d0e12439	\N	00000000-0000-4000-8000-00000000a201	00000000-0000-4000-8000-00000000a301	00000000-0000-4000-8000-00000000a401	in	2026-05-15 00:00:00	\N	2026-04-20 00:00:00	published	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.561	2026-04-29 11:40:04.561	\N	manual
00000000-0000-4000-8000-00000000a602	ANL-2 客户风险评估模拟	\N	00000000-0000-4000-8000-00000000a502	simulation	deedd844-e302-4b20-903d-d9b1d0e12439	\N	00000000-0000-4000-8000-00000000a201	00000000-0000-4000-8000-00000000a302	00000000-0000-4000-8000-00000000a402	post	2026-05-15 00:00:00	\N	2026-04-20 00:00:00	published	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.563	2026-04-29 11:40:04.563	\N	manual
00000000-0000-4000-8000-00000000a603	ANL-2 资产配置简答	\N	00000000-0000-4000-8000-00000000a503	subjective	deedd844-e302-4b20-903d-d9b1d0e12439	\N	00000000-0000-4000-8000-00000000a201	00000000-0000-4000-8000-00000000a301	00000000-0000-4000-8000-00000000a401	post	2026-05-15 00:00:00	\N	2026-04-20 00:00:00	published	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.563	2026-04-29 11:40:04.563	\N	manual
00000000-0000-4000-8000-00000000b601	ANL-2 B 班独立测验	\N	00000000-0000-4000-8000-00000000b501	quiz	1dbdc794-23c9-48dd-ba40-f0fbec3a1257	\N	00000000-0000-4000-8000-00000000a202	00000000-0000-4000-8000-00000000b301	\N	in	2026-05-15 00:00:00	\N	2026-04-20 00:00:00	published	\N	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-29 11:40:04.564	2026-04-29 11:40:04.564	\N	manual
b7ca71ef-7239-4844-b0bd-29e1b444be61	[QA-V2-202604300250] 风险收益基础测验	用于验证 analytics-v2 题库诊断与弱点标签。	f6ae7ba0-ae3b-4143-ba33-e81e2481b7d7	quiz	deedd844-e302-4b20-903d-d9b1d0e12439	{bb89b285-82ca-4f46-952e-c8a4a964494e}	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a	pre	2026-05-14 02:50:06.158	\N	2026-04-30 02:50:06.158	published	2	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-30 02:50:06.183	2026-04-30 02:50:06.183	\N	manual
57c9940b-4d55-4760-9697-2d88d1c40933	[QA-V2-202604300250] 家庭预算分析报告	用于验证 analytics-v2 主观题 rubric 诊断。	d8097130-8847-4a51-aa30-dffa6345f59c	subjective	deedd844-e302-4b20-903d-d9b1d0e12439	{bb89b285-82ca-4f46-952e-c8a4a964494e}	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a	post	2026-05-14 02:50:06.158	\N	2026-04-30 02:50:06.158	published	1	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-30 02:50:06.257	2026-04-30 02:50:06.257	\N	manual
c0c0c1e5-36e3-41ff-82d3-c978d5bd2b11	[QA-V2-202604300250] 客户风险沟通模拟	用于验证 analytics-v2 模拟对话 rubric 诊断。	5e69a393-3175-4cef-a92a-c44612593f4d	simulation	deedd844-e302-4b20-903d-d9b1d0e12439	{bb89b285-82ca-4f46-952e-c8a4a964494e}	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a	in	2026-05-14 02:50:06.158	\N	2026-04-30 02:50:06.158	published	1	\N	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	2026-04-30 02:50:06.321	2026-04-30 02:50:06.321	\N	manual
449ae28c-8913-43f5-adda-dc296885071b	个人理财基础概念测验	本测验旨在评估学生对个人理财基本概念的理解，包括定义、重要性和核心要素，适合中高职课堂使用。	3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9	quiz	deedd844-e302-4b20-903d-d9b1d0e12439	{}	e6fc049c-756f-4442-86da-35a6cdbadd6e	baf9c3d6-b36d-4b72-abbc-98b96eb49443	5dc7b6c9-f6d1-4205-9756-4dabc84a8c6a	post	2026-05-14 08:52:10.551	\N	2026-04-30 08:52:12.852	closed	\N	{"id": "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9", "taskName": "个人理财基础概念测验", "taskType": "quiz", "createdAt": "2026-04-30T08:52:12.738Z", "creatorId": "148ad66f-c793-4ca5-9b0d-e2d5cc7edd39", "updatedAt": "2026-04-30T08:52:12.738Z", "courseName": null, "quizConfig": {"id": "15c45cb0-3b03-45ff-93fb-9bda46248c33", "mode": "fixed", "taskId": "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9", "createdAt": "2026-04-30T08:52:12.758Z", "updatedAt": "2026-04-30T08:52:12.758Z", "maxQuestions": null, "difficultyStep": null, "startDifficulty": null, "timeLimitMinutes": 30, "showCorrectAnswer": true}, "visibility": "private", "chapterName": null, "requirements": "本测验旨在评估学生对个人理财基本概念的理解，包括定义、重要性和核心要素，适合中高职课堂使用。", "quizQuestions": [{"id": "9076e940-5674-4d97-8563-7055970c5a86", "type": "single_choice", "order": 0, "points": 3, "prompt": "个人理财的定义是什么？", "taskId": "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9", "options": [{"id": "A", "text": "管理个人或家庭的财务资源以实现财务目标和保障"}, {"id": "B", "text": "只关注短期消费和储蓄"}, {"id": "C", "text": "专门投资于高风险资产"}, {"id": "D", "text": "仅由专业财务顾问处理"}], "createdAt": "2026-04-30T08:52:12.777Z", "updatedAt": "2026-04-30T08:52:12.777Z", "difficulty": null, "explanation": "个人理财涉及全面管理财务资源，包括收入、支出、储蓄、投资和风险管理，以实现长期财务目标。", "correctAnswer": null, "correctOptionIds": ["A"]}, {"id": "ce9fd4db-5cb3-4c63-ad68-20d019b2189c", "type": "single_choice", "order": 1, "points": 3, "prompt": "以下哪项不是个人理财的核心要素？", "taskId": "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9", "options": [{"id": "A", "text": "预算编制"}, {"id": "B", "text": "随意消费"}, {"id": "C", "text": "投资规划"}, {"id": "D", "text": "风险保障"}], "createdAt": "2026-04-30T08:52:12.777Z", "updatedAt": "2026-04-30T08:52:12.777Z", "difficulty": null, "explanation": "个人理财的核心要素包括预算、储蓄、投资、保险等，随意消费不属于核心要素，可能导致财务问题。", "correctAnswer": null, "correctOptionIds": ["B"]}, {"id": "c7ac00ff-9968-488c-be4d-87bc5230e275", "type": "single_choice", "order": 2, "points": 3, "prompt": "个人理财的主要目标是什么？", "taskId": "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9", "options": [{"id": "A", "text": "最大化短期收益"}, {"id": "B", "text": "实现财务安全和长期目标"}, {"id": "C", "text": "避免所有财务风险"}, {"id": "D", "text": "只关注退休规划"}], "createdAt": "2026-04-30T08:52:12.777Z", "updatedAt": "2026-04-30T08:52:12.777Z", "difficulty": null, "explanation": "个人理财旨在通过合理规划实现财务安全、保障生活并达成各种财务目标，如购房、教育、退休等，而不是追求短期收益或完全避免风险。", "correctAnswer": null, "correctOptionIds": ["B"]}, {"id": "e113472b-92a0-4fd8-bd6e-0bab7fa376e6", "type": "multiple_choice", "order": 3, "points": 3, "prompt": "个人理财中，风险管理通常包括哪些方面？（多选）", "taskId": "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9", "options": [{"id": "A", "text": "购买保险"}, {"id": "B", "text": "分散投资"}, {"id": "C", "text": "应急基金"}, {"id": "D", "text": "忽略潜在风险"}, {"id": "E", "text": "定期评估财务计划"}], "createdAt": "2026-04-30T08:52:12.777Z", "updatedAt": "2026-04-30T08:52:12.777Z", "difficulty": null, "explanation": "风险管理涉及保险、分散投资、应急基金和定期评估，以减少财务不确定性；忽略风险不属于有效管理。", "correctAnswer": null, "correctOptionIds": ["A", "B", "C", "E"]}, {"id": "6a4e5f22-7728-47f4-8758-30377b9188a7", "type": "multiple_choice", "order": 4, "points": 3, "prompt": "以下哪些是个人理财规划的基本步骤？（多选）", "taskId": "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9", "options": [{"id": "A", "text": "设定财务目标"}, {"id": "B", "text": "评估当前财务状况"}, {"id": "C", "text": "制定预算"}, {"id": "D", "text": "执行和监控计划"}, {"id": "E", "text": "从不调整计划"}], "createdAt": "2026-04-30T08:52:12.777Z", "updatedAt": "2026-04-30T08:52:12.777Z", "difficulty": null, "explanation": "个人理财规划包括设定目标、评估现状、制定预算、执行计划并定期监控和调整；从不调整计划是不合理的。", "correctAnswer": null, "correctOptionIds": ["A", "B", "C", "D"]}, {"id": "c068b9c4-dd93-4d16-aae3-108a11e5090b", "type": "true_false", "order": 5, "points": 3, "prompt": "个人理财只适用于成年人，学生不需要关注。", "taskId": "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9", "options": [{"id": "T", "text": "对"}, {"id": "F", "text": "错"}], "createdAt": "2026-04-30T08:52:12.777Z", "updatedAt": "2026-04-30T08:52:12.777Z", "difficulty": null, "explanation": "个人理财对所有年龄段都很重要，学生可以通过学习理财知识为未来做准备，培养良好财务习惯。", "correctAnswer": null, "correctOptionIds": []}, {"id": "6b7d41b5-b7dc-4966-b0b6-122a5f9ece8e", "type": "true_false", "order": 6, "points": 3, "prompt": "储蓄是个人理财中唯一重要的部分。", "taskId": "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9", "options": [{"id": "T", "text": "对"}, {"id": "F", "text": "错"}], "createdAt": "2026-04-30T08:52:12.777Z", "updatedAt": "2026-04-30T08:52:12.777Z", "difficulty": null, "explanation": "个人理财包括多个方面，如预算、投资、保险等，储蓄只是其中一部分，需要综合规划。", "correctAnswer": null, "correctOptionIds": []}, {"id": "3a058ff4-9adb-4ad5-b32a-05e7a7199d44", "type": "short_answer", "order": 7, "points": 3, "prompt": "简要说明个人理财的重要性，并列举至少三个核心要素。", "taskId": "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9", "options": null, "createdAt": "2026-04-30T08:52:12.777Z", "updatedAt": "2026-04-30T08:52:12.777Z", "difficulty": null, "explanation": "此题评估学生对个人理财整体概念的理解，需涵盖重要性和核心要素。", "correctAnswer": "个人理财的重要性在于帮助个人管理财务资源，实现财务目标，应对不确定性，保障生活质量。核心要素包括：1. 预算编制；2. 储蓄与投资；3. 风险管理；4. 税务规划等。", "correctOptionIds": []}], "practiceEnabled": false, "scoringCriteria": [], "simulationConfig": null, "subjectiveConfig": null, "allocationSections": []}	148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	2026-04-30 08:52:12.856	2026-05-14 07:24:58.858	\N	manual
\.


--
-- Data for Name: TaskInstanceAnalytics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TaskInstanceAnalytics" (id, "taskInstanceId", "taskId", "submissionCount", "avgScore", "scoreDist", "quizQuestionStats", "subjectiveRubricStats", "updatedAt") FROM stdin;
\.


--
-- Data for Name: TaskPost; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TaskPost" (id, "taskInstanceId", "authorId", content, "replyToPostId", "createdAt", "updatedAt") FROM stdin;
e6282153-07ee-4c14-b8bc-5b1a4199b7d3	2e700d5e-fa7e-4f13-b000-03f660414b89	4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	sd	\N	2026-02-21 15:42:31.816	2026-02-21 15:42:31.816
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, email, "passwordHash", name, role, "classId", "avatarUrl", "createdAt", "updatedAt") FROM stdin;
3a47e87a-bc62-43bf-8368-b8d2c15a8b64	admin@finsim.edu.cn	$2b$12$9jfGXL3nF.fP4UYRhPajPO1trE0WeZ9rbpresCncPPGftHmUqdqlK	系统管理员	admin	\N	\N	2026-02-21 09:55:53.188	2026-02-21 09:55:53.188
4dbbe635-a2ad-4605-a9a9-fe2bb491e6b5	teacher1@finsim.edu.cn	$2b$12$9jfGXL3nF.fP4UYRhPajPO1trE0WeZ9rbpresCncPPGftHmUqdqlK	王教授	teacher	\N	\N	2026-02-21 09:55:53.209	2026-02-21 09:55:53.209
ebbbeb19-a273-4bff-8289-f77abcbeb3fc	teacher2@finsim.edu.cn	$2b$12$9jfGXL3nF.fP4UYRhPajPO1trE0WeZ9rbpresCncPPGftHmUqdqlK	李教授	teacher	\N	\N	2026-02-21 09:55:53.212	2026-02-21 09:55:53.212
dcb6638a-264a-4bbb-ae7a-b1c646f07c5e	student1@finsim.edu.cn	$2b$12$9jfGXL3nF.fP4UYRhPajPO1trE0WeZ9rbpresCncPPGftHmUqdqlK	张三	student	deedd844-e302-4b20-903d-d9b1d0e12439	\N	2026-02-21 09:55:53.234	2026-02-21 09:55:53.234
eb623313-3cc8-4da2-ac8f-0a1d5cd656bb	student2@finsim.edu.cn	$2b$12$9jfGXL3nF.fP4UYRhPajPO1trE0WeZ9rbpresCncPPGftHmUqdqlK	李四	student	deedd844-e302-4b20-903d-d9b1d0e12439	\N	2026-02-21 09:55:53.24	2026-02-21 09:55:53.24
d6be46c1-1c04-46a7-a3ae-b493d25d4414	student3@finsim.edu.cn	$2b$12$9jfGXL3nF.fP4UYRhPajPO1trE0WeZ9rbpresCncPPGftHmUqdqlK	王五	student	deedd844-e302-4b20-903d-d9b1d0e12439	\N	2026-02-21 09:55:53.243	2026-02-21 09:55:53.243
54b6889f-a70b-4f3d-937a-8124c49baa80	student4@finsim.edu.cn	$2b$12$9jfGXL3nF.fP4UYRhPajPO1trE0WeZ9rbpresCncPPGftHmUqdqlK	赵六	student	deedd844-e302-4b20-903d-d9b1d0e12439	\N	2026-02-21 09:55:53.246	2026-02-21 09:55:53.246
98c66e4b-c71e-4ca5-bacd-8825d8c3c21b	student5@finsim.edu.cn	$2b$12$9jfGXL3nF.fP4UYRhPajPO1trE0WeZ9rbpresCncPPGftHmUqdqlK	陈七	student	1dbdc794-23c9-48dd-ba40-f0fbec3a1257	\N	2026-02-21 09:55:53.248	2026-02-21 09:55:53.248
ee216363-bc2f-4d72-9620-3af0de15a606	student6@finsim.edu.cn	$2b$12$9jfGXL3nF.fP4UYRhPajPO1trE0WeZ9rbpresCncPPGftHmUqdqlK	周八	student	1dbdc794-23c9-48dd-ba40-f0fbec3a1257	\N	2026-02-21 09:55:53.251	2026-02-21 09:55:53.251
62235d2c-a740-4db0-93e7-e28251354cba	qa-test-1777370993@finsim.edu.cn	$2b$12$451XetDBl0D6QOkl3dE6CeEy.tUDVm6NBX48YifPWCurSmmFQDJnq	QA 测试	student	deedd844-e302-4b20-903d-d9b1d0e12439	\N	2026-04-28 10:09:58.906	2026-04-28 10:09:58.906
77cd55ef-e239-4407-9998-a583386767ff	qa-r2-1777371480@finsim.edu.cn	$2b$12$poT9taAud/XkEMqv25nb.Onpu2d.BKVgdXBUbWvjf/OFoA.UYBFi2	r2 验证用户	student	deedd844-e302-4b20-903d-d9b1d0e12439	\N	2026-04-28 10:18:03.652	2026-04-28 10:18:03.652
236c3795-f19f-4107-a681-0bc0e1d21d62	alex@qq.com	$2b$12$wxDNeN4fECQgvHgStCOj6OjnxWa9GxbN26g.BOl8SAngli3ZWTTge	alex	student	deedd844-e302-4b20-903d-d9b1d0e12439	\N	2026-02-25 05:05:18.16	2026-04-30 06:25:37.411
edad1bc2-43ae-4598-8e12-1053ef4eb964	belle@qq.com	$2b$12$wxDNeN4fECQgvHgStCOj6OjnxWa9GxbN26g.BOl8SAngli3ZWTTge	belle	student	deedd844-e302-4b20-903d-d9b1d0e12439	\N	2026-04-30 06:25:37.454	2026-04-30 06:25:37.454
32575dd0-e927-408b-ba9f-7f003bfd60d6	charlie@qq.com	$2b$12$wxDNeN4fECQgvHgStCOj6OjnxWa9GxbN26g.BOl8SAngli3ZWTTge	charlie	student	deedd844-e302-4b20-903d-d9b1d0e12439	\N	2026-04-30 06:25:37.479	2026-04-30 06:25:37.479
db2cbb54-e58f-4a0a-8afe-d7333a592981	dexter@qq.com	$2b$12$wxDNeN4fECQgvHgStCOj6OjnxWa9GxbN26g.BOl8SAngli3ZWTTge	dexter	student	deedd844-e302-4b20-903d-d9b1d0e12439	\N	2026-04-30 06:25:37.486	2026-04-30 06:25:37.486
148ad66f-c793-4ca5-9b0d-e2d5cc7edd39	molly@qq.com	$2b$12$tjvc5whQRveU4suS/O/5Rerw37b/29H9fbjIBfl063sYyDB8up7/a	molly	teacher	\N	\N	2026-04-13 13:30:24.973	2026-04-13 13:30:24.973
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
9ffe0809-ea44-4667-b22b-b3040d5a0fd2	692d6a8b696407f54699b590e6cc941c9cabb2fab510875af714b3f975576648	2026-02-21 08:49:30.290623+00	20260221084930_init	\N	\N	2026-02-21 08:49:30.086506+00	1
00d5a57c-5f45-4ef6-85c0-42bba2fe853b	e6aae4fce938696dcfb2eef30841d8e479c324ced3863d28686263990a19c5ed	2026-04-30 16:23:56.707736+00	20260430170000_add_ai_tool_settings_and_ingestion_states	\N	\N	2026-04-30 16:23:56.523859+00	1
9e5c7bdc-3300-46a5-a0ff-df1862c5e3a3	ac7ef5ce840356560570c08e872dfb2aa10c37164d82de51fa2a214cea723375	2026-02-21 14:57:32.108983+00	20260221145732_add_semester_and_weektype	\N	\N	2026-02-21 14:57:32.101998+00	1
878c62c3-9726-4fc3-9f05-c5b7f2e53fc5	d298f546238529fa0bd09e39ad702bcf2719ae7e7ff21b7c139bf49a65a3acb2	2026-02-24 15:17:48.006973+00	20260224151747_add_simulation_system_prompt	\N	\N	2026-02-24 15:17:48.003561+00	1
e0bbab99-8bbc-4344-8559-171ffe2b6064	018f9e9aad0f792e2453789b715cdb04b7a51e2c98d1b91cdde10b2501290efb	2026-02-25 03:00:39.523678+00	20260225030039_add_course_teacher	\N	\N	2026-02-25 03:00:39.506192+00	1
e4e0ab6e-0af8-4082-990c-a115b721214d	bd88ed26d1ccfda275effd77dc8d762a60c1f602e1547abf2883f3eb202d43a9	2026-05-01 03:18:15.046058+00	20260501031814_add_async_jobs_task_drafts_ai_runs	\N	\N	2026-05-01 03:18:14.725633+00	1
d7969263-60b2-4306-8f62-b18ef1f80f04	480f82ac20e2b00f4346539a4b0fd238cc98067991265aed7f2663bf5846d375	2026-02-25 03:45:32.672674+00	20260225034532_add_course_class	\N	\N	2026-02-25 03:45:32.65806+00	1
db9d0fb7-8adf-4b67-bfa4-b6dd825be703	528ac88b9a7f5ba3d15b0b1cd812edbc5ace68e332d8dfa1cb7dd183fb095d87	2026-05-02 17:28:35.650565+00	20260503090000_add_data_insight_advice_job_type	\N	\N	2026-05-02 17:28:35.631407+00	1
7b14fe5b-64b2-40db-9bb2-5388c46411ff	586305d7b40da532fc15e00151d6cffc8128b994d75a11c27f0c8df31d61c736	2026-04-25 01:19:13.9691+00	20260425011913_add_analysis_aggregate_fields	\N	\N	2026-04-25 01:19:13.963129+00	1
ddd62fac-981c-4ce3-891e-70111f874709	phase4_scope_analysis_report_manual	2026-05-03 01:12:52.745066+00	20260503011246_phase4_scope_analysis_report	\N	\N	2026-05-03 01:12:52.745066+00	1
a338c326-781c-40d7-8a46-63b88a09d40b	87dfafdd654aeb8293f57f93b93065a07e7c5d77d5e34b9f819d897857a57d77	2026-04-25 16:07:56.040335+00	20260425160756_add_mood_timeline	\N	\N	2026-04-25 16:07:56.03284+00	1
97b1e377-a181-4ea8-8156-c8a062d16951	1af3e8e5ac2663efedfcaa07db4f27af5782ef7de9040f2a9312bc1b99b398c4	2026-04-26 03:22:02.302952+00	20260426112144_add_analysis_report_unique_instance	\N	\N	2026-04-26 03:22:02.27999+00	1
1fa4059c-231f-4079-9a47-dae90f93c75f	ed8093369fceee30f3655c498f54f48243f4bd0b21c53483094951df51364ca6	2026-04-22 06:54:49.42865+00	20260422041600_backfill_course_class	\N	\N	2026-04-22 06:54:49.41732+00	1
b9006a59-9187-487f-8f83-07cd96ae1db8	e905aaea0d36e2f582be844ca37531e6ba21159c44caa468bb48d2fedad502d7	2026-04-26 03:29:08.947257+00	20260426010000_add_pgcrypto_extension	\N	\N	2026-04-26 03:29:08.931253+00	1
d4aae319-c958-4c28-af53-154cbdeff650	caec887adfd9dda5ba3dd8d0f7999fe5dee48015022b8e722f86509de1306877	2026-04-26 16:28:54.225327+00	20260426162854_add_release_mode	\N	\N	2026-04-26 16:28:54.197004+00	1
9803f2e7-a265-487e-b700-26b4fce99995	c83d5d75f43f649a6d72c01fce1def37fb67b591d427c03c97e7d12dfd57100f	2026-04-30 02:27:04.302207+00	20260430090000_add_course_knowledge_sources	\N	\N	2026-04-30 02:27:04.172143+00	1
\.


--
-- Name: AiRun AiRun_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiRun"
    ADD CONSTRAINT "AiRun_pkey" PRIMARY KEY (id);


--
-- Name: AiToolSetting AiToolSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiToolSetting"
    ADD CONSTRAINT "AiToolSetting_pkey" PRIMARY KEY (id);


--
-- Name: AllocationItem AllocationItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AllocationItem"
    ADD CONSTRAINT "AllocationItem_pkey" PRIMARY KEY (id);


--
-- Name: AllocationSection AllocationSection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AllocationSection"
    ADD CONSTRAINT "AllocationSection_pkey" PRIMARY KEY (id);


--
-- Name: AnalysisReport AnalysisReport_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnalysisReport"
    ADD CONSTRAINT "AnalysisReport_pkey" PRIMARY KEY (id);


--
-- Name: Announcement Announcement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_pkey" PRIMARY KEY (id);


--
-- Name: AsyncJob AsyncJob_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AsyncJob"
    ADD CONSTRAINT "AsyncJob_pkey" PRIMARY KEY (id);


--
-- Name: Attachment Attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: Chapter Chapter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Chapter"
    ADD CONSTRAINT "Chapter_pkey" PRIMARY KEY (id);


--
-- Name: Class Class_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Class"
    ADD CONSTRAINT "Class_pkey" PRIMARY KEY (id);


--
-- Name: ContentBlock ContentBlock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentBlock"
    ADD CONSTRAINT "ContentBlock_pkey" PRIMARY KEY (id);


--
-- Name: CourseClass CourseClass_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseClass"
    ADD CONSTRAINT "CourseClass_pkey" PRIMARY KEY (id);


--
-- Name: CourseKnowledgeSource CourseKnowledgeSource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseKnowledgeSource"
    ADD CONSTRAINT "CourseKnowledgeSource_pkey" PRIMARY KEY (id);


--
-- Name: CourseTeacher CourseTeacher_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseTeacher"
    ADD CONSTRAINT "CourseTeacher_pkey" PRIMARY KEY (id);


--
-- Name: Course Course_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Course"
    ADD CONSTRAINT "Course_pkey" PRIMARY KEY (id);


--
-- Name: ImportJob ImportJob_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ImportJob"
    ADD CONSTRAINT "ImportJob_pkey" PRIMARY KEY (id);


--
-- Name: QuizConfig QuizConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuizConfig"
    ADD CONSTRAINT "QuizConfig_pkey" PRIMARY KEY (id);


--
-- Name: QuizQuestion QuizQuestion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuizQuestion"
    ADD CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY (id);


--
-- Name: QuizSubmission QuizSubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuizSubmission"
    ADD CONSTRAINT "QuizSubmission_pkey" PRIMARY KEY (id);


--
-- Name: ScheduleSlot ScheduleSlot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduleSlot"
    ADD CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY (id);


--
-- Name: ScoringCriterion ScoringCriterion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScoringCriterion"
    ADD CONSTRAINT "ScoringCriterion_pkey" PRIMARY KEY (id);


--
-- Name: Section Section_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Section"
    ADD CONSTRAINT "Section_pkey" PRIMARY KEY (id);


--
-- Name: SimulationConfig SimulationConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SimulationConfig"
    ADD CONSTRAINT "SimulationConfig_pkey" PRIMARY KEY (id);


--
-- Name: SimulationSubmission SimulationSubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SimulationSubmission"
    ADD CONSTRAINT "SimulationSubmission_pkey" PRIMARY KEY (id);


--
-- Name: StudentGroupMember StudentGroupMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentGroupMember"
    ADD CONSTRAINT "StudentGroupMember_pkey" PRIMARY KEY (id);


--
-- Name: StudentGroup StudentGroup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentGroup"
    ADD CONSTRAINT "StudentGroup_pkey" PRIMARY KEY (id);


--
-- Name: StudyBuddyPost StudyBuddyPost_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudyBuddyPost"
    ADD CONSTRAINT "StudyBuddyPost_pkey" PRIMARY KEY (id);


--
-- Name: StudyBuddySummary StudyBuddySummary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudyBuddySummary"
    ADD CONSTRAINT "StudyBuddySummary_pkey" PRIMARY KEY (id);


--
-- Name: SubjectiveConfig SubjectiveConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubjectiveConfig"
    ADD CONSTRAINT "SubjectiveConfig_pkey" PRIMARY KEY (id);


--
-- Name: SubjectiveSubmission SubjectiveSubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubjectiveSubmission"
    ADD CONSTRAINT "SubjectiveSubmission_pkey" PRIMARY KEY (id);


--
-- Name: Submission Submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_pkey" PRIMARY KEY (id);


--
-- Name: TaskBuildDraft TaskBuildDraft_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskBuildDraft"
    ADD CONSTRAINT "TaskBuildDraft_pkey" PRIMARY KEY (id);


--
-- Name: TaskInstanceAnalytics TaskInstanceAnalytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskInstanceAnalytics"
    ADD CONSTRAINT "TaskInstanceAnalytics_pkey" PRIMARY KEY (id);


--
-- Name: TaskInstance TaskInstance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskInstance"
    ADD CONSTRAINT "TaskInstance_pkey" PRIMARY KEY (id);


--
-- Name: TaskPost TaskPost_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskPost"
    ADD CONSTRAINT "TaskPost_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AiRun_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiRun_createdAt_idx" ON public."AiRun" USING btree ("createdAt");


--
-- Name: AiRun_feature_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiRun_feature_status_idx" ON public."AiRun" USING btree (feature, status);


--
-- Name: AiRun_userId_toolKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiRun_userId_toolKey_idx" ON public."AiRun" USING btree ("userId", "toolKey");


--
-- Name: AiToolSetting_teacherId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiToolSetting_teacherId_idx" ON public."AiToolSetting" USING btree ("teacherId");


--
-- Name: AiToolSetting_teacherId_toolKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AiToolSetting_teacherId_toolKey_key" ON public."AiToolSetting" USING btree ("teacherId", "toolKey");


--
-- Name: AllocationItem_sectionId_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AllocationItem_sectionId_order_idx" ON public."AllocationItem" USING btree ("sectionId", "order");


--
-- Name: AllocationSection_taskId_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AllocationSection_taskId_order_idx" ON public."AllocationSection" USING btree ("taskId", "order");


--
-- Name: AnalysisReport_createdBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnalysisReport_createdBy_idx" ON public."AnalysisReport" USING btree ("createdBy");


--
-- Name: AnalysisReport_scopeHash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnalysisReport_scopeHash_idx" ON public."AnalysisReport" USING btree ("scopeHash");


--
-- Name: AnalysisReport_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnalysisReport_taskId_idx" ON public."AnalysisReport" USING btree ("taskId");


--
-- Name: AnalysisReport_taskInstanceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnalysisReport_taskInstanceId_key" ON public."AnalysisReport" USING btree ("taskInstanceId");


--
-- Name: Announcement_courseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Announcement_courseId_idx" ON public."Announcement" USING btree ("courseId");


--
-- Name: Announcement_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Announcement_status_idx" ON public."Announcement" USING btree (status);


--
-- Name: AsyncJob_createdBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AsyncJob_createdBy_idx" ON public."AsyncJob" USING btree ("createdBy");


--
-- Name: AsyncJob_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AsyncJob_entityType_entityId_idx" ON public."AsyncJob" USING btree ("entityType", "entityId");


--
-- Name: AsyncJob_type_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AsyncJob_type_status_idx" ON public."AsyncJob" USING btree (type, status);


--
-- Name: Attachment_subjectiveSubmissionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_subjectiveSubmissionId_idx" ON public."Attachment" USING btree ("subjectiveSubmissionId");


--
-- Name: AuditLog_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_action_idx" ON public."AuditLog" USING btree (action);


--
-- Name: AuditLog_actorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_actorId_idx" ON public."AuditLog" USING btree ("actorId");


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");


--
-- Name: Chapter_courseId_order_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Chapter_courseId_order_key" ON public."Chapter" USING btree ("courseId", "order");


--
-- Name: Class_createdBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Class_createdBy_idx" ON public."Class" USING btree ("createdBy");


--
-- Name: Class_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Class_name_key" ON public."Class" USING btree (name);


--
-- Name: ContentBlock_sectionId_slot_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentBlock_sectionId_slot_order_idx" ON public."ContentBlock" USING btree ("sectionId", slot, "order");


--
-- Name: CourseClass_classId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseClass_classId_idx" ON public."CourseClass" USING btree ("classId");


--
-- Name: CourseClass_courseId_classId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CourseClass_courseId_classId_key" ON public."CourseClass" USING btree ("courseId", "classId");


--
-- Name: CourseKnowledgeSource_courseId_chapterId_sectionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseKnowledgeSource_courseId_chapterId_sectionId_idx" ON public."CourseKnowledgeSource" USING btree ("courseId", "chapterId", "sectionId");


--
-- Name: CourseKnowledgeSource_sourceType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseKnowledgeSource_sourceType_idx" ON public."CourseKnowledgeSource" USING btree ("sourceType");


--
-- Name: CourseKnowledgeSource_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseKnowledgeSource_status_idx" ON public."CourseKnowledgeSource" USING btree (status);


--
-- Name: CourseKnowledgeSource_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseKnowledgeSource_taskId_idx" ON public."CourseKnowledgeSource" USING btree ("taskId");


--
-- Name: CourseKnowledgeSource_taskInstanceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseKnowledgeSource_taskInstanceId_idx" ON public."CourseKnowledgeSource" USING btree ("taskInstanceId");


--
-- Name: CourseKnowledgeSource_teacherId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseKnowledgeSource_teacherId_idx" ON public."CourseKnowledgeSource" USING btree ("teacherId");


--
-- Name: CourseTeacher_courseId_teacherId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CourseTeacher_courseId_teacherId_key" ON public."CourseTeacher" USING btree ("courseId", "teacherId");


--
-- Name: CourseTeacher_teacherId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseTeacher_teacherId_idx" ON public."CourseTeacher" USING btree ("teacherId");


--
-- Name: Course_classId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Course_classId_idx" ON public."Course" USING btree ("classId");


--
-- Name: Course_createdBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Course_createdBy_idx" ON public."Course" USING btree ("createdBy");


--
-- Name: ImportJob_teacherId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImportJob_teacherId_idx" ON public."ImportJob" USING btree ("teacherId");


--
-- Name: QuizConfig_taskId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "QuizConfig_taskId_key" ON public."QuizConfig" USING btree ("taskId");


--
-- Name: QuizQuestion_taskId_difficulty_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuizQuestion_taskId_difficulty_idx" ON public."QuizQuestion" USING btree ("taskId", difficulty);


--
-- Name: QuizQuestion_taskId_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuizQuestion_taskId_order_idx" ON public."QuizQuestion" USING btree ("taskId", "order");


--
-- Name: QuizSubmission_submissionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "QuizSubmission_submissionId_key" ON public."QuizSubmission" USING btree ("submissionId");


--
-- Name: ScheduleSlot_courseId_dayOfWeek_slotIndex_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduleSlot_courseId_dayOfWeek_slotIndex_idx" ON public."ScheduleSlot" USING btree ("courseId", "dayOfWeek", "slotIndex");


--
-- Name: ScheduleSlot_courseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduleSlot_courseId_idx" ON public."ScheduleSlot" USING btree ("courseId");


--
-- Name: ScoringCriterion_taskId_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScoringCriterion_taskId_order_idx" ON public."ScoringCriterion" USING btree ("taskId", "order");


--
-- Name: Section_chapterId_order_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Section_chapterId_order_key" ON public."Section" USING btree ("chapterId", "order");


--
-- Name: SimulationConfig_taskId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SimulationConfig_taskId_key" ON public."SimulationConfig" USING btree ("taskId");


--
-- Name: SimulationSubmission_submissionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SimulationSubmission_submissionId_key" ON public."SimulationSubmission" USING btree ("submissionId");


--
-- Name: StudentGroupMember_groupId_studentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StudentGroupMember_groupId_studentId_key" ON public."StudentGroupMember" USING btree ("groupId", "studentId");


--
-- Name: StudentGroupMember_studentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentGroupMember_studentId_idx" ON public."StudentGroupMember" USING btree ("studentId");


--
-- Name: StudentGroup_classId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentGroup_classId_idx" ON public."StudentGroup" USING btree ("classId");


--
-- Name: StudentGroup_teacherId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentGroup_teacherId_idx" ON public."StudentGroup" USING btree ("teacherId");


--
-- Name: StudyBuddyPost_isPreview_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudyBuddyPost_isPreview_idx" ON public."StudyBuddyPost" USING btree ("isPreview");


--
-- Name: StudyBuddyPost_studentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudyBuddyPost_studentId_idx" ON public."StudyBuddyPost" USING btree ("studentId");


--
-- Name: StudyBuddyPost_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudyBuddyPost_taskId_idx" ON public."StudyBuddyPost" USING btree ("taskId");


--
-- Name: StudyBuddyPost_taskInstanceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudyBuddyPost_taskInstanceId_idx" ON public."StudyBuddyPost" USING btree ("taskInstanceId");


--
-- Name: StudyBuddySummary_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudyBuddySummary_taskId_idx" ON public."StudyBuddySummary" USING btree ("taskId");


--
-- Name: SubjectiveConfig_taskId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SubjectiveConfig_taskId_key" ON public."SubjectiveConfig" USING btree ("taskId");


--
-- Name: SubjectiveSubmission_submissionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SubjectiveSubmission_submissionId_key" ON public."SubjectiveSubmission" USING btree ("submissionId");


--
-- Name: Submission_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_status_idx" ON public."Submission" USING btree (status);


--
-- Name: Submission_studentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_studentId_idx" ON public."Submission" USING btree ("studentId");


--
-- Name: Submission_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_taskId_idx" ON public."Submission" USING btree ("taskId");


--
-- Name: Submission_taskInstanceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_taskInstanceId_idx" ON public."Submission" USING btree ("taskInstanceId");


--
-- Name: Submission_taskInstanceId_studentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_taskInstanceId_studentId_idx" ON public."Submission" USING btree ("taskInstanceId", "studentId");


--
-- Name: TaskBuildDraft_asyncJobId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskBuildDraft_asyncJobId_idx" ON public."TaskBuildDraft" USING btree ("asyncJobId");


--
-- Name: TaskBuildDraft_courseId_chapterId_sectionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskBuildDraft_courseId_chapterId_sectionId_idx" ON public."TaskBuildDraft" USING btree ("courseId", "chapterId", "sectionId");


--
-- Name: TaskBuildDraft_createdBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskBuildDraft_createdBy_idx" ON public."TaskBuildDraft" USING btree ("createdBy");


--
-- Name: TaskBuildDraft_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskBuildDraft_status_idx" ON public."TaskBuildDraft" USING btree (status);


--
-- Name: TaskInstanceAnalytics_taskInstanceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TaskInstanceAnalytics_taskInstanceId_key" ON public."TaskInstanceAnalytics" USING btree ("taskInstanceId");


--
-- Name: TaskInstance_classId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskInstance_classId_idx" ON public."TaskInstance" USING btree ("classId");


--
-- Name: TaskInstance_courseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskInstance_courseId_idx" ON public."TaskInstance" USING btree ("courseId");


--
-- Name: TaskInstance_sectionId_slot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskInstance_sectionId_slot_idx" ON public."TaskInstance" USING btree ("sectionId", slot);


--
-- Name: TaskInstance_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskInstance_status_idx" ON public."TaskInstance" USING btree (status);


--
-- Name: TaskInstance_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskInstance_taskId_idx" ON public."TaskInstance" USING btree ("taskId");


--
-- Name: TaskPost_replyToPostId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskPost_replyToPostId_idx" ON public."TaskPost" USING btree ("replyToPostId");


--
-- Name: TaskPost_taskInstanceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaskPost_taskInstanceId_idx" ON public."TaskPost" USING btree ("taskInstanceId");


--
-- Name: Task_creatorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_creatorId_idx" ON public."Task" USING btree ("creatorId");


--
-- Name: Task_taskType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_taskType_idx" ON public."Task" USING btree ("taskType");


--
-- Name: User_classId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_classId_idx" ON public."User" USING btree ("classId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_role_idx" ON public."User" USING btree (role);


--
-- Name: AiRun AiRun_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiRun"
    ADD CONSTRAINT "AiRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AiToolSetting AiToolSetting_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiToolSetting"
    ADD CONSTRAINT "AiToolSetting_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AllocationItem AllocationItem_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AllocationItem"
    ADD CONSTRAINT "AllocationItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public."AllocationSection"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AllocationSection AllocationSection_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AllocationSection"
    ADD CONSTRAINT "AllocationSection_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnalysisReport AnalysisReport_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnalysisReport"
    ADD CONSTRAINT "AnalysisReport_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AnalysisReport AnalysisReport_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnalysisReport"
    ADD CONSTRAINT "AnalysisReport_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AnalysisReport AnalysisReport_taskInstanceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnalysisReport"
    ADD CONSTRAINT "AnalysisReport_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES public."TaskInstance"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Announcement Announcement_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Announcement Announcement_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AsyncJob AsyncJob_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AsyncJob"
    ADD CONSTRAINT "AsyncJob_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attachment Attachment_subjectiveSubmissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_subjectiveSubmissionId_fkey" FOREIGN KEY ("subjectiveSubmissionId") REFERENCES public."SubjectiveSubmission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_actorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Chapter Chapter_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Chapter"
    ADD CONSTRAINT "Chapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Chapter Chapter_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Chapter"
    ADD CONSTRAINT "Chapter_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Class Class_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Class"
    ADD CONSTRAINT "Class_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ContentBlock ContentBlock_chapterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentBlock"
    ADD CONSTRAINT "ContentBlock_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES public."Chapter"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ContentBlock ContentBlock_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentBlock"
    ADD CONSTRAINT "ContentBlock_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ContentBlock ContentBlock_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentBlock"
    ADD CONSTRAINT "ContentBlock_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public."Section"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseClass CourseClass_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseClass"
    ADD CONSTRAINT "CourseClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CourseClass CourseClass_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseClass"
    ADD CONSTRAINT "CourseClass_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseKnowledgeSource CourseKnowledgeSource_chapterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseKnowledgeSource"
    ADD CONSTRAINT "CourseKnowledgeSource_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES public."Chapter"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CourseKnowledgeSource CourseKnowledgeSource_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseKnowledgeSource"
    ADD CONSTRAINT "CourseKnowledgeSource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseKnowledgeSource CourseKnowledgeSource_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseKnowledgeSource"
    ADD CONSTRAINT "CourseKnowledgeSource_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public."Section"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CourseKnowledgeSource CourseKnowledgeSource_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseKnowledgeSource"
    ADD CONSTRAINT "CourseKnowledgeSource_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CourseKnowledgeSource CourseKnowledgeSource_taskInstanceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseKnowledgeSource"
    ADD CONSTRAINT "CourseKnowledgeSource_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES public."TaskInstance"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CourseKnowledgeSource CourseKnowledgeSource_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseKnowledgeSource"
    ADD CONSTRAINT "CourseKnowledgeSource_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CourseTeacher CourseTeacher_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseTeacher"
    ADD CONSTRAINT "CourseTeacher_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseTeacher CourseTeacher_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseTeacher"
    ADD CONSTRAINT "CourseTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Course Course_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Course"
    ADD CONSTRAINT "Course_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Course Course_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Course"
    ADD CONSTRAINT "Course_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ImportJob ImportJob_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ImportJob"
    ADD CONSTRAINT "ImportJob_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ImportJob ImportJob_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ImportJob"
    ADD CONSTRAINT "ImportJob_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuizConfig QuizConfig_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuizConfig"
    ADD CONSTRAINT "QuizConfig_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuizQuestion QuizQuestion_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuizQuestion"
    ADD CONSTRAINT "QuizQuestion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuizSubmission QuizSubmission_submissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuizSubmission"
    ADD CONSTRAINT "QuizSubmission_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES public."Submission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ScheduleSlot ScheduleSlot_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduleSlot"
    ADD CONSTRAINT "ScheduleSlot_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ScheduleSlot ScheduleSlot_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduleSlot"
    ADD CONSTRAINT "ScheduleSlot_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ScoringCriterion ScoringCriterion_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScoringCriterion"
    ADD CONSTRAINT "ScoringCriterion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Section Section_chapterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Section"
    ADD CONSTRAINT "Section_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES public."Chapter"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Section Section_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Section"
    ADD CONSTRAINT "Section_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Section Section_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Section"
    ADD CONSTRAINT "Section_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SimulationConfig SimulationConfig_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SimulationConfig"
    ADD CONSTRAINT "SimulationConfig_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SimulationSubmission SimulationSubmission_submissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SimulationSubmission"
    ADD CONSTRAINT "SimulationSubmission_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES public."Submission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudentGroupMember StudentGroupMember_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentGroupMember"
    ADD CONSTRAINT "StudentGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."StudentGroup"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudentGroupMember StudentGroupMember_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentGroupMember"
    ADD CONSTRAINT "StudentGroupMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StudentGroup StudentGroup_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentGroup"
    ADD CONSTRAINT "StudentGroup_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StudentGroup StudentGroup_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentGroup"
    ADD CONSTRAINT "StudentGroup_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StudyBuddyPost StudyBuddyPost_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudyBuddyPost"
    ADD CONSTRAINT "StudyBuddyPost_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StudyBuddyPost StudyBuddyPost_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudyBuddyPost"
    ADD CONSTRAINT "StudyBuddyPost_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StudyBuddyPost StudyBuddyPost_taskInstanceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudyBuddyPost"
    ADD CONSTRAINT "StudyBuddyPost_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES public."TaskInstance"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StudyBuddySummary StudyBuddySummary_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudyBuddySummary"
    ADD CONSTRAINT "StudyBuddySummary_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SubjectiveConfig SubjectiveConfig_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubjectiveConfig"
    ADD CONSTRAINT "SubjectiveConfig_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SubjectiveSubmission SubjectiveSubmission_submissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubjectiveSubmission"
    ADD CONSTRAINT "SubjectiveSubmission_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES public."Submission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Submission Submission_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Submission Submission_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Submission Submission_taskInstanceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES public."TaskInstance"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TaskBuildDraft TaskBuildDraft_chapterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskBuildDraft"
    ADD CONSTRAINT "TaskBuildDraft_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES public."Chapter"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TaskBuildDraft TaskBuildDraft_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskBuildDraft"
    ADD CONSTRAINT "TaskBuildDraft_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskBuildDraft TaskBuildDraft_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskBuildDraft"
    ADD CONSTRAINT "TaskBuildDraft_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskBuildDraft TaskBuildDraft_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskBuildDraft"
    ADD CONSTRAINT "TaskBuildDraft_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public."Section"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TaskInstanceAnalytics TaskInstanceAnalytics_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskInstanceAnalytics"
    ADD CONSTRAINT "TaskInstanceAnalytics_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskInstanceAnalytics TaskInstanceAnalytics_taskInstanceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskInstanceAnalytics"
    ADD CONSTRAINT "TaskInstanceAnalytics_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES public."TaskInstance"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskInstance TaskInstance_chapterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskInstance"
    ADD CONSTRAINT "TaskInstance_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES public."Chapter"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TaskInstance TaskInstance_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskInstance"
    ADD CONSTRAINT "TaskInstance_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskInstance TaskInstance_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskInstance"
    ADD CONSTRAINT "TaskInstance_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TaskInstance TaskInstance_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskInstance"
    ADD CONSTRAINT "TaskInstance_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskInstance TaskInstance_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskInstance"
    ADD CONSTRAINT "TaskInstance_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public."Section"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TaskInstance TaskInstance_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskInstance"
    ADD CONSTRAINT "TaskInstance_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskPost TaskPost_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskPost"
    ADD CONSTRAINT "TaskPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskPost TaskPost_replyToPostId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskPost"
    ADD CONSTRAINT "TaskPost_replyToPostId_fkey" FOREIGN KEY ("replyToPostId") REFERENCES public."TaskPost"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TaskPost TaskPost_taskInstanceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaskPost"
    ADD CONSTRAINT "TaskPost_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES public."TaskInstance"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_creatorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: User User_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict GjgmzQjzW96KmqYat5KhAWc7geaaovQh5R9o1cPaYhPdMveCciu0aPtgbB6i8OZ

