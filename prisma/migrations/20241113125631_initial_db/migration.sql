-- CreateTable
CREATE TABLE "medias" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "dropbox_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "event" TEXT,

    CONSTRAINT "medias_pkey" PRIMARY KEY ("id")
);
