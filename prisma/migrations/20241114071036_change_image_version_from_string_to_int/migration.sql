/*
  Warnings:

  - Changed the type of `version` on the `images` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "images" ALTER COLUMN "version" TYPE INTEGER USING "version"::INTEGER;
ALTER TABLE "images" ALTER COLUMN "version" SET NOT NULL;