"use client";

interface ChatToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export default function ChatToggleButton({
  isOpen,
  onClick,
}: ChatToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed z-40 rounded-full flex items-center justify-center cursor-pointer transition-all bottom-4 right-4 md:bottom-6 md:right-6"
      style={{
        width: "56px",
        height: "56px",
        background: "#ccff00",
        boxShadow: "0 0 30px rgba(204,255,0,0.3)",
        animation: isOpen ? "none" : "chatFabPulse 2s ease-in-out 1",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.08)";
        e.currentTarget.style.boxShadow = "0 0 40px rgba(204,255,0,0.45)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 0 30px rgba(204,255,0,0.3)";
      }}
      title={isOpen ? "Close chat" : "Open chat"}
    >
      {isOpen ? (
        /* X icon */
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#000"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transition: "transform 200ms ease",
          }}
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ) : (
        /* Chat bubble icon */
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#000"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transition: "transform 200ms ease",
          }}
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      )}
    </button>
  );
}
