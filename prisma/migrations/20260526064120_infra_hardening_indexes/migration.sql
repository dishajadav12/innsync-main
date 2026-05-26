-- AlterTable
ALTER TABLE "CollectionItem" ADD COLUMN     "originalPropertyName" TEXT,
ADD COLUMN     "wasSwapped" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Booking_profileId_idx" ON "Booking"("profileId");

-- CreateIndex
CREATE INDEX "Booking_propertyId_paymentStatus_idx" ON "Booking"("propertyId", "paymentStatus");

-- CreateIndex
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");

-- CreateIndex
CREATE INDEX "Favorite_profileId_idx" ON "Favorite"("profileId");

-- CreateIndex
CREATE INDEX "Favorite_propertyId_idx" ON "Favorite"("propertyId");

-- CreateIndex
CREATE INDEX "Property_profileId_idx" ON "Property"("profileId");

-- CreateIndex
CREATE INDEX "Property_isOnHold_idx" ON "Property"("isOnHold");

-- CreateIndex
CREATE INDEX "Property_category_idx" ON "Property"("category");

-- CreateIndex
CREATE INDEX "Property_country_idx" ON "Property"("country");
