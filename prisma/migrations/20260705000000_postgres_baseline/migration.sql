-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SkillType" AS ENUM ('PRONUNCIATION', 'MULTIPLE_CHOICE', 'OPEN_CLOZE', 'GUIDED_CLOZE', 'WORD_FORMATION', 'SENTENCE_TRANSFORMATION', 'ERROR_IDENTIFICATION', 'READING', 'WRITING', 'LISTENING', 'TRIOS', 'COLLOCATIONS', 'PHRASAL_VERBS', 'TRANSITIONS', 'GRAMMAR_FOCUS');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('PRONUNCIATION_ODD_ONE_OUT', 'MCQ', 'OPEN_CLOZE', 'GUIDED_CLOZE', 'WORD_FORMATION', 'SENTENCE_TRANSFORMATION', 'ERROR_IDENTIFICATION', 'READING_MCQ', 'LISTENING_MCQ', 'LISTENING_SHORT_ANSWER', 'WRITING_PROMPT', 'TRIOS_GAPPED_SENTENCES', 'SHORT_ANSWER');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('B2', 'C1', 'C2', 'CHUYEN', 'HSG');

-- CreateEnum
CREATE TYPE "SubmissionMode" AS ENUM ('SINGLE_PROBLEM', 'RANDOM_PRACTICE', 'MOCK_TEST');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('ACCEPTED', 'WRONG_ANSWER', 'PARTIAL', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('NOT_ATTEMPTED', 'ATTEMPTED', 'SOLVED', 'WRONG', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PDF', 'DOCX', 'CSV', 'JSON', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('JSON', 'CSV');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('VALIDATED', 'IMPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentPackStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PARTIALLY_IMPORTED', 'IMPORTED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClassroomRole" AS ENUM ('STUDENT', 'ASSISTANT', 'TEACHER');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('PRACTICE_SET', 'MOCK_TEST', 'HOMEWORK', 'REVIEW_SET');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssignmentSubmissionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'LATE', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "ManualGradeCorrectness" AS ENUM ('CORRECT', 'INCORRECT', 'PARTIAL', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "DiagnosticAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('NEXT_PROBLEM', 'SKILL_FOCUS', 'TOPIC_REVIEW', 'WRONG_QUESTION_RETRY', 'CHALLENGE', 'DIAGNOSTIC_RETAKE');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('ACTIVE', 'DISMISSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ContestType" AS ENUM ('PAST_EXAM', 'LIVE_CONTEST', 'PRACTICE_CONTEST');

-- CreateEnum
CREATE TYPE "ContestStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContestVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- CreateEnum
CREATE TYPE "ContestAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'LATE', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "fullName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetExam" TEXT,
    "schoolTarget" TEXT,
    "school" TEXT,
    "province" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "level" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceCollection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "originalFileName" TEXT,
    "sourceType" "SourceType" NOT NULL DEFAULT 'MANUAL',
    "copyrightNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "skillType" "SkillType" NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "sourceCollectionId" TEXT,
    "statement" TEXT NOT NULL,
    "instructions" TEXT,
    "estimatedMinutes" INTEGER,
    "acceptanceRate" DOUBLE PRECISION,
    "isDiagnosticEligible" BOOLEAN NOT NULL DEFAULT false,
    "diagnosticWeight" INTEGER NOT NULL DEFAULT 1,
    "recommendedMinLevel" "Difficulty",
    "recommendedMaxLevel" "Difficulty",
    "contentStatus" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "importedBatchId" TEXT,
    "contentPackId" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "skillType" "SkillType" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "prompt" TEXT NOT NULL,
    "passage" TEXT,
    "options" JSONB,
    "answer" JSONB NOT NULL,
    "explanation" TEXT,
    "rootWord" TEXT,
    "keyword" TEXT,
    "targetSentence" TEXT,
    "lineNumber" INTEGER,
    "metadata" JSONB,
    "contentStatus" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemTopic" (
    "problemId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "ProblemTopic_pkey" PRIMARY KEY ("problemId","topicId")
);

-- CreateTable
CREATE TABLE "TheoryNote" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "skillType" "SkillType",
    "topicId" TEXT,
    "content" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TheoryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "mode" "SubmissionMode" NOT NULL,
    "status" "SubmissionStatus" NOT NULL,
    "score" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "studentAnswer" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualGrade" (
    "id" TEXT NOT NULL,
    "submissionAnswerId" TEXT NOT NULL,
    "gradedById" TEXT NOT NULL,
    "correctness" "ManualGradeCorrectness" NOT NULL,
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "feedback" TEXT,
    "rubricJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProblemStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "status" "ProblemStatus" NOT NULL DEFAULT 'NOT_ATTEMPTED',
    "bestScore" DOUBLE PRECISION,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProblemStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceCollectionId" TEXT,
    "importType" "ImportType" NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "summary" JSONB NOT NULL,
    "errorLog" JSONB,
    "contentPackId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "description" TEXT,
    "manifestJson" JSONB,
    "fileName" TEXT,
    "status" "ContentPackStatus" NOT NULL DEFAULT 'DRAFT',
    "importedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DiagnosticAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "estimatedLevel" "Difficulty",
    "skillBreakdownJson" JSONB,
    "topicBreakdownJson" JSONB,
    "recommendationJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkillProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillType" "SkillType" NOT NULL,
    "estimatedLevel" "Difficulty",
    "accuracy" DOUBLE PRECISION,
    "attempted" INTEGER NOT NULL DEFAULT 0,
    "correct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkillProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTopicProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "estimatedLevel" "Difficulty",
    "accuracy" DOUBLE PRECISION,
    "attempted" INTEGER NOT NULL DEFAULT 0,
    "correct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTopicProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recommendationType" "RecommendationType" NOT NULL,
    "skillType" "SkillType",
    "topicId" TEXT,
    "problemId" TEXT,
    "reason" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "contestType" "ContestType" NOT NULL DEFAULT 'PRACTICE_CONTEST',
    "status" "ContestStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "ContestVisibility" NOT NULL DEFAULT 'PUBLIC',
    "durationMinutes" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sourceName" TEXT,
    "rules" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestProblem" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "points" DOUBLE PRECISION,

    CONSTRAINT "ContestProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestAttempt" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ContestAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "timeSpentSeconds" INTEGER,
    "answersJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "teacherId" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomMember" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ClassroomRole" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "classroomId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignmentType" "AssignmentType" NOT NULL DEFAULT 'PRACTICE_SET',
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "dueAt" TIMESTAMP(3),
    "timeLimitMinutes" INTEGER,
    "allowLateSubmission" BOOLEAN NOT NULL DEFAULT true,
    "showAnswersAfterSubmit" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentProblem" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "points" DOUBLE PRECISION,

    CONSTRAINT "AssignmentProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AssignmentSubmissionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "timeSpentSeconds" INTEGER,
    "answers" JSONB,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentProblemSubmission" (
    "id" TEXT NOT NULL,
    "assignmentSubmissionId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "submissionId" TEXT,
    "score" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "status" "SubmissionStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentProblemSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_slug_key" ON "Problem"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TheoryNote_slug_key" ON "TheoryNote"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ManualGrade_submissionAnswerId_key" ON "ManualGrade"("submissionAnswerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProblemStatus_userId_problemId_key" ON "UserProblemStatus"("userId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkillProfile_userId_skillType_key" ON "UserSkillProfile"("userId", "skillType");

-- CreateIndex
CREATE UNIQUE INDEX "UserTopicProfile_userId_topicId_key" ON "UserTopicProfile"("userId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "Contest_slug_key" ON "Contest"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ContestProblem_contestId_problemId_key" ON "ContestProblem"("contestId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_joinCode_key" ON "Classroom"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomMember_classroomId_userId_key" ON "ClassroomMember"("classroomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentProblem_assignmentId_problemId_key" ON "AssignmentProblem"("assignmentId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_userId_key" ON "AssignmentSubmission"("assignmentId", "userId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_sourceCollectionId_fkey" FOREIGN KEY ("sourceCollectionId") REFERENCES "SourceCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_importedBatchId_fkey" FOREIGN KEY ("importedBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_contentPackId_fkey" FOREIGN KEY ("contentPackId") REFERENCES "ContentPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemTopic" ADD CONSTRAINT "ProblemTopic_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemTopic" ADD CONSTRAINT "ProblemTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheoryNote" ADD CONSTRAINT "TheoryNote_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAnswer" ADD CONSTRAINT "SubmissionAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAnswer" ADD CONSTRAINT "SubmissionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualGrade" ADD CONSTRAINT "ManualGrade_submissionAnswerId_fkey" FOREIGN KEY ("submissionAnswerId") REFERENCES "SubmissionAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualGrade" ADD CONSTRAINT "ManualGrade_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProblemStatus" ADD CONSTRAINT "UserProblemStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProblemStatus" ADD CONSTRAINT "UserProblemStatus_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_sourceCollectionId_fkey" FOREIGN KEY ("sourceCollectionId") REFERENCES "SourceCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_contentPackId_fkey" FOREIGN KEY ("contentPackId") REFERENCES "ContentPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPack" ADD CONSTRAINT "ContentPack_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAuditLog" ADD CONSTRAINT "ContentAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticAttempt" ADD CONSTRAINT "DiagnosticAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkillProfile" ADD CONSTRAINT "UserSkillProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTopicProfile" ADD CONSTRAINT "UserTopicProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTopicProfile" ADD CONSTRAINT "UserTopicProfile_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningRecommendation" ADD CONSTRAINT "LearningRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningRecommendation" ADD CONSTRAINT "LearningRecommendation_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningRecommendation" ADD CONSTRAINT "LearningRecommendation_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestProblem" ADD CONSTRAINT "ContestProblem_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestProblem" ADD CONSTRAINT "ContestProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestAttempt" ADD CONSTRAINT "ContestAttempt_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestAttempt" ADD CONSTRAINT "ContestAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMember" ADD CONSTRAINT "ClassroomMember_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMember" ADD CONSTRAINT "ClassroomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentProblem" ADD CONSTRAINT "AssignmentProblem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentProblem" ADD CONSTRAINT "AssignmentProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentProblemSubmission" ADD CONSTRAINT "AssignmentProblemSubmission_assignmentSubmissionId_fkey" FOREIGN KEY ("assignmentSubmissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentProblemSubmission" ADD CONSTRAINT "AssignmentProblemSubmission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentProblemSubmission" ADD CONSTRAINT "AssignmentProblemSubmission_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

