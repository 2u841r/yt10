import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

import { user } from "./auth.schema";

export const youtubeCommentDraft = pgTable(
  "youtube_replied_comment",
  {
    commentId: text("comment_id").primaryKey(),
    threadId: text("thread_id").notNull(),
    channelId: text("channel_id").notNull(),
    videoId: text("video_id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    commentText: text("comment_text").notNull(),
    optionA: text("option_a").notNull(),
    optionB: text("option_b").notNull(),
    customComment: text("custom_comment"),
    correctionInstruction: text("correction_instruction"),
    replyText: text("reply_text"),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    repliedAt: timestamp("replied_at"),
  },
  (table) => [
    index("youtube_replied_comment_user_id_idx").on(table.userId),
    index("youtube_replied_comment_channel_id_idx").on(table.channelId),
  ],
);

export const youtubeCommentDraftRelations = relations(youtubeCommentDraft, ({ one }) => ({
  user: one(user, {
    fields: [youtubeCommentDraft.userId],
    references: [user.id],
  }),
}));
