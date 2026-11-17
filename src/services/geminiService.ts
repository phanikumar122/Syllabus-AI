import { auth } from "../lib/firebase";
import { validateExtractedTopics } from "../domain/aiValidation";
export interface ExtractedTopic {
  title: string;
  subject?: string;
  difficulty: "Easy" | "Medium" | "Hard";
  estimatedHours: number;
}
export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}
const endpoint = import.meta.env.VITE_AI_API_URL?.trim() || "/api";
async function callAi<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const timeout = AbortSignal.timeout(50000);
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const result = await response.json().catch(() => {
    throw new Error(
      "The AI server is unavailable. Start the backend and check configuration.",
    );
  });
  if (!response.ok) throw new Error(result.error || "AI request failed.");
  return result as T;
}
export async function parseSyllabus(
  content: string,
  mimeType = "text/plain",
  signal?: AbortSignal,
): Promise<ExtractedTopic[]> {
  const result = await callAi<{ topics: ExtractedTopic[] }>(
    "syllabus/parse",
    { content, mimeType },
    signal,
  );
  return validateExtractedTopics(result.topics) as ExtractedTopic[];
}
export async function chatWithCoach(
  message: string,
  context: unknown,
  history: ChatMessage[],
  signal?: AbortSignal,
) {
  const result = await callAi<{ message: string }>(
    "coach/chat",
    { message, context, history: history.slice(-20) },
    signal,
  );
  if (typeof result.message !== "string" || !result.message.trim())
    throw new Error("Invalid coach response.");
  return result.message;
}
export async function getSmartNudge(
  _progress: number,
  daysLeft: number,
  topicsRemaining: number,
) {
  return topicsRemaining
    ? `Plan a focused block. ${daysLeft} days and ${topicsRemaining} topics remain.`
    : "Use active recall to review your completed topics.";
}
export async function parseFile(file: File, signal?: AbortSignal) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Choose a file under 10 MB.");
  const extensions: Record<string, string> = {
    txt: "text/plain",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  const mime = extensions[file.name.split(".").pop()?.toLowerCase() || ""];
  if (!mime) throw new Error("Choose TXT, PDF, DOCX, PNG, JPEG, or WebP.");
  const content =
    mime === "text/plain"
      ? await file.text()
      : await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(",")[1]);
          r.onerror = () => reject(new Error("Could not read the file."));
          r.readAsDataURL(file);
        });
  return parseSyllabus(content, mime, signal);
}
