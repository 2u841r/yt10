import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

import { user } from "./auth.schema";

export const youtubeRepliedComment = pgTable(
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
    replyText: text("reply_text").notNull(),
    repliedAt: timestamp("replied_at").defaultNow().notNull(),
  },
  (table) => [
    index("youtube_replied_comment_user_id_idx").on(table.userId),
    index("youtube_replied_comment_channel_id_idx").on(table.channelId),
  ],
);

export const youtubeRepliedCommentRelations = relations(youtubeRepliedComment, ({ one }) => ({
  user: one(user, {
    fields: [youtubeRepliedComment.userId],
    references: [user.id],
  }),
}));
