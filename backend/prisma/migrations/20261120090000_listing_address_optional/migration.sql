-- Property name, locality and pincode are optional on a listing.
ALTER TABLE "listings" ALTER COLUMN "addressLine" DROP NOT NULL,
ALTER COLUMN "locality" DROP NOT NULL,
ALTER COLUMN "pincode" DROP NOT NULL;
