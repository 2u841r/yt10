ALTER TABLE "youtube_replied_comment" ADD COLUMN "option_a" text;
--> statement-breakpoint
ALTER TABLE "youtube_replied_comment" ADD COLUMN "option_b" text;
--> statement-breakpoint
ALTER TABLE "youtube_replied_comment" ADD COLUMN "custom_comment" text;
--> statement-breakpoint
ALTER TABLE "youtube_replied_comment" ADD COLUMN "correction_instruction" text;
--> statement-breakpoint
ALTER TABLE "youtube_replied_comment" ADD COLUMN "generated_at" timestamp DEFAULT now();
--> statement-breakpoint
UPDATE "youtube_replied_comment"
SET
  "option_a" = COALESCE("option_a", "reply_text"),
  "option_b" = COALESCE("option_b", "reply_text"),
  "generated_at" = COALESCE("generated_at", "replied_at");
--> statement-breakpoint
ALTER TABLE "youtube_replied_comment" ALTER COLUMN "option_a" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "youtube_replied_comment" ALTER COLUMN "option_b" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "youtube_replied_comment" ALTER COLUMN "generated_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "youtube_replied_comment" ALTER COLUMN "reply_text" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "youtube_replied_comment" ALTER COLUMN "replied_at" DROP NOT NULL;
