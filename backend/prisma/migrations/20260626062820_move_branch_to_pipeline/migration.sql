/*
  Warnings:

  - You are about to drop the column `branch` on the `PipelineRun` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Pipeline" ADD COLUMN     "branch" TEXT NOT NULL DEFAULT 'main';

-- AlterTable
ALTER TABLE "PipelineRun" DROP COLUMN "branch";
