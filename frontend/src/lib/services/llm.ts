import Anthropic from "@anthropic-ai/sdk";
import { ChunkResult } from "./vector";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 2048;
const MAX_TOKENS_CONVERSATIONAL = 256;
const TEMPERATURE = 0.3;

const SYSTEM_PROMPT = `Você é o NormaChat, assistente virtual da Freitag Laboratórios, especializado em normas técnicas laboratoriais.

REGRAS OBRIGATÓRIAS:
1. Responda APENAS com base no contexto fornecido (normas técnicas abaixo)
2. Se a informação NÃO estiver no contexto, diga claramente: "Não encontrei essa informação nas normas disponíveis."
3. SEMPRE cite a norma de origem ao final de cada informação relevante
4. Responda em português brasileiro
5. Use linguagem técnica mas acessível
6. Quando houver tabelas ou valores numéricos, formate de forma clara e legível
7. Se a pergunta for ambígua, peça esclarecimento
8. NÃO invente informações. Seja factual e preciso.
9. NUNCA use formatação Markdown (como ##, ###, **, *, ```, etc.). Responda APENAS em texto plano. Use quebras de linha e espaçamento para organizar a resposta.

FORMATO DA CITAÇÃO:
[Fonte: {nome da norma}, Seção {x}, p. {y}]`;

const CONVERSATIONAL_SYSTEM_PROMPT = `Você é o NormaChat, assistente virtual da Freitag Laboratórios.

REGRAS:
1. Responda de forma amigável e profissional em português brasileiro
2. Você é especializado em normas técnicas laboratoriais (ABNT, MAPA, Farmacopeia, Standard Methods)
3. Para saudações, apresente-se brevemente e ofereça ajuda com consultas sobre normas
4. NÃO forneça informações técnicas inventadas — se o usuário fizer uma pergunta técnica, diga que pode buscar nas normas disponíveis
5. Mantenha respostas curtas e objetivas para interações casuais
6. Seja cordial mas não excessivamente informal
7. NUNCA use formatação Markdown. Responda APENAS em texto plano.`;

export type MessageRole = "user" | "assistant";

export interface HistoryMessage {
  role: MessageRole;
  content: string;
}

let client: Anthropic | null = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function generateResponse(
  query: string,
  contextChunks: ChunkResult[],
  history: HistoryMessage[] = []
): Promise<string> {
  const anthropic = getClient();

  const contextParts = contextChunks.map((chunk, i) => {
    const docName = chunk.doc_name || "Documento desconhecido";
    const section = chunk.section_title || "";
    const pageStart = chunk.page_start || "?";
    const content = chunk.content || "";

    let header = `[Norma ${i + 1}: ${docName}`;
    if (section) header += ` - ${section}`;
    header += `, p. ${pageStart}]`;

    return `${header}\n${content}`;
  });

  const contextText = contextParts.join("\n\n---\n\n");

  const userMessage = `CONTEXTO DAS NORMAS TÉCNICAS:\n\n${contextText}\n\n---\n\nPERGUNTA DO USUÁRIO:\n${query}`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: SYSTEM_PROMPT,
    messages,
  });

  const block = response.content[0];
  if (block.type === "text") {
    return block.text;
  }

  return "Erro ao gerar resposta.";
}

export async function generateConversationalResponse(
  query: string,
  history: HistoryMessage[] = []
): Promise<string> {
  const anthropic = getClient();

  const messages: Anthropic.MessageParam[] = [
    ...history.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content: query },
  ];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS_CONVERSATIONAL,
    temperature: TEMPERATURE,
    system: CONVERSATIONAL_SYSTEM_PROMPT,
    messages,
  });

  const block = response.content[0];
  if (block.type === "text") {
    return block.text;
  }

  return "Erro ao gerar resposta.";
}
