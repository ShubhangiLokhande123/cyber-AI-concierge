import type { ConversationData } from "./types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function startConversation(
  userName = "Visitor"
): Promise<ConversationData> {
  const res = await fetch(`${BACKEND_URL}/api/start-conversation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_name: userName }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to start conversation: ${err}`);
  }

  return res.json() as Promise<ConversationData>;
}

export async function sendMessage(
  conversationId: string,
  text: string
): Promise<{ response: string; conversation_id: string }> {
  const res = await fetch(`${BACKEND_URL}/api/send-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId, text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to send message: ${err}`);
  }

  return res.json();
}
