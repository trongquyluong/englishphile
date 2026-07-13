-- Migration: add_security_rate_limits
-- Date: 2026-07-11
-- Phase 1B Security Remediation
--
-- This migration adds three new tables for security features:
-- 1. RateLimitBucket - Database-backed rate limiting for serverless deployments
-- 2. ContestAccessGrant - Access grants for private contests (replaces URL-based access codes)
-- 3. WritingQuotaReservation - Reservation system to prevent race conditions in daily writing quotas
--
-- Also adds accessCodeUpdatedAt field to Contest for grant invalidation.

-- Add security rate limit bucket table
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RateLimitBucket_count_check" CHECK ("count" >= 1)
);

-- Create unique index on action + subject
CREATE UNIQUE INDEX "RateLimitBucket_action_subject_key" ON "RateLimitBucket"("action", "subject");

-- Create index on expiresAt for cleanup
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- Add security contest access grant table
CREATE TABLE "ContestAccessGrant" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContestAccessGrant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContestAccessGrant_contestId_fkey"
        FOREIGN KEY ("contestId")
        REFERENCES "Contest"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT "ContestAccessGrant_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "User"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Create indexes for access grant
CREATE INDEX "ContestAccessGrant_expiresAt_idx" ON "ContestAccessGrant"("expiresAt");
CREATE INDEX "ContestAccessGrant_userId_contestId_idx" ON "ContestAccessGrant"("userId", "contestId");

-- Add security writing quota reservation table
-- Design: 5 slots per user per day, enforced by database unique constraint
-- slotNumber is 1-5, enforced by CHECK constraint
CREATE TYPE "WritingQuotaReservationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "WritingQuotaReservation" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "quota_date" DATE NOT NULL,
    "slot_number" INTEGER NOT NULL,
    "status" "WritingQuotaReservationStatus" NOT NULL DEFAULT 'PENDING',
    "provider_started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failure_code" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WritingQuotaReservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WritingQuotaReservation_slot_number_check"
        CHECK ("slot_number" >= 1 AND "slot_number" <= 5),
    CONSTRAINT "WritingQuotaReservation_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "User"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Create unique index on userId + quotaDate + slotNumber
-- This is the key constraint that enforces the 5-slot daily limit atomically
CREATE UNIQUE INDEX "WritingQuotaReservation_userId_quotaDate_slotNumber_key"
    ON "WritingQuotaReservation"("userId", "quota_date", "slot_number");

-- Create indexes for reservation management
CREATE INDEX "WritingQuotaReservation_expiresAt_idx" ON "WritingQuotaReservation"("expires_at");
CREATE INDEX "WritingQuotaReservation_status_idx" ON "WritingQuotaReservation"("status");
CREATE INDEX "WritingQuotaReservation_userId_quotaDate_idx"
    ON "WritingQuotaReservation"("userId", "quota_date");
-- Composite index used by bounded cleanup predicates.
CREATE INDEX "WritingQuotaReservation_cleanup_idx"
    ON "WritingQuotaReservation"("status", "expires_at", "provider_started_at");

-- Add accessCodeUpdatedAt field to Contest for grant invalidation
ALTER TABLE "Contest" ADD COLUMN "accessCodeUpdatedAt" TIMESTAMP(3);

-- Create index for contest access code changes
CREATE INDEX "Contest_accessCodeUpdatedAt_idx" ON "Contest"("accessCodeUpdatedAt");
