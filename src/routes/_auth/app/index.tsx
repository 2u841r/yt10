import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { startTransition, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthSuspense } from "@/lib/auth/hooks";
import {
  $fetchYoutubeComments,
  $getYoutubeChannel,
  $postYoutubeReply,
  $regenerateYoutubeCommentDraft,
} from "@/lib/youtube/functions";
import {
  YOUTUBE_COMMENT_UNAVAILABLE_MESSAGE,
  type YoutubeCommentWithReplies,
} from "@/lib/youtube/server";

export const Route = createFileRoute("/_auth/app/")({
  loader: () => $getYoutubeChannel(),
  component: AppIndex,
});

function AppIndex() {
  const { user } = useAuthSuspense();
  const initialChannel = Route.useLoaderData();
  const fetchYoutubeComments = useServerFn($fetchYoutubeComments);
  const postYoutubeReply = useServerFn($postYoutubeReply);
  const regenerateYoutubeCommentDraft = useServerFn($regenerateYoutubeCommentDraft);
  const [channel, setChannel] = useState(initialChannel);
  const [comments, setComments] = useState<YoutubeCommentWithReplies[]>([]);
  const [limitInput, setLimitInput] = useState("10");
  const [daysBackInput, setDaysBackInput] = useState("3");

  const fetchCommentsMutation = useMutation({
    mutationFn: async () => {
      const limit = normalizeNumberInput(limitInput, 10, 1, 20);
      const daysBack = normalizeNumberInput(daysBackInput, 3, 1, 30);

      return fetchYoutubeComments({
        data: {
          limit,
          daysBack,
        },
      });
    },
    onSuccess: (data) => {
      startTransition(() => {
        setChannel(data.channel);
        setComments(data.comments);
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to fetch YouTube comments.");
    },
  });

  const regenerateReplyMutation = useMutation({
    mutationFn: async (input: {
      commentId: string;
      threadId: string;
      channelId: string;
      videoId: string | null;
      commentText: string;
      customComment: string;
      correctionInstruction: string;
    }) => {
      return regenerateYoutubeCommentDraft({
        data: {
          ...input,
          customComment: normalizeOptionalTextInput(input.customComment),
          correctionInstruction: normalizeOptionalTextInput(input.correctionInstruction),
        },
      });
    },
    onSuccess: (draft, variables) => {
      setComments((current) =>
        current.map((comment) =>
          comment.commentId === variables.commentId
            ? {
                ...comment,
                customComment: draft.customComment ?? "",
                correctionInstruction: draft.correctionInstruction ?? "",
                replyOptions: [draft.optionA, draft.optionB],
                postedReply: draft.replyText ?? null,
                isPosted: Boolean(draft.replyText),
              }
            : comment,
        ),
      );
      toast.success("AI replies updated for this comment.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update AI replies.");
    },
  });

  function syncLimitInput() {
    setLimitInput(String(normalizeNumberInput(limitInput, 10, 1, 20)));
  }

  function syncDaysBackInput() {
    setDaysBackInput(String(normalizeNumberInput(daysBackInput, 3, 1, 30)));
  }

  function handleLimitInputChange(value: string) {
    setLimitInput(normalizeNumericDraftInput(value));
  }

  function handleDaysBackInputChange(value: string) {
    setDaysBackInput(normalizeNumericDraftInput(value));
  }

  const postReplyMutation = useMutation({
    mutationFn: async (input: {
      commentId: string;
      threadId: string;
      channelId: string;
      videoId: string | null;
      commentText: string;
      replyText: string;
      customComment?: string;
    }) => {
      return postYoutubeReply({
        data: input,
      });
    },
    onSuccess: (_, variables) => {
      setComments((current) =>
        current.map((comment) =>
          comment.commentId === variables.commentId
            ? {
                ...comment,
                isPosted: true,
                postedReply: variables.replyText,
                replyOptions: [variables.replyText, variables.replyText],
              }
            : comment,
        ),
      );
      toast.success("Reply posted to YouTube.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to post YouTube reply.";

      if (
        error instanceof Error &&
        error.message === YOUTUBE_COMMENT_UNAVAILABLE_MESSAGE &&
        postReplyMutation.variables
      ) {
        setComments((current) =>
          current.filter((comment) => comment.commentId !== postReplyMutation.variables?.commentId),
        );
      }

      toast.error(message);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{channel.title}</h1>
          <p className="text-sm text-muted-foreground">Channel ID: {channel.id}</p>
          <p className="text-sm text-muted-foreground">
            Only unanswered comments are fetched, within a recent time window.
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          {channel.thumbnailUrl ? (
            <img
              alt={channel.title}
              className="size-14 rounded-full border object-cover"
              src={channel.thumbnailUrl}
            />
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm" htmlFor="comment-limit">
              <span className="block text-muted-foreground">Comments</span>
              <Input
                className="w-24"
                id="comment-limit"
                max={20}
                min={1}
                onBlur={syncLimitInput}
                onChange={(event) => handleLimitInputChange(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                type="text"
                value={limitInput}
              />
            </label>
            <label className="space-y-1 text-sm" htmlFor="days-back">
              <span className="block text-muted-foreground">Days back</span>
              <Input
                className="w-24"
                id="days-back"
                max={30}
                min={1}
                onBlur={syncDaysBackInput}
                onChange={(event) => handleDaysBackInputChange(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                type="text"
                value={daysBackInput}
              />
            </label>
            <Button
              disabled={fetchCommentsMutation.isPending}
              onClick={() => fetchCommentsMutation.mutate()}
              type="button"
            >
              {fetchCommentsMutation.isPending
                ? "Fetching + generating..."
                : "Get unanswered comments"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {comments.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-background px-5 py-10 text-center text-sm text-muted-foreground">
            Fetch unanswered comments from the last few days to generate two AI replies for each
            one.
          </div>
        ) : null}

        {comments.map((comment) => {
          const isPostingThisComment =
            postReplyMutation.isPending &&
            postReplyMutation.variables?.commentId === comment.commentId;
          const isRegeneratingThisComment =
            regenerateReplyMutation.isPending &&
            regenerateReplyMutation.variables?.commentId === comment.commentId;

          return (
            <article key={comment.commentId} className="rounded-3xl border bg-background p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{comment.author}</span>
                    {comment.isPosted ? (
                      <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                        posted
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 whitespace-pre-wrap">{comment.text}</p>
                </div>
                <time className="text-xs text-muted-foreground">
                  {formatDate(comment.publishedAt)}
                </time>
              </div>

              {!comment.isPosted ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border p-4 lg:col-span-2">
                    <label
                      className="space-y-1 text-sm"
                      htmlFor={`custom-comment-${comment.commentId}`}
                    >
                      <span className="block text-muted-foreground">Custom reply</span>
                      <Input
                        id={`custom-comment-${comment.commentId}`}
                        maxLength={500}
                        onChange={(event) =>
                          setComments((current) =>
                            current.map((entry) =>
                              entry.commentId === comment.commentId
                                ? { ...entry, customComment: event.target.value }
                                : entry,
                            ),
                          )
                        }
                        placeholder="Write your own reply and submit it directly"
                        value={comment.customComment}
                      />
                    </label>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        disabled={
                          isPostingThisComment ||
                          normalizeOptionalTextInput(comment.customComment) === undefined
                        }
                        onClick={() =>
                          postReplyMutation.mutate({
                            commentId: comment.commentId,
                            threadId: comment.threadId,
                            channelId: channel.id,
                            videoId: comment.videoId,
                            commentText: comment.text,
                            replyText: normalizeOptionalTextInput(comment.customComment) ?? "",
                            customComment: normalizeOptionalTextInput(comment.customComment),
                          })
                        }
                        size="sm"
                        type="button"
                      >
                        {isPostingThisComment ? "Posting..." : "Submit custom reply"}
                      </Button>
                    </div>
                  </div>

                  {comment.replyOptions.map((reply, index) => (
                    <div key={`${comment.commentId}-${index}`} className="rounded-2xl border p-4">
                      <p className="text-sm leading-6 whitespace-pre-wrap">{reply}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          disabled={isPostingThisComment}
                          onClick={() =>
                            postReplyMutation.mutate({
                              commentId: comment.commentId,
                              threadId: comment.threadId,
                              channelId: channel.id,
                              videoId: comment.videoId,
                              commentText: comment.text,
                              replyText: reply,
                            })
                          }
                          size="sm"
                          type="button"
                        >
                          {isPostingThisComment ? "Posting..." : `Use option ${index + 1}`}
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-2xl border p-4 lg:col-span-2">
                    <label
                      className="space-y-1 text-sm"
                      htmlFor={`correction-instruction-${comment.commentId}`}
                    >
                      <span className="block text-muted-foreground">AI correction</span>
                      <Input
                        id={`correction-instruction-${comment.commentId}`}
                        maxLength={500}
                        onChange={(event) =>
                          setComments((current) =>
                            current.map((entry) =>
                              entry.commentId === comment.commentId
                                ? { ...entry, correctionInstruction: event.target.value }
                                : entry,
                            ),
                          )
                        }
                        placeholder="Tell AI what was wrong and what the correct answer should be"
                        value={comment.correctionInstruction}
                      />
                    </label>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        disabled={isRegeneratingThisComment}
                        onClick={() =>
                          regenerateReplyMutation.mutate({
                            commentId: comment.commentId,
                            threadId: comment.threadId,
                            channelId: channel.id,
                            videoId: comment.videoId,
                            commentText: comment.text,
                            customComment: "",
                            correctionInstruction: comment.correctionInstruction,
                          })
                        }
                        size="sm"
                        type="button"
                      >
                        {isRegeneratingThisComment ? "Correcting..." : "Submit correction"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {comment.postedReply ? (
                <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Posted reply
                  </p>
                  <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">
                    {comment.postedReply}
                  </p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function normalizeNumberInput(value: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(normalizeNumericDraftInput(value), 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function normalizeNumericDraftInput(value: string) {
  return value
    .replaceAll(/[০-৯]/g, (char) => String(char.charCodeAt(0) - 2534))
    .replaceAll(/\D/g, "");
}

function normalizeOptionalTextInput(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function formatDate(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
