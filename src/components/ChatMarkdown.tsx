"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const remarkPlugins = [remarkGfm];

function ChatMarkdownImpl({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={remarkPlugins}>{content}</ReactMarkdown>
    </div>
  );
}

const ChatMarkdown = memo(ChatMarkdownImpl);
ChatMarkdown.displayName = "ChatMarkdown";
export default ChatMarkdown;
