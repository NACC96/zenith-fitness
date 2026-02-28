"use client";

import { useEffect, useRef, useState } from "react";
import Portal from "@/components/Portal";

export type WorkoutChatMessage = {
  _id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
};

type ModelOption = {
  label: string;
  value: string;
};

export interface WorkoutChatOverlayProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  messages: WorkoutChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  selectedModel: string;
  models: ModelOption[];
  onModelChange: (value: string) => void;
  onSendMessage: (content: string, images?: string[]) => Promise<void>;
  isInputDisabled: boolean;
}

const QUICK_CHIPS = ["Log bench press 3×10", "Suggest a push day", "Track my squats"];
const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function WorkoutChatOverlay({
  isOpen,
  onOpen,
  onClose,
  messages,
  isStreaming,
  streamingContent,
  selectedModel,
  models,
  onModelChange,
  onSendMessage,
  isInputDisabled,
}: WorkoutChatOverlayProps) {
  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const focusScrollTimeoutRef = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const shouldRestoreFocusRef = useRef(false);
  const pendingImageReadsRef = useRef(0);
  const sendLockRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isOpen, messages, isStreaming, streamingContent]);

  useEffect(() => {
    const syncKeyboardInset = () => {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportOffsetTop = viewport?.offsetTop ?? 0;
      const inset = Math.max(0, window.innerHeight - viewportHeight - viewportOffsetTop);
      setKeyboardInset(inset);
    };

    syncKeyboardInset();
    window.visualViewport?.addEventListener("resize", syncKeyboardInset);
    window.visualViewport?.addEventListener("scroll", syncKeyboardInset);
    window.addEventListener("orientationchange", syncKeyboardInset);

    return () => {
      window.visualViewport?.removeEventListener("resize", syncKeyboardInset);
      window.visualViewport?.removeEventListener("scroll", syncKeyboardInset);
      window.removeEventListener("orientationchange", syncKeyboardInset);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (shouldRestoreFocusRef.current) {
        shouldRestoreFocusRef.current = false;
        previousFocusRef.current?.focus();
      }
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    shouldRestoreFocusRef.current = true;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const rafId = window.requestAnimationFrame(() => {
      dialog.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.offsetParent !== null,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !focusables.includes(active ?? first)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (focusScrollTimeoutRef.current !== null) {
        window.clearTimeout(focusScrollTimeoutRef.current);
        focusScrollTimeoutRef.current = null;
      }
    };
  }, []);

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const appendImageFiles = (files: File[]) => {
    if (files.length === 0) return;

    let tooLargeCount = 0;
    let overLimitCount = 0;
    let remainingSlots = Math.max(
      0,
      MAX_ATTACHMENTS - attachedImages.length - pendingImageReadsRef.current,
    );
    const acceptedFiles: File[] = [];

    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) {
        tooLargeCount += 1;
        continue;
      }
      if (remainingSlots <= 0) {
        overLimitCount += 1;
        continue;
      }
      acceptedFiles.push(file);
      remainingSlots -= 1;
    }

    if (tooLargeCount > 0 && overLimitCount > 0) {
      setAttachmentNotice(
        `Some images were skipped (max ${MAX_ATTACHMENTS} attachments, ${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB each).`,
      );
    } else if (tooLargeCount > 0) {
      setAttachmentNotice(
        `Images over ${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB were skipped.`,
      );
    } else if (overLimitCount > 0) {
      setAttachmentNotice(`Attachment limit reached (${MAX_ATTACHMENTS} max).`);
    } else {
      setAttachmentNotice(null);
    }

    if (acceptedFiles.length === 0) return;
    pendingImageReadsRef.current += acceptedFiles.length;

    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        pendingImageReadsRef.current = Math.max(0, pendingImageReadsRef.current - 1);
        if (typeof reader.result !== "string") return;
        setAttachedImages((prev) => {
          if (prev.length >= MAX_ATTACHMENTS) return prev;
          return [...prev, reader.result as string];
        });
      };
      reader.onerror = () => {
        pendingImageReadsRef.current = Math.max(0, pendingImageReadsRef.current - 1);
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    e.preventDefault();
    appendImageFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    appendImageFiles(files);
    if (e.target) e.target.value = "";
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (isInputDisabled || isSending || sendLockRef.current || (!trimmed && attachedImages.length === 0)) return;
    const imagesToSend = attachedImages.length > 0 ? attachedImages : undefined;
    const previousInput = input;
    const previousImages = attachedImages;

    sendLockRef.current = true;
    setIsSending(true);
    setAttachmentNotice(null);
    setInput("");
    setAttachedImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      await onSendMessage(trimmed, imagesToSend);
    } catch (error) {
      console.error("Failed to send workout message:", error);
      setInput(previousInput);
      setAttachedImages(previousImages);
      setAttachmentNotice("Message failed to send. Please try again.");
    } finally {
      sendLockRef.current = false;
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const overlayOffsetStyle =
    keyboardInset > 0
      ? ({
          transform: `translateY(-${keyboardInset}px)`,
        } as const)
      : undefined;

  return (
    <Portal>
      {!isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-[70] px-3 pt-2"
          style={{
            ...overlayOffsetStyle,
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
        >
          <div
            className="mx-auto max-w-[860px] rounded-2xl px-2.5 py-2 flex items-center gap-2"
            style={{
              background: "rgba(10,10,10,0.95)",
              border: "1px solid rgba(255,255,255,0.09)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 -12px 32px rgba(0,0,0,0.35)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
                onOpen();
              }}
              disabled={isInputDisabled || isSending}
              aria-label="Attach image"
              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onOpen}
              className="flex-1 rounded-xl px-3 py-2.5 text-left cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.45)",
                fontFamily: "var(--font-sans)",
                fontSize: "17px",
              }}
            >
              Log a set or ask for help...
            </button>

            <button
              type="button"
              onClick={onOpen}
              aria-label="Open chat"
              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all disabled:opacity-40"
              disabled={isInputDisabled || isSending}
              style={{
                background: "#ff2d2d",
                boxShadow: "0 0 16px rgba(255,45,45,0.3)",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      {isOpen && (
        <div className="fixed inset-0 z-[75]">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close chat overlay"
            style={{ background: "transparent", backdropFilter: "none" }}
            onClick={onClose}
          />

          <div
            className="absolute inset-x-0 bottom-0 px-3"
            style={{
              ...overlayOffsetStyle,
              paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Workout chat"
              tabIndex={-1}
              className="mx-auto max-w-[860px] max-h-[50dvh] md:max-h-[min(76vh,640px)] rounded-2xl border flex flex-col overflow-hidden"
              style={{
                background: "rgba(10,10,10,0.96)",
                borderColor: "rgba(255,255,255,0.1)",
                backdropFilter: "blur(22px)",
                boxShadow: "0 -16px 48px rgba(0,0,0,0.5)",
              }}
            >
              <div
                className="shrink-0 flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "#ff2d2d",
                      animation: "chatPulse 2s ease-in-out infinite",
                    }}
                  />
                  <span
                    className="font-semibold"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "#ebebeb",
                    }}
                  >
                    Zenith AI
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedModel}
                    onChange={(e) => onModelChange(e.target.value)}
                    aria-label="Select AI model"
                    className="rounded-lg px-2 py-1 outline-none cursor-pointer text-base sm:text-xs"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.5)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {models.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close chat overlay"
                    className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                    style={{
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                {messages.length === 0 && !isStreaming && (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <p
                      className="text-center"
                      style={{
                        color: "rgba(255,255,255,0.25)",
                        fontFamily: "var(--font-sans)",
                        fontSize: "13px",
                      }}
                    >
                      Tell me what you&apos;re working on today...
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 mt-1">
                      {QUICK_CHIPS.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            setInput(chip);
                            onOpen();
                          }}
                          className="px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "rgba(255,255,255,0.4)",
                            fontFamily: "var(--font-sans)",
                            fontSize: "11px",
                          }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg._id}
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className="max-w-[85%] px-3 py-2.5"
                      style={{
                        background:
                          msg.role === "user"
                            ? "rgba(255,45,45,0.08)"
                            : "rgba(255,255,255,0.04)",
                        border:
                          msg.role === "user"
                            ? "1px solid rgba(255,45,45,0.15)"
                            : "1px solid rgba(255,255,255,0.06)",
                        borderRadius:
                          msg.role === "user"
                            ? "0.875rem 0.875rem 0.25rem 0.875rem"
                            : "0.875rem 0.875rem 0.875rem 0.25rem",
                      }}
                    >
                      {msg.role === "user" && msg.images && msg.images.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mb-2">
                          {msg.images.map((img: string, index: number) => (
                            <img
                              key={index}
                              src={img}
                              alt={`Image ${index + 1}`}
                              style={{
                                width: 80,
                                height: 80,
                                objectFit: "cover",
                                borderRadius: 8,
                                border: "1px solid rgba(255,255,255,0.1)",
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <p
                        className="text-sm leading-relaxed whitespace-pre-wrap"
                        style={{
                          color: msg.role === "user" ? "#ebebeb" : "rgba(255,255,255,0.8)",
                          fontFamily: "var(--font-sans)",
                          fontSize: "13px",
                        }}
                      >
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))}

                {isStreaming && (
                  <div className="flex items-start">
                    <div
                      className="px-3 py-2.5 flex items-center gap-1.5"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: "0.875rem 0.875rem 0.875rem 0.25rem",
                      }}
                    >
                      {streamingContent ? (
                        <p
                          className="text-sm leading-relaxed whitespace-pre-wrap"
                          style={{
                            color: "rgba(255,255,255,0.8)",
                            fontFamily: "var(--font-sans)",
                            fontSize: "13px",
                          }}
                        >
                          {streamingContent}
                        </p>
                      ) : (
                        <>
                          <span className="chat-dot" style={{ animationDelay: "0ms" }} />
                          <span className="chat-dot" style={{ animationDelay: "150ms" }} />
                          <span className="chat-dot" style={{ animationDelay: "300ms" }} />
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div
                className="shrink-0 px-4 pt-2.5"
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.04)",
                  paddingBottom: "0.625rem",
                }}
              >
                {attachmentNotice && (
                  <p
                    className="px-1 pb-2 font-mono text-[10px]"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    {attachmentNotice}
                  </p>
                )}

                {attachedImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap px-1 pb-2">
                    {attachedImages.map((img, index) => (
                      <div key={index} className="relative group" style={{ width: 48, height: 48 }}>
                        <img
                          src={img}
                          alt={`Attached ${index + 1}`}
                          style={{
                            width: 48,
                            height: 48,
                            objectFit: "cover",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setAttachmentNotice(null);
                            setAttachedImages((prev) => prev.filter((_, idx) => idx !== index));
                          }}
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -6,
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "rgba(0,0,0,0.8)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "#fff",
                            fontSize: 10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isInputDisabled || isSending}
                    aria-label="Attach image"
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all disabled:opacity-30"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="rgba(255,255,255,0.5)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>

                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleTextareaInput}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    aria-label="Workout chat input"
                    placeholder="Log a set or ask for help..."
                    disabled={isInputDisabled}
                    rows={1}
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none resize-none disabled:opacity-50"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#ebebeb",
                      fontFamily: "var(--font-sans)",
                      fontSize: "16px",
                      maxHeight: "120px",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,45,45,0.4)";
                      if (focusScrollTimeoutRef.current !== null) {
                        window.clearTimeout(focusScrollTimeoutRef.current);
                      }
                      focusScrollTimeoutRef.current = window.setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "end",
                        });
                        focusScrollTimeoutRef.current = null;
                      }, 140);
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                      if (focusScrollTimeoutRef.current !== null) {
                        window.clearTimeout(focusScrollTimeoutRef.current);
                        focusScrollTimeoutRef.current = null;
                      }
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      void handleSend();
                    }}
                    disabled={
                      isInputDisabled || isSending || (!input.trim() && attachedImages.length === 0)
                    }
                    aria-label="Send workout message"
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      background: "#ff2d2d",
                      boxShadow:
                        (input.trim() || attachedImages.length > 0) &&
                        !isInputDisabled &&
                        !isSending
                          ? "0 0 12px rgba(255,45,45,0.25)"
                          : "none",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#000"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Portal>
  );
}
