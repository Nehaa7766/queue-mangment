-- CreateEnum
CREATE TYPE "ClinicType" AS ENUM ('GENERAL', 'DENTAL', 'PEDIATRIC', 'GYNECOLOGY', 'ORTHOPEDIC', 'DERMATOLOGY', 'ENT', 'EYE', 'MULTI_SPECIALTY', 'DIAGNOSTIC', 'OTHER');

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "city" TEXT,
ADD COLUMN     "clinic_type" "ClinicType" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "pin_code" VARCHAR(6),
ADD COLUMN     "state" TEXT;

-- CreateTable
CREATE TABLE "clinic_logos" (
    "clinic_id" UUID NOT NULL,
    "content_type" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_logos_pkey" PRIMARY KEY ("clinic_id")
);

-- AddForeignKey
ALTER TABLE "clinic_logos" ADD CONSTRAINT "clinic_logos_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
