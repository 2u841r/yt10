import "@tanstack/react-start/server-only";
import { and, eq, inArray } from "drizzle-orm";

import { env } from "@/env/server";
import { db } from "@/lib/db";
import { account, youtubeCommentDraft } from "@/lib/db/schema";

const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

export interface YoutubeChannel {
  id: string;
  title: string;
  thumbnailUrl: string | null;
}

export interface YoutubeCommentWithReplies {
  threadId: string;
  commentId: string;
  videoId: string | null;
  author: string;
  text: string;
  publishedAt: string;
  replyOptions: [string, string];
  customComment: string;
  correctionInstruction: string;
  isPosted: boolean;
  postedReply: string | null;
}

export const YOUTUBE_COMMENT_UNAVAILABLE_MESSAGE =
  "Original YouTube comment is no longer available. It may have been deleted.";

interface GoogleAccountTokenState {
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
}

function ensureEnvValue(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is missing`);
  }

  return value;
}

async function getGoogleAccount(userId: string) {
  const googleAccount = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, "google")),
  });

  if (!googleAccount) {
    throw new Error("No Google account is linked to this user.");
  }

  return googleAccount;
}

async function refreshGoogleAccessToken(
  googleAccountId: string,
  refreshToken: string,
): Promise<GoogleAccountTokenState> {
  const clientId = ensureEnvValue(env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
  const clientSecret = ensureEnvValue(env.GOOGLE_CLIENT_SECRET, "GOOGLE_CLIENT_SECRET");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh Google access token: ${text}`);
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };

  const nextState = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? refreshToken,
    accessTokenExpiresAt: payload.expires_in
      ? new Date(Date.now() + payload.expires_in * 1000)
      : null,
  };

  await db
    .update(account)
    .set({
      accessToken: nextState.accessToken,
      refreshToken: nextState.refreshToken,
      accessTokenExpiresAt: nextState.accessTokenExpiresAt,
    })
    .where(eq(account.id, googleAccountId));

  return nextState;
}

async function getUsableGoogleAccessToken(userId: string) {
  const googleAccount = await getGoogleAccount(userId);
  const scope = googleAccount.scope ?? "";

  if (!scope.includes(YOUTUBE_SCOPE)) {
    throw new Error(
      "Google account is missing YouTube scope. Sign in again to grant YouTube access.",
    );
  }

  const now = Date.now();
  const expiresAt = googleAccount.accessTokenExpiresAt?.getTime() ?? null;
  const hasFreshAccessToken = googleAccount.accessToken && (!expiresAt || expiresAt - now > 60_000);

  if (hasFreshAccessToken) {
    return {
      accessToken: googleAccount.accessToken!,
      scope,
    };
  }

  if (!googleAccount.refreshToken) {
    throw new Error("Google account has no refresh token. Sign in again to grant offline access.");
  }

  const refreshed = await refreshGoogleAccessToken(googleAccount.id, googleAccount.refreshToken);

  return {
    accessToken: refreshed.accessToken,
    scope,
  };
}

async function fetchYoutube<T>(
  accessToken: string,
  path: string,
  searchParams: Record<string, string>,
) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);

  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`YouTube API request failed: ${text}`);
  }

  return (await response.json()) as T;
}

function isUnavailableYoutubeCommentResponse(status: number, text: string) {
  const normalized = text.toLowerCase();

  return (
    status === 404 ||
    normalized.includes("commentnotfound") ||
    normalized.includes("parentcomment") ||
    normalized.includes("not found") ||
    normalized.includes("video comment not found")
  );
}

function stripCodeFence(text: string) {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function generateReplyOptions(
  commentText: string,
  options?: {
    customComment?: string;
    correctionInstruction?: string;
  },
) {
  const apiKey = ensureEnvValue(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");
  const model = ensureEnvValue(env.OPENROUTER_MODEL, "OPENROUTER_MODEL");
  const customComment = options?.customComment?.trim();
  const correctionInstruction = options?.correctionInstruction?.trim();

  const prompt = [
    "You are a YouTube channel owner replying to a comment.",
    "Write exactly 2 distinct short reply options.",
    "Match the comment language exactly.",
    "Keep each option natural, warm, and under 220 characters.",
    "If the comment asks for facts, use current accurate information and correct outdated assumptions politely.",
    "No hashtags. No markdown. No labels inside the values.",
    'Return strict JSON: {"optionA":"...","optionB":"..."}',
    ...(customComment
      ? [
          `Custom rewrite request from channel owner: ${customComment}`,
          "Use that request to revise both options.",
        ]
      : []),
    ...(correctionInstruction
      ? [
          `Correction instruction from channel owner: ${correctionInstruction}`,
          "If the previous answer was wrong or outdated, fix it.",
        ]
      : []),
    `Comment: ${commentText}`,
  ].join("\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 220,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter request failed: ${text}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const raw = payload.choices?.[0]?.message?.content?.trim();

  if (!raw) {
    throw new Error("OpenRouter returned no reply content.");
  }

  const parsed = JSON.parse(stripCodeFence(raw)) as {
    optionA?: string;
    optionB?: string;
  };

  const optionA = parsed.optionA?.trim();
  const optionB = parsed.optionB?.trim();

  if (!optionA || !optionB) {
    throw new Error("OpenRouter response did not include two valid reply options.");
  }

  return [optionA, optionB] as [string, string];
}

export async function getYoutubeChannelForUser(userId: string): Promise<YoutubeChannel> {
  const { accessToken } = await getUsableGoogleAccessToken(userId);
  const payload = await fetchYoutube<{
    items?: Array<{
      id: string;
      snippet?: {
        title?: string;
        thumbnails?: {
          default?: { url?: string };
          medium?: { url?: string };
          high?: { url?: string };
        };
      };
    }>;
  }>(accessToken, "channels", {
    part: "snippet",
    mine: "true",
  });

  const channel = payload.items?.[0];

  if (!channel) {
    throw new Error("No YouTube channel found for this Google account.");
  }

  return {
    id: channel.id,
    title: channel.snippet?.title ?? "Untitled channel",
    thumbnailUrl:
      channel.snippet?.thumbnails?.high?.url ??
      channel.snippet?.thumbnails?.medium?.url ??
      channel.snippet?.thumbnails?.default?.url ??
      null,
  };
}

export async function getRecentCommentsWithReplies(
  userId: string,
  options?: {
    limit?: number;
    daysBack?: number;
    maxScanned?: number;
  },
): Promise<{
  channel: YoutubeChannel;
  comments: YoutubeCommentWithReplies[];
}> {
  const { accessToken } = await getUsableGoogleAccessToken(userId);
  const channel = await getYoutubeChannelForUser(userId);
  const limit = options?.limit ?? 10;
  const daysBack = options?.daysBack ?? 3;
  const maxScanned = options?.maxScanned ?? 100;
  const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const unansweredComments: Array<{
    threadId: string;
    commentId: string;
    videoId: string | null;
    author: string;
    text: string;
    publishedAt: string;
  }> = [];

  let pageToken: string | undefined;
  let scanned = 0;
  let stopScanning = false;

  while (unansweredComments.length < limit && scanned < maxScanned && !stopScanning) {
    const pageSize = Math.min(50, maxScanned - scanned);
    const payload = await fetchYoutube<{
      nextPageToken?: string;
      items?: Array<{
        id: string;
        snippet?: {
          videoId?: string;
          totalReplyCount?: number;
          topLevelComment?: {
            id: string;
            snippet?: {
              authorDisplayName?: string;
              textDisplay?: string;
              publishedAt?: string;
            };
          };
        };
      }>;
    }>(accessToken, "commentThreads", {
      part: "snippet",
      allThreadsRelatedToChannelId: channel.id,
      maxResults: String(pageSize),
      order: "time",
      textFormat: "plainText",
      ...(pageToken ? { pageToken } : {}),
    });

    const items = payload.items ?? [];

    for (const item of items) {
      scanned += 1;

      const publishedAt = item.snippet?.topLevelComment?.snippet?.publishedAt ?? "";
      const publishedTime = publishedAt ? new Date(publishedAt).getTime() : 0;

      if (!publishedTime || publishedTime < cutoffTime) {
        stopScanning = true;
        break;
      }

      if ((item.snippet?.totalReplyCount ?? 0) > 0) {
        continue;
      }

      const commentId = item.snippet?.topLevelComment?.id ?? "";
      const text = item.snippet?.topLevelComment?.snippet?.textDisplay ?? "";

      if (!commentId || !text) {
        continue;
      }

      unansweredComments.push({
        threadId: item.id,
        commentId,
        videoId: item.snippet?.videoId ?? null,
        author: item.snippet?.topLevelComment?.snippet?.authorDisplayName ?? "Unknown author",
        text,
        publishedAt,
      });

      if (unansweredComments.length >= limit) {
        break;
      }
    }

    if (!payload.nextPageToken || items.length === 0) {
      break;
    }

    pageToken = payload.nextPageToken;
  }

  const existingDrafts =
    unansweredComments.length === 0
      ? []
      : await db.query.youtubeCommentDraft.findMany({
          where: and(
            eq(youtubeCommentDraft.userId, userId),
            inArray(
              youtubeCommentDraft.commentId,
              unansweredComments.map((comment) => comment.commentId),
            ),
          ),
        });

  const draftMap = new Map(existingDrafts.map((entry) => [entry.commentId, entry]));

  const withReplies = await Promise.all(
    unansweredComments.map(async (comment) => {
      const existingDraft = draftMap.get(comment.commentId);
      const draft =
        existingDraft ??
        (await createYoutubeCommentDraft({
          userId,
          channelId: channel.id,
          threadId: comment.threadId,
          commentId: comment.commentId,
          videoId: comment.videoId,
          commentText: comment.text,
        }));

      return {
        ...comment,
        replyOptions: [draft.optionA, draft.optionB] as [string, string],
        customComment: draft.customComment ?? "",
        correctionInstruction: draft.correctionInstruction ?? "",
        isPosted: Boolean(draft.replyText),
        postedReply: draft.replyText ?? null,
      };
    }),
  );

  return {
    channel,
    comments: withReplies,
  };
}

async function createYoutubeCommentDraft(args: {
  userId: string;
  channelId: string;
  threadId: string;
  commentId: string;
  videoId: string | null;
  commentText: string;
  customComment?: string;
  correctionInstruction?: string;
}) {
  const replyOptions = await generateReplyOptions(args.commentText, {
    customComment: args.customComment,
    correctionInstruction: args.correctionInstruction,
  });

  const [draft] = await db
    .insert(youtubeCommentDraft)
    .values({
      userId: args.userId,
      channelId: args.channelId,
      threadId: args.threadId,
      commentId: args.commentId,
      videoId: args.videoId,
      commentText: args.commentText,
      optionA: replyOptions[0],
      optionB: replyOptions[1],
      customComment: args.customComment?.trim() || null,
      correctionInstruction: args.correctionInstruction?.trim() || null,
    })
    .onConflictDoNothing()
    .returning();

  if (draft) {
    return draft;
  }

  const existingDraft = await db.query.youtubeCommentDraft.findFirst({
    where: and(
      eq(youtubeCommentDraft.userId, args.userId),
      eq(youtubeCommentDraft.commentId, args.commentId),
    ),
  });

  if (!existingDraft) {
    throw new Error("Failed to persist generated YouTube reply options.");
  }

  return existingDraft;
}

export async function regenerateYoutubeCommentDraft(args: {
  userId: string;
  channelId: string;
  threadId: string;
  commentId: string;
  videoId: string | null;
  commentText: string;
  customComment?: string;
  correctionInstruction?: string;
}) {
  const replyOptions = await generateReplyOptions(args.commentText, {
    customComment: args.customComment,
    correctionInstruction: args.correctionInstruction,
  });

  const existingDraft = await db.query.youtubeCommentDraft.findFirst({
    where: and(
      eq(youtubeCommentDraft.userId, args.userId),
      eq(youtubeCommentDraft.commentId, args.commentId),
    ),
  });

  if (!existingDraft) {
    return createYoutubeCommentDraft(args);
  }

  const [updatedDraft] = await db
    .update(youtubeCommentDraft)
    .set({
      threadId: args.threadId,
      channelId: args.channelId,
      videoId: args.videoId,
      commentText: args.commentText,
      optionA: replyOptions[0],
      optionB: replyOptions[1],
      customComment: args.customComment?.trim() || null,
      correctionInstruction: args.correctionInstruction?.trim() || null,
      generatedAt: new Date(),
    })
    .where(
      and(
        eq(youtubeCommentDraft.userId, args.userId),
        eq(youtubeCommentDraft.commentId, args.commentId),
      ),
    )
    .returning();

  if (!updatedDraft) {
    throw new Error("Failed to update generated YouTube reply options.");
  }

  return updatedDraft;
}

export async function postReplyToYoutubeComment(args: {
  userId: string;
  commentId: string;
  threadId: string;
  channelId: string;
  videoId: string | null;
  commentText: string;
  replyText: string;
  customComment?: string;
}) {
  const existingDraft = await db.query.youtubeCommentDraft.findFirst({
    where: and(
      eq(youtubeCommentDraft.userId, args.userId),
      eq(youtubeCommentDraft.commentId, args.commentId),
    ),
  });

  if (existingDraft?.replyText) {
    return existingDraft;
  }

  const { accessToken } = await getUsableGoogleAccessToken(args.userId);

  const response = await fetch("https://www.googleapis.com/youtube/v3/comments?part=snippet", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        parentId: args.commentId,
        textOriginal: args.replyText,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();

    if (isUnavailableYoutubeCommentResponse(response.status, text)) {
      await db
        .delete(youtubeCommentDraft)
        .where(
          and(
            eq(youtubeCommentDraft.userId, args.userId),
            eq(youtubeCommentDraft.commentId, args.commentId),
          ),
        );

      throw new Error(YOUTUBE_COMMENT_UNAVAILABLE_MESSAGE);
    }

    throw new Error(`Failed to post YouTube reply: ${text}`);
  }

  await response.json();

  const [saved] = await db
    .update(youtubeCommentDraft)
    .set({
      threadId: args.threadId,
      channelId: args.channelId,
      videoId: args.videoId,
      commentText: args.commentText,
      customComment: args.customComment?.trim() || null,
      replyText: args.replyText,
      repliedAt: new Date(),
    })
    .where(
      and(
        eq(youtubeCommentDraft.userId, args.userId),
        eq(youtubeCommentDraft.commentId, args.commentId),
      ),
    )
    .returning();

  if (saved) {
    return saved;
  }

  const draft = await createYoutubeCommentDraft({
    userId: args.userId,
    channelId: args.channelId,
    threadId: args.threadId,
    commentId: args.commentId,
    videoId: args.videoId,
    commentText: args.commentText,
  });

  const [insertedAfterGenerate] = await db
    .update(youtubeCommentDraft)
    .set({
      optionA: draft.optionA,
      optionB: draft.optionB,
      customComment: args.customComment?.trim() || null,
      replyText: args.replyText,
      repliedAt: new Date(),
    })
    .where(
      and(
        eq(youtubeCommentDraft.userId, args.userId),
        eq(youtubeCommentDraft.commentId, args.commentId),
      ),
    )
    .returning();

  if (!insertedAfterGenerate) {
    throw new Error("Failed to save posted YouTube reply.");
  }

  return insertedAfterGenerate;
}
