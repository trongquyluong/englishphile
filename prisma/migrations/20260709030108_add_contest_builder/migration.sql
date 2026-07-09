-- AlterEnum
ALTER TYPE "SkillType" ADD VALUE 'USE_OF_ENGLISH';

-- CreateTable
CREATE TABLE "ContestSection" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "skillType" "SkillType" NOT NULL DEFAULT 'USE_OF_ENGLISH',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "instructions" TEXT,
    "points" DOUBLE PRECISION,
    "audioUrl" TEXT,
    "transcript" TEXT,
    "passageText" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestQuestion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "type" "QuestionType" NOT NULL DEFAULT 'MCQ',
    "prompt" TEXT,
    "optionsJson" JSONB,
    "answerJson" JSONB,
    "points" DOUBLE PRECISION,
    "explanation" TEXT,
    "rootWord" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestQuestion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContestSection" ADD CONSTRAINT "ContestSection_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestQuestion" ADD CONSTRAINT "ContestQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ContestSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
