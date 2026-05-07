import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { autoReplyConfig, youtubeCommentDraft } from "@/lib/db/schema";
import { getRecentCommentsWithReplies, postReplyToYoutubeComment } from "@/lib/youtube/server";
import type { YoutubeCommentWithReplies } from "@/lib/youtube/shared";

const MAX_CONSECUTIVE_FAILURES_BEFORE_BACKOFF = 5;

export async function getAutoReplyConfigForUser(userId: string) {
  const config = await db.query.autoReplyConfig.findFirst({
    where: eq(autoReplyConfig.userId, userId),
  });

  return config ?? null;
}

export async function upsertAutoReplyConfig(input: {
  userId: string;
  channelId: string;
  enabled?: boolean;
  intervalMinutes?: number;
  commentLimit?: number;
  daysBack?: number;
  dryRun?: boolean;
}) {
  const existing = await db.query.autoReplyConfig.findFirst({
    where: eq(autoReplyConfig.userId, input.userId),
  });

  if (existing) {
    const [updated] = await db
      .update(autoReplyConfig)
      .set({
        channelId: input.channelId,
        enabled: input.enabled !== undefined ? input.enabled : existing.enabled,
        intervalMinutes: input.intervalMinutes ?? existing.intervalMinutes,
        commentLimit: input.commentLimit ?? existing.commentLimit,
        daysBack: input.daysBack ?? existing.daysBack,
        dryRun: input.dryRun !== undefined ? input.dryRun : existing.dryRun,
      })
      .where(eq(autoReplyConfig.userId, input.userId))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(autoReplyConfig)
    .values({
      id: randomUUID(),
      userId: input.userId,
      channelId: input.channelId,
      enabled: input.enabled ?? false,
      intervalMinutes: input.intervalMinutes ?? 10,
      commentLimit: input.commentLimit ?? 3,
      daysBack: input.daysBack ?? 3,
      dryRun: input.dryRun ?? true,
    })
    .returning();

  return created;
}

export async function runAutoReplyCycleForUser(userId: string) {
  const [config] = await db
    .update(autoReplyConfig)
    .set({ lastRunAt: sql`(unixepoch())` })
    .where(
      sql`${autoReplyConfig.userId} = ${userId}
        AND ${autoReplyConfig.enabled} = ${true}
        AND ${autoReplyConfig.consecutiveFailures} < ${MAX_CONSECUTIVE_FAILURES_BEFORE_BACKOFF}
        AND (${autoReplyConfig.lastRunAt} IS NULL
          OR ${autoReplyConfig.lastRunAt} + (${autoReplyConfig.intervalMinutes} * 60) <= unixepoch())`,
    )
    .returning();

  if (!config) {
    return { skipped: true, reason: "not_due_or_not_eligible" };
  }

  try {
    const { comments } = await getRecentCommentsWithReplies(userId, {
      limit: config.commentLimit,
      daysBack: config.daysBack,
      maxScanned: 100,
    });

    const unreplied = comments.filter((c) => !c.isPosted);

    if (unreplied.length === 0) {
      await db
        .update(autoReplyConfig)
        .set({
          lastSuccessAt: new Date(),
          consecutiveFailures: 0,
          lastError: null,
        })
        .where(eq(autoReplyConfig.userId, userId));

      return { skipped: false, posted: 0, dryRun: config.dryRun };
    }

    if (config.dryRun) {
      await db
        .update(autoReplyConfig)
        .set({
          lastSuccessAt: new Date(),
          consecutiveFailures: 0,
          lastError: null,
        })
        .where(eq(autoReplyConfig.userId, userId));

      return {
        skipped: false,
        posted: 0,
        dryRun: true,
        wouldPost: unreplied.length,
        commentIds: unreplied.map((c) => c.commentId),
      };
    }

    let posted = 0;
    const errors: string[] = [];

    for (const comment of unreplied) {
      const replyText = chooseReplyText(comment);

      try {
        await postReplyToYoutubeComment({
          userId,
          commentId: comment.commentId,
          threadId: comment.threadId,
          channelId: config.channelId,
          videoId: comment.videoId,
          commentText: comment.text,
          replyText,
          customComment: comment.customComment || undefined,
        });
        posted += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push(`${comment.commentId}: ${message}`);
      }
    }

    const hasErrors = errors.length > 0;

    await db
      .update(autoReplyConfig)
      .set({
        lastSuccessAt: hasErrors ? undefined : new Date(),
        consecutiveFailures: hasErrors ? sql`consecutive_failures + 1` : 0,
        lastError: hasErrors ? errors.join(" | ") : null,
      })
      .where(eq(autoReplyConfig.userId, userId));

    return {
      skipped: false,
      posted,
      dryRun: false,
      errors: hasErrors ? errors : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await db
      .update(autoReplyConfig)
      .set({
        consecutiveFailures: sql`consecutive_failures + 1`,
        lastError: message,
      })
      .where(eq(autoReplyConfig.userId, userId));

    return { skipped: false, posted: 0, dryRun: config.dryRun, error: message };
  }
}

function chooseReplyText(comment: YoutubeCommentWithReplies): string {
  if (comment.customComment.trim().length > 0) {
    return comment.customComment;
  }

  return comment.replyOptions[0];
}

export async function runAutoReplyCycleForAllEnabledUsers() {
  const configs = await db.query.autoReplyConfig.findMany({
    where: eq(autoReplyConfig.enabled, true),
  });

  const results: Array<{
    userId: string;
    posted: number;
    dryRun: boolean;
    skipped: boolean;
    error?: string;
  }> = [];

  for (const config of configs) {
    const result = await runAutoReplyCycleForUser(config.userId);
    results.push({
      userId: config.userId,
      posted: "posted" in result ? (result.posted ?? 0) : 0,
      dryRun: "dryRun" in result ? (result.dryRun ?? true) : true,
      skipped: result.skipped,
      error: "error" in result ? result.error : undefined,
    });
  }

  return results;
}

export async function getRecentAutoReplyActivity(userId: string, limit = 10) {
  return db.query.youtubeCommentDraft.findMany({
    where: (draft, { eq, isNotNull, and }) =>
      and(eq(draft.userId, userId), isNotNull(draft.repliedAt)),
    orderBy: (draft, { desc }) => [desc(draft.repliedAt)],
    limit,
  });
}
