import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";

const MODEL = "gemini-embedding-001";
const DIMENSIONS = 768;

let genai: GoogleGenerativeAI | null = null;

function getClient() {
  if (!genai) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GOOGLE_API_KEY");
    }
    genai = new GoogleGenerativeAI(apiKey);
  }
  return genai;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL });

  const result = await model.embedContent({
    content: { role: "user", parts: [{ text }] },
    taskType: TaskType.RETRIEVAL_QUERY,
  });

  return result.embedding.values.slice(0, DIMENSIONS);
}
