import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth.schema";

export const autoReplyConfig = sqliteTable("auto_reply_config", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  channelId: text("channel_id").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).default(false).notNull(),
  intervalMinutes: integer("interval_minutes").default(10).notNull(),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  lastSuccessAt: integer("last_success_at", { mode: "timestamp" }),
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  commentLimit: integer("comment_limit").default(3).notNull(),
  daysBack: integer("days_back").default(3).notNull(),
  dryRun: integer("dry_run", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const autoReplyConfigRelations = relations(autoReplyConfig, ({ one }) => ({
  user: one(user, {
    fields: [autoReplyConfig.userId],
    references: [user.id],
  }),
}));

export const youtubeCommentDraft = sqliteTable(
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
    authorName: text("author_name"),
    authorAvatarUrl: text("author_avatar_url"),
    optionA: text("option_a").notNull(),
    optionB: text("option_b").notNull(),
    customComment: text("custom_comment"),
    correctionInstruction: text("correction_instruction"),
    replyText: text("reply_text"),
    generatedAt: integer("generated_at", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    repliedAt: integer("replied_at", { mode: "timestamp" }),
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
