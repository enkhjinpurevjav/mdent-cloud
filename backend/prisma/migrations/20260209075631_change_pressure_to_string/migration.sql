-- AlterTable
-- Change pressure field from Float to String (Text in PostgreSQL)
-- Convert existing numeric values to string format
ALTER TABLE "AutoclaveCycle" ALTER COLUMN "pressure" TYPE TEXT USING CASE 
  WHEN "pressure" IS NOT NULL THEN "pressure"::TEXT 
  ELSE NULL 
END;
