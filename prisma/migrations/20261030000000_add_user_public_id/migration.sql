ALTER TABLE "User" ADD COLUMN "publicId" TEXT;

-- Stable, distinct codes for existing users, including users with similar IDs.
WITH numbered_users AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "id") AS number FROM "User"
)
UPDATE "User" AS users
SET "publicId" = 'u' || numbered_users.number::text
FROM numbered_users
WHERE users."id" = numbered_users."id";

CREATE UNIQUE INDEX "User_publicId_key" ON "User"("publicId");
ALTER TABLE "User" ALTER COLUMN "publicId" SET NOT NULL;
