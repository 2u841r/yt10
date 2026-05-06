CREATE TABLE "youtube_replied_comment" (
	"comment_id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"video_id" text,
	"user_id" text NOT NULL,
	"comment_text" text NOT NULL,
	"reply_text" text NOT NULL,
	"replied_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "youtube_replied_comment" ADD CONSTRAINT "youtube_replied_comment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "youtube_replied_comment_user_id_idx" ON "youtube_replied_comment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "youtube_replied_comment_channel_id_idx" ON "youtube_replied_comment" USING btree ("channel_id");