ALTER TABLE "trip_days" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "trip_days" ADD CONSTRAINT "trip_days_kind_known" CHECK ("trip_days"."kind" is null or "trip_days"."kind" in ('rest', 'resort'));--> statement-breakpoint
ALTER TABLE "trip_days" ADD CONSTRAINT "trip_days_kind_xor_area" CHECK ("trip_days"."kind" is null or "trip_days"."area_id" is null);