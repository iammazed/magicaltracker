CREATE TABLE "challenge_marks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"challenge_id" text NOT NULL,
	"step_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_marks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "challenge_marks" ADD CONSTRAINT "challenge_marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenge_marks_user_idx" ON "challenge_marks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_marks_user_step_key" ON "challenge_marks" USING btree ("user_id","challenge_id","step_id");--> statement-breakpoint
CREATE POLICY "own challenge_marks only" ON "challenge_marks" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);