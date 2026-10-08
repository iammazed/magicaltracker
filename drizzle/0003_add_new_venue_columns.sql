ALTER TABLE "venues" ADD COLUMN "reservations_recommended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "is_character_dinner_dining" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "is_character_breakfast_dining" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "dinner_menu_url" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "lunch_menu_url" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "breakfast_menu_url" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "snack_menu_url" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "lounge_menu_url" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "keywords" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "venues_keywords_idx" ON "venues" USING gin ("keywords");