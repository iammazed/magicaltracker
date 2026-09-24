CREATE TYPE "public"."area_kind" AS ENUM('park', 'resort_area', 'district');--> statement-breakpoint
CREATE TYPE "public"."catalog_status" AS ENUM('open', 'seasonal', 'temporarily-closed', 'permanently-closed');--> statement-breakpoint
CREATE TYPE "public"."dining_style" AS ENUM('a-la-carte', 'buffet', 'family-style', 'prix-fixe');--> statement-breakpoint
CREATE TYPE "public"."resort_tier" AS ENUM('value', 'moderate', 'deluxe', 'villa', 'campground');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('quick', 'table', 'lounge', 'snack');--> statement-breakpoint
CREATE TYPE "public"."transport_mode" AS ENUM('monorail', 'skyliner', 'bus', 'boat', 'walk');--> statement-breakpoint
CREATE TYPE "public"."venue_kind" AS ENUM('restaurant', 'lounge', 'snack', 'cart');--> statement-breakpoint
CREATE TABLE "areas" (
	"id" text PRIMARY KEY NOT NULL,
	"destination_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "area_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "areas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "destinations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resorts" (
	"id" text PRIMARY KEY NOT NULL,
	"destination_id" text NOT NULL,
	"area_id" text NOT NULL,
	"name" text NOT NULL,
	"tier" "resort_tier" NOT NULL,
	"transport" "transport_mode"[] NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"official_url" text,
	"description" text,
	"status" "catalog_status" DEFAULT 'open' NOT NULL,
	"verified_on" date,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resorts_coords_within_wdw" CHECK (("resorts"."lat" is null or ("resorts"."lat" between 28.28 and 28.44))
          and ("resorts"."lng" is null or ("resorts"."lng" between -81.65 and -81.45)))
);
--> statement-breakpoint
ALTER TABLE "resorts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "venues" (
	"id" text PRIMARY KEY NOT NULL,
	"destination_id" text NOT NULL,
	"area_id" text NOT NULL,
	"sub_area" text,
	"resort_id" text,
	"name" text NOT NULL,
	"venue_kind" "venue_kind" NOT NULL,
	"service_type" "service_type" NOT NULL,
	"dining_style" "dining_style",
	"cuisine" text NOT NULL,
	"price_tier" smallint NOT NULL,
	"accepts_reservations" boolean DEFAULT false NOT NULL,
	"is_character_dining" boolean DEFAULT false NOT NULL,
	"is_signature" boolean DEFAULT false NOT NULL,
	"status" "catalog_status" DEFAULT 'open' NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"menu_url" text,
	"description" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"verified_on" date,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_price_tier_range" CHECK ("venues"."price_tier" between 1 and 4),
	CONSTRAINT "venues_coords_within_wdw" CHECK (("venues"."lat" is null or ("venues"."lat" between 28.28 and 28.44))
          and ("venues"."lng" is null or ("venues"."lng" between -81.65 and -81.45)))
);
--> statement-breakpoint
ALTER TABLE "venues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resorts" ADD CONSTRAINT "resorts_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resorts" ADD CONSTRAINT "resorts_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_resort_id_resorts_id_fk" FOREIGN KEY ("resort_id") REFERENCES "public"."resorts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "areas_destination_idx" ON "areas" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "resorts_area_idx" ON "resorts" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "resorts_status_idx" ON "resorts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venues_area_idx" ON "venues" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "venues_resort_idx" ON "venues" USING btree ("resort_id");--> statement-breakpoint
CREATE INDEX "venues_service_type_idx" ON "venues" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "venues_status_idx" ON "venues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venues_tags_idx" ON "venues" USING gin ("tags");--> statement-breakpoint
CREATE POLICY "anyone can read areas" ON "areas" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "anyone can read destinations" ON "destinations" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "anyone can read resorts" ON "resorts" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "anyone can read venues" ON "venues" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);