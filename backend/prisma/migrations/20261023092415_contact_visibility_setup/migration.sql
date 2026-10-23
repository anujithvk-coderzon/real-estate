-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "contactInappVisibility" BOOLEAN DEFAULT true,
ADD COLUMN     "contactPhoneVisibility" BOOLEAN DEFAULT true,
ADD COLUMN     "contactWatsappVisibility" BOOLEAN DEFAULT true;
