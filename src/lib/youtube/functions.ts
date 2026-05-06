import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { freshAuthMiddleware } from "@/lib/auth/middleware";
import {
  getRecentCommentsWithReplies,
  getYoutubeChannelForUser,
  postReplyToYoutubeComment,
} from "@/lib/youtube/server";

export const $getYoutubeChannel = createServerFn({ method: "GET" })
  .middleware([freshAuthMiddleware])
  .handler(async ({ context }) => {
    return getYoutubeChannelForUser(context.user.id);
  });

export const $fetchYoutubeComments = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .inputValidator(
    z.object({
      limit: z.number().int().min(1).max(20).default(10),
      daysBack: z.number().int().min(1).max(30).default(3),
    }),
  )
  .handler(async ({ context, data }) => {
    return getRecentCommentsWithReplies(context.user.id, {
      limit: data.limit,
      daysBack: data.daysBack,
      maxScanned: 100,
    });
  });

export const $postYoutubeReply = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .inputValidator(
    z.object({
      commentId: z.string().min(1),
      threadId: z.string().min(1),
      channelId: z.string().min(1),
      videoId: z.string().nullable(),
      commentText: z.string().min(1),
      replyText: z.string().min(1),
    }),
  )
  .handler(async ({ context, data }) => {
    return postReplyToYoutubeComment({
      userId: context.user.id,
      commentId: data.commentId,
      threadId: data.threadId,
      channelId: data.channelId,
      videoId: data.videoId,
      commentText: data.commentText,
      replyText: data.replyText,
    });
  });
