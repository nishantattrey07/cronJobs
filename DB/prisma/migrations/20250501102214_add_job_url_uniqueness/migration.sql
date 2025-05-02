/*
  Warnings:

  - A unique constraint covering the columns `[url,companyId]` on the table `Job` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "unique_job_url_company" ON "Job"("url", "companyId");
