/*
  Warnings:

  - A unique constraint covering the columns `[name,linkedin]` on the table `Founder` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Founder_name_linkedin_key" ON "Founder"("name", "linkedin");
