CREATE TYPE "public"."ownership" AS ENUM('disney-owned', 'partner');--> statement-breakpoint
ALTER TYPE "public"."dining_style" ADD VALUE 'snack';--> statement-breakpoint
ALTER TYPE "public"."transport_mode" ADD VALUE 'shuttle';--> statement-breakpoint
ALTER TYPE "public"."venue_kind" ADD VALUE 'kiosk';--> statement-breakpoint
ALTER TYPE "public"."venue_kind" ADD VALUE 'food-truck';--> statement-breakpoint
ALTER TYPE "public"."venue_kind" ADD VALUE 'event';--> statement-breakpoint
ALTER TABLE "venues" ALTER COLUMN "service_type" SET DATA TYPE "public"."service_type"[] USING "service_type"::text::"public"."service_type"[];--> statement-breakpoint
ALTER TABLE "venues" ALTER COLUMN "dining_style" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "venues" ALTER COLUMN "dining_style" SET DATA TYPE "public"."dining_style"[] USING "dining_style"::text::"public"."dining_style"[];--> statement-breakpoint
ALTER TABLE "venues" ALTER COLUMN "dining_style" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "venues" ALTER COLUMN "dining_style" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ALTER COLUMN "cuisine" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resorts" ADD COLUMN "ownership" "ownership" DEFAULT 'disney-owned' NOT NULL;--> statement-breakpoint
CREATE INDEX "venues_kind_idx" ON "venues" USING btree ("venue_kind");--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN "accepts_reservations";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN "is_character_dining";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN "menu_url";