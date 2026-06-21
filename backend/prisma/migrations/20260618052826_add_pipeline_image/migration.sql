/*
  Warnings:

  - Added the required column `image` to the `PipelineStep` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PipelineStep" ADD COLUMN     "image" TEXT NOT NULL;
