/*
  Warnings:

  - You are about to drop the column `imageId` on the `persons` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "persons" DROP CONSTRAINT "persons_imageId_fkey";

-- AlterTable
ALTER TABLE "persons" DROP COLUMN "imageId";

-- CreateTable
CREATE TABLE "person_on_images" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "person_on_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "person_on_images" ADD CONSTRAINT "person_on_images_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "images"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_on_images" ADD CONSTRAINT "person_on_images_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
