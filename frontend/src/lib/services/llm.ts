import Anthropic from "@anthropic-ai/sdk";
import { ChunkResult } from "./vector";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 2048;
const TEMPERATURE = 0.3;

const SYSTEM_PROMPT = `Você é o NormaChat, assistente virtual da Freitag Laboratórios, especializado em normas técnicas laboratoriais.

REGRAS OBRIGATÓRIAS:
1. Responda APENAS com base no contexto fornecido (normas técnicas abaixo)
2. Se a informação NÃO estiver no contexto, diga claramente: "Não encontrei essa informação nas normas disponíveis."
3. SEMPRE cite a norma de origem ao final de cada informação relevante
4. Responda em português brasileiro
5. Use linguagem técnica mas acessível
6. Quando houver tabelas ou valores numéricos, formate de forma clara
7. Se a pergunta for ambígua, peça esclarecimento
8. NÃO invente informações. Seja factual e preciso.

FORMATO DA CITAÇÃO:
[Fonte: {nome da norma}, Seção {x}, p. {y}]`;

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
  contextChunks: ChunkResult[]
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

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type === "text") {
    return block.text;
  }

  return "Erro ao gerar resposta.";
}
