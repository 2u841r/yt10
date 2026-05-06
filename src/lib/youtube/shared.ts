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
