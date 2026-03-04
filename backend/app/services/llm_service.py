import anthropic

from app.config import Settings

SYSTEM_PROMPT = """Você é o NormaChat, assistente virtual da Freitag Laboratórios, especializado em normas técnicas laboratoriais.

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
[Fonte: {nome da norma}, Seção {x}, p. {y}]"""

CONVERSATIONAL_SYSTEM_PROMPT = """Você é o NormaChat, assistente virtual da Freitag Laboratórios.

REGRAS:
1. Responda de forma amigável e profissional em português brasileiro
2. Você é especializado em normas técnicas laboratoriais (ABNT, MAPA, Farmacopeia, Standard Methods)
3. Para saudações, apresente-se brevemente e ofereça ajuda com consultas sobre normas
4. NÃO forneça informações técnicas inventadas — se o usuário fizer uma pergunta técnica, diga que pode buscar nas normas disponíveis
5. Mantenha respostas curtas e objetivas para interações casuais
6. Seja cordial mas não excessivamente informal"""

MAX_TOKENS_CONVERSATIONAL = 256


class LLMService:
    def __init__(self, settings: Settings):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model = settings.rag_model
        self.max_tokens = settings.rag_max_tokens
        self.temperature = settings.rag_temperature

    async def generate_response(
        self,
        query: str,
        context_chunks: list[dict],
        history: list[dict] | None = None,
    ) -> str:
        """Generate a response using Claude with RAG context."""
        context_parts = []
        for i, chunk in enumerate(context_chunks, 1):
            doc_name = chunk.get("doc_name", "Documento desconhecido")
            section = chunk.get("section_title", "")
            page_start = chunk.get("page_start", "?")
            content = chunk.get("content", "")

            header = f"[Norma {i}: {doc_name}"
            if section:
                header += f" - {section}"
            header += f", p. {page_start}]"

            context_parts.append(f"{header}\n{content}")

        context_text = "\n\n---\n\n".join(context_parts)

        user_message = f"""CONTEXTO DAS NORMAS TÉCNICAS:

{context_text}

---

PERGUNTA DO USUÁRIO:
{query}"""

        messages = []
        if history:
            messages.extend(
                {"role": msg["role"], "content": msg["content"]}
                for msg in history
            )
        messages.append({"role": "user", "content": user_message})

        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            system=SYSTEM_PROMPT,
            messages=messages,
        )

        return response.content[0].text

    async def generate_conversational_response(
        self,
        query: str,
        history: list[dict] | None = None,
    ) -> str:
        """Generate a conversational response without RAG context."""
        messages = []
        if history:
            messages.extend(
                {"role": msg["role"], "content": msg["content"]}
                for msg in history
            )
        messages.append({"role": "user", "content": query})

        response = self.client.messages.create(
            model=self.model,
            max_tokens=MAX_TOKENS_CONVERSATIONAL,
            temperature=self.temperature,
            system=CONVERSATIONAL_SYSTEM_PROMPT,
            messages=messages,
        )

        return response.content[0].text
