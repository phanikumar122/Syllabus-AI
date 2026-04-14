import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.warn("[GeminiService] GEMINI_API_KEY is not set. AI features will fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "" });

// Use a valid, available Gemini model
const FLASH_MODEL = "gemini-3-flash-preview";

export interface ExtractedTopic {
  title: string;
  subject?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  estimatedHours: number;
}

export async function parseSyllabus(content: string, mimeType: string = 'text/plain'): Promise<ExtractedTopic[]> {
  const prompt = `
    Extract all subjects, chapters, and subtopics from the following syllabus file.
    For each topic, estimate its difficulty (Easy, Medium, Hard) and the number of hours required to master it for an average student.
    Group them logically. Be comprehensive — extract every topic you can find.
  `;

  try {
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: mimeType !== 'text/plain'
        ? [{ parts: [{ text: prompt }, { inlineData: { mimeType: mimeType, data: content } }] }]
        : [{ parts: [{ text: prompt + "\n\nSyllabus Content:\n" + content }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              subject: { type: Type.STRING },
              difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
              estimatedHours: { type: Type.NUMBER }
            },
            required: ["title", "difficulty", "estimatedHours"]
          }
        }
      }
    });

    let rawText = response.text || "[]";
    // Strip markdown formatting universally just in case the model hallucinates it
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsed = JSON.parse(rawText);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e: any) {
    console.error("[GeminiService] Failed to parse syllabus response:", e);
    throw new Error(e.message || "AI Engine failed to process this file format.");
  }
}

export async function getSmartNudge(progress: number, daysLeft: number, topicsRemaining: number): Promise<string> {
  const prompt = `
    The student has completed ${progress}% of their syllabus.
    They have ${daysLeft} days left until the exam.
    There are ${topicsRemaining} topics remaining.
    Provide a short, motivating, and actionable nudge (max 2 sentences) in a premium SaaS tone (like Linear or Notion).
    Be direct and specific, not generic.
  `;

  try {
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: prompt
    });
    return response.text?.trim() || "You're making great progress — keep the momentum going!";
  } catch (e) {
    console.error("[GeminiService] Failed to get smart nudge:", e);
    return "Keep pushing forward — consistency compounds.";
  }
}
