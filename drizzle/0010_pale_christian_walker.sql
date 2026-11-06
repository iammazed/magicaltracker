ALTER TABLE "trip_plans" ADD COLUMN "reservation_time" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "resort_id_2" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "resort_switch_on" date;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_resort_id_2_resorts_id_fk" FOREIGN KEY ("resort_id_2") REFERENCES "public"."resorts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_split_needs_first" CHECK ("trips"."resort_id_2" is null or "trips"."resort_id" is not null);--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_split_needs_date" CHECK (("trips"."resort_id_2" is null) = ("trips"."resort_switch_on" is null));