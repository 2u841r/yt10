import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { startTransition, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuthSuspense } from "@/lib/auth/hooks";
import {
  $fetchYoutubeComments,
  $getYoutubeChannel,
  $postYoutubeReply,
} from "@/lib/youtube/functions";
import type { YoutubeCommentWithReplies } from "@/lib/youtube/server";

export const Route = createFileRoute("/_auth/app/")({
  loader: () => $getYoutubeChannel(),
  component: AppIndex,
});

function AppIndex() {
  const { user } = useAuthSuspense();
  const initialChannel = Route.useLoaderData();
  const fetchYoutubeComments = useServerFn($fetchYoutubeComments);
  const postYoutubeReply = useServerFn($postYoutubeReply);
  const [channel, setChannel] = useState(initialChannel);
  const [comments, setComments] = useState<YoutubeCommentWithReplies[]>([]);

  const fetchCommentsMutation = useMutation({
    mutationFn: async () => {
      return fetchYoutubeComments({
        data: {
          count: 10,
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

  const postReplyMutation = useMutation({
    mutationFn: async (input: {
      commentId: string;
      threadId: string;
      channelId: string;
      videoId: string | null;
      commentText: string;
      replyText: string;
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
                alreadyReplied: true,
                postedReply: variables.replyText,
                replyOptions: [variables.replyText, variables.replyText],
              }
            : comment,
        ),
      );
      toast.success("Reply posted to YouTube.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to post YouTube reply.");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{channel.title}</h1>
          <p className="text-sm text-muted-foreground">Channel ID: {channel.id}</p>
        </div>

        <div className="flex items-center gap-3">
          {channel.thumbnailUrl ? (
            <img
              alt={channel.title}
              className="size-14 rounded-full border object-cover"
              src={channel.thumbnailUrl}
            />
          ) : null}
          <Button
            disabled={fetchCommentsMutation.isPending}
            onClick={() => fetchCommentsMutation.mutate()}
            type="button"
          >
            {fetchCommentsMutation.isPending ? "Fetching + generating..." : "Get last 10 comments"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {comments.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-background px-5 py-10 text-center text-sm text-muted-foreground">
            Fetch the latest 10 comments to generate two AI replies for each one.
          </div>
        ) : null}

        {comments.map((comment) => {
          const isPostingThisComment =
            postReplyMutation.isPending &&
            postReplyMutation.variables?.commentId === comment.commentId;

          return (
            <article key={comment.commentId} className="rounded-3xl border bg-background p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{comment.author}</span>
                    {comment.alreadyReplied ? (
                      <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                        already replied
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 whitespace-pre-wrap">{comment.text}</p>
                </div>
                <time className="text-xs text-muted-foreground">
                  {formatDate(comment.publishedAt)}
                </time>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {comment.replyOptions.map((reply, index) => (
                  <div key={`${comment.commentId}-${index}`} className="rounded-2xl border p-4">
                    <p className="text-sm leading-6 whitespace-pre-wrap">{reply}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        disabled={comment.alreadyReplied || isPostingThisComment}
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
              </div>

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

function formatDate(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
