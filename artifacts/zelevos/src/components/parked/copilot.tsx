/**
 * PARKED COMPONENT: Copilot ("Ask Zelevos" AI Travel Assistant)
 * 
 * Status: PARKED (Not part of active V1 Curated Marketplace customer journey)
 * PRD Reference: Wayora_PRD_Without_APIs Section 3 (Non-goals) & Step 1
 * Preserved for future AI conversational features per directive's "park, don't delete" rule.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, Send } from "lucide-react";
import type { AuthUser } from "@/components/auth-dialog";

export interface CopilotProps {
  open: boolean;
  onClose: () => void;
  onToast: (message: string) => void;
  user: AuthUser | null;
}

async function askZelevos(message: string, history: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<string> {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  const payload = (await response.json()) as { response?: string; message?: string };
  if (!response.ok || !payload.response) {
    throw new Error(payload.message || "Zelevos AI is temporarily unavailable.");
  }
  return payload.response;
}

export function Copilot({ open, onClose, onToast, user }: CopilotProps) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const nextMessage = message.trim();
    if (!nextMessage || loading) return;
    const history = sent.map((item) => ({ role: "user" as const, content: item }));
    setSent((items) => [...items, nextMessage]);
    setMessage("");
    setLoading(true);
    try {
      setReply(await askZelevos(nextMessage, history));
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Zelevos AI is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, y: 20, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 20, x: 20 }}
          className="copilot"
        >
          <div className="copilot-head">
            <span className="copilot-avatar"><Sparkles size={17} /></span>
            <div>
              <strong>Ask Zelevos</strong>
              <small>AI travel copilot · parked</small>
            </div>
            <button onClick={onClose} aria-label="Close copilot"><X size={17} /></button>
          </div>
          <div className="copilot-body">
            <p className="copilot-message">What can I help you with today?</p>
            {sent.map((item, index) => (
              <p className="copilot-sent" key={`${item}-${index}`}>{item}</p>
            ))}
            {reply && <p className="copilot-message">{reply}</p>}
            {loading && (
              <p className="copilot-message">
                <span className="typing"><i /><i /><i /></span>
              </p>
            )}
            <div className="quick-actions">
              {["Best time to visit Kashmir?", "What is included in the package?", "Do you provide vegetarian meals?", "How does cancellation work?"].map((item) => (
                <button onClick={() => setMessage(item)} key={item}>{item}</button>
              ))}
            </div>
          </div>
          <div className="copilot-input">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && send()}
              placeholder="Ask me anything..."
            />
            <button onClick={send} aria-label="Send message"><Send size={15} /></button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
