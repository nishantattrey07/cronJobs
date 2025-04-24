-- CreateEnum
CREATE TYPE "JobLevel" AS ENUM ('ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT,
    "emailDomains" TEXT[],
    "staffCount" INTEGER,
    "numJobs" INTEGER NOT NULL DEFAULT 0,
    "slug" TEXT NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isRemoteFriendly" BOOLEAN NOT NULL DEFAULT false,
    "logos" JSONB,
    "website" JSONB,
    "parentSlugs" TEXT[],
    "parents" TEXT[],
    "batchInfo" TEXT,
    "dataSource" TEXT,
    "foundedAt" TIMESTAMP(3),
    "oneLiner" TEXT,
    "status" TEXT,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMarket" (
    "companyId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,

    CONSTRAINT "CompanyMarket_pkey" PRIMARY KEY ("companyId","marketId")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyStage" (
    "companyId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,

    CONSTRAINT "CompanyStage_pkey" PRIMARY KEY ("companyId","stageId")
);

-- CreateTable
CREATE TABLE "Office" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyOffice" (
    "companyId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,

    CONSTRAINT "CompanyOffice_pkey" PRIMARY KEY ("companyId","officeId")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInvestor" (
    "companyId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,

    CONSTRAINT "CompanyInvestor_pkey" PRIMARY KEY ("companyId","investorId")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "applyUrl" TEXT,
    "url" TEXT,
    "companyId" TEXT NOT NULL,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "hybrid" BOOLEAN NOT NULL DEFAULT false,
    "timeStamp" TIMESTAMP(3),
    "manager" BOOLEAN NOT NULL DEFAULT false,
    "consultant" BOOLEAN NOT NULL DEFAULT false,
    "contractor" BOOLEAN NOT NULL DEFAULT false,
    "minYearsExp" INTEGER,
    "maxYearsExp" INTEGER,
    "skills" JSONB,
    "requiredSkills" JSONB,
    "preferredSkills" JSONB,
    "departments" TEXT[],
    "jobTypes" JSONB,
    "jobFunctions" JSONB,
    "jobSeniorities" JSONB,
    "regions" JSONB,
    "dataCompleteness" TEXT NOT NULL DEFAULT 'COMPLETE',
    "dataSource" TEXT,
    "description" TEXT,
    "equityRange" TEXT,
    "roleSpecificType" TEXT,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOffice" (
    "jobId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,

    CONSTRAINT "JobOffice_pkey" PRIMARY KEY ("jobId","officeId")
);

-- CreateTable
CREATE TABLE "SalaryRange" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "currency" TEXT,
    "period" TEXT,

    CONSTRAINT "SalaryRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FangJobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "desc" TEXT,
    "date" TIMESTAMP(6),
    "location" TEXT,
    "url" TEXT,
    "company" TEXT,

    CONSTRAINT "FangJobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyFounder" (
    "companyId" TEXT NOT NULL,
    "founderId" TEXT NOT NULL,

    CONSTRAINT "CompanyFounder_pkey" PRIMARY KEY ("companyId","founderId")
);

-- CreateTable
CREATE TABLE "Founder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "twitter" TEXT,
    "linkedin" TEXT,
    "website" TEXT,

    CONSTRAINT "Founder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_numJobs_idx" ON "Company"("numJobs");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "Company_slug_idx" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_staffCount_idx" ON "Company"("staffCount");

-- CreateIndex
CREATE INDEX "Company_isRemoteFriendly_idx" ON "Company"("isRemoteFriendly");

-- CreateIndex
CREATE INDEX "Company_isFeatured_idx" ON "Company"("isFeatured");

-- CreateIndex
CREATE UNIQUE INDEX "Market_name_key" ON "Market"("name");

-- CreateIndex
CREATE INDEX "CompanyMarket_marketId_idx" ON "CompanyMarket"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_name_key" ON "Stage"("name");

-- CreateIndex
CREATE INDEX "CompanyStage_stageId_idx" ON "CompanyStage"("stageId");

-- CreateIndex
CREATE UNIQUE INDEX "Office_location_key" ON "Office"("location");

-- CreateIndex
CREATE INDEX "CompanyOffice_officeId_idx" ON "CompanyOffice"("officeId");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_name_key" ON "Investor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_slug_key" ON "Investor"("slug");

-- CreateIndex
CREATE INDEX "CompanyInvestor_investorId_idx" ON "CompanyInvestor"("investorId");

-- CreateIndex
CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");

-- CreateIndex
CREATE INDEX "Job_title_idx" ON "Job"("title");

-- CreateIndex
CREATE INDEX "Job_remote_idx" ON "Job"("remote");

-- CreateIndex
CREATE INDEX "Job_manager_idx" ON "Job"("manager");

-- CreateIndex
CREATE INDEX "Job_timeStamp_idx" ON "Job"("timeStamp");

-- CreateIndex
CREATE INDEX "Job_dataSource_idx" ON "Job"("dataSource");

-- CreateIndex
CREATE INDEX "Job_dataCompleteness_idx" ON "Job"("dataCompleteness");

-- CreateIndex
CREATE INDEX "JobOffice_officeId_idx" ON "JobOffice"("officeId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryRange_jobId_key" ON "SalaryRange"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE INDEX "CompanyFounder_founderId_idx" ON "CompanyFounder"("founderId");

-- AddForeignKey
ALTER TABLE "CompanyMarket" ADD CONSTRAINT "CompanyMarket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMarket" ADD CONSTRAINT "CompanyMarket_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyStage" ADD CONSTRAINT "CompanyStage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyStage" ADD CONSTRAINT "CompanyStage_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyOffice" ADD CONSTRAINT "CompanyOffice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyOffice" ADD CONSTRAINT "CompanyOffice_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvestor" ADD CONSTRAINT "CompanyInvestor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvestor" ADD CONSTRAINT "CompanyInvestor_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffice" ADD CONSTRAINT "JobOffice_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffice" ADD CONSTRAINT "JobOffice_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRange" ADD CONSTRAINT "SalaryRange_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyFounder" ADD CONSTRAINT "CompanyFounder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyFounder" ADD CONSTRAINT "CompanyFounder_founderId_fkey" FOREIGN KEY ("founderId") REFERENCES "Founder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
