# Arquitetura - Freitag NormaChat

**Versao:** 1.0 (MVP)
**Data:** 2026-02-19
**Status:** Draft
**Baseado em:** PRD-freitag-assistente.md

---

## 1. Visao Geral

### 1.1 Diagrama de Arquitetura

```
                          ┌─────────────────────────┐
                          │      FRONTEND            │
                          │   Next.js 14 + Tailwind  │
                          │                          │
                          │  /login   /chat   /admin │
                          └──────────┬──────────────┘
                                     │ HTTPS
                                     ▼
                          ┌─────────────────────────┐
                          │      BACKEND API         │
                          │   Python + FastAPI       │
                          │                          │
                          │  /api/auth               │
                          │  /api/chat               │
                          │  /api/conversations      │
                          └───────┬──────┬──────────┘
                                  │      │
                    ┌─────────────┘      └──────────────┐
                    ▼                                    ▼
          ┌──────────────────┐                ┌──────────────────┐
          │    SUPABASE      │                │   CLAUDE API     │
          │                  │                │   (Anthropic)    │
          │  ┌─────────────┐ │                │                  │
          │  │ Supabase    │ │                │  claude-sonnet   │
          │  │ Auth        │ │                │  (respostas)     │
          │  └─────────────┘ │                └──────────────────┘
          │  ┌─────────────┐ │
          │  │ PostgreSQL  │ │
          │  │ + pgvector  │ │
          │  │             │ │
          │  │ - users     │ │
          │  │ - sessions  │ │
          │  │ - messages  │ │
          │  │ - documents │ │
          │  │ - chunks    │ │
          │  │   (vectors) │ │
          │  └─────────────┘ │
          └──────────────────┘
```

### 1.2 Componentes Principais

| Componente | Tecnologia | Responsabilidade |
|-----------|-----------|------------------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS | UI do chat, login, admin |
| Backend API | Python 3.12 + FastAPI | Logica de negocio, RAG pipeline, API REST |
| Database | Supabase (PostgreSQL + pgvector) | Dados relacionais + embeddings vetoriais |
| Auth | Supabase Auth | Autenticacao, JWT, sessoes |
| LLM | Claude API (Anthropic) | Geracao de respostas |
| Embeddings | Voyage AI (voyage-3) | Geracao de embeddings para busca semantica |
| PDF Pipeline | PyMuPDF + Unstructured.io | Extracao e chunking dos PDFs |

---

## 2. Estrutura do Projeto

```
freitag-normachat/
├── frontend/                      # Next.js App
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx          # Tela de login
│   │   │   │   └── layout.tsx            # Layout auth (sem sidebar)
│   │   │   ├── (dashboard)/
│   │   │   │   ├── chat/
│   │   │   │   │   └── page.tsx          # Tela principal do chat
│   │   │   │   ├── chat/[id]/
│   │   │   │   │   └── page.tsx          # Conversa especifica
│   │   │   │   └── layout.tsx            # Layout com header
│   │   │   ├── layout.tsx                # Root layout
│   │   │   └── page.tsx                  # Redirect → /login ou /chat
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatMessages.tsx      # Lista de mensagens
│   │   │   │   ├── ChatInput.tsx         # Input de mensagem
│   │   │   │   ├── MessageBubble.tsx     # Bolha individual
│   │   │   │   ├── TypingIndicator.tsx   # Indicador "digitando..."
│   │   │   │   ├── SourceCitation.tsx    # Citacao de norma
│   │   │   │   └── WelcomeState.tsx      # Estado vazio/inicial
│   │   │   ├── auth/
│   │   │   │   └── LoginForm.tsx         # Formulario de login
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx            # Header com logo e user
│   │   │   │   └── ConversationList.tsx  # Sidebar de conversas
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       └── Avatar.tsx
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts             # Supabase browser client
│   │   │   │   ├── server.ts             # Supabase server client
│   │   │   │   └── middleware.ts         # Auth middleware
│   │   │   ├── api.ts                    # Funcoes para chamar o backend
│   │   │   └── utils.ts                  # Helpers gerais
│   │   ├── hooks/
│   │   │   ├── useAuth.ts               # Hook de autenticacao
│   │   │   ├── useChat.ts               # Hook do chat (send, receive)
│   │   │   └── useConversations.ts      # Hook de historico
│   │   └── types/
│   │       └── index.ts                  # Types compartilhados
│   ├── public/
│   │   └── logo-freitag.png
│   ├── tailwind.config.ts
│   ├── next.config.js
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                       # Python FastAPI
│   ├── app/
│   │   ├── main.py                       # FastAPI app entry point
│   │   ├── config.py                     # Settings (env vars)
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── routes/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── chat.py              # POST /api/chat
│   │   │   │   ├── conversations.py     # CRUD conversas
│   │   │   │   └── health.py            # GET /api/health
│   │   │   └── dependencies.py          # Auth dependency (verifica JWT)
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── rag_service.py           # Pipeline RAG completo
│   │   │   ├── llm_service.py           # Comunicacao com Claude API
│   │   │   ├── embedding_service.py     # Gerar embeddings (Voyage)
│   │   │   └── vector_service.py        # Busca no pgvector (Supabase)
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── schemas.py              # Pydantic models (request/response)
│   │   │   └── database.py             # Supabase client
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── text_processing.py       # Helpers de texto
│   ├── scripts/
│   │   ├── ingest_pdfs.py               # Script para indexar PDFs
│   │   ├── create_tables.sql            # SQL para criar tabelas
│   │   └── seed_test_data.py            # Dados de teste
│   ├── tests/
│   │   ├── test_rag.py
│   │   ├── test_chat.py
│   │   └── test_auth.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── normas/                        # PDFs das normas (git-lfs ou .gitignore)
│   ├── ABNT-NBR-10004-2024-P1.pdf
│   ├── ABNT-NBR-10004-2024-P2.pdf
│   ├── MAPA-Metodos-Microbiologicos.pdf
│   ├── MAPA-Metodos-Quimicos.pdf
│   ├── Standard-Methods-24ed.pdf
│   └── Farmacopeia-Brasileira-7-Vol1.pdf
│
├── docs/
│   ├── prd/
│   │   └── PRD-freitag-assistente.md
│   └── architecture/
│       └── architecture.md               # Este documento
│
├── docker-compose.yml             # Orquestracao local
├── .env.example                   # Variaveis de ambiente
├── .gitignore
└── README.md
```

---

## 3. Database Schema (Supabase + pgvector)

### 3.1 Extensoes Necessarias

```sql
-- Habilitar pgvector no Supabase
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3.2 Tabelas

#### profiles (extensao do auth.users do Supabase)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'analyst'
    CHECK (role IN ('analyst', 'support', 'coordinator', 'admin')),
  department TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: usuario so ve seu proprio perfil
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

#### documents (normas indexadas)

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- "ABNT NBR 10004-2024 Parte 1"
  file_name TEXT NOT NULL,               -- "ABNT-NBR-10004-2024-P1.pdf"
  doc_type TEXT NOT NULL,                -- "norma_tecnica", "manual", "farmacopeia"
  total_pages INTEGER,
  total_chunks INTEGER,
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::JSONB     -- info extra (edicao, orgao, etc.)
);
```

#### document_chunks (chunks com embeddings)

```sql
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,          -- ordem do chunk no documento
  content TEXT NOT NULL,                 -- texto do chunk
  embedding VECTOR(1024) NOT NULL,       -- vetor (voyage-3 = 1024 dims)
  page_start INTEGER,                    -- pagina inicial
  page_end INTEGER,                      -- pagina final
  section_title TEXT,                    -- titulo da secao (se detectado)
  metadata JSONB DEFAULT '{}'::JSONB,    -- info extra do chunk
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice para busca vetorial (IVFFlat para performance)
CREATE INDEX ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Indice para busca por documento
CREATE INDEX ON document_chunks (document_id);
```

#### conversations

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,                            -- auto-gerado da primeira mensagem
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: usuario so ve suas proprias conversas
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own conversations"
  ON conversations FOR ALL
  USING (auth.uid() = user_id);
```

#### messages

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]'::JSONB,     -- [{doc_name, section, page, chunk_id}]
  feedback TEXT CHECK (feedback IN ('like', 'dislike', NULL)),
  tokens_used INTEGER,                   -- tracking de uso
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS via conversation ownership
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from own conversations"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );
```

### 3.3 Funcao de Busca Vetorial (pgvector)

```sql
-- Funcao para busca semantica nos chunks
CREATE OR REPLACE FUNCTION search_chunks(
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  section_title TEXT,
  page_start INTEGER,
  page_end INTEGER,
  similarity FLOAT,
  doc_name TEXT,
  doc_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.section_title,
    dc.page_start,
    dc.page_end,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.name AS doc_name,
    d.doc_type
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## 4. API Endpoints (Backend FastAPI)

### 4.1 Autenticacao

Autenticacao e gerenciada pelo Supabase Auth. O backend valida o JWT do Supabase em cada request.

```
Headers obrigatorios:
  Authorization: Bearer <supabase-jwt-token>
```

### 4.2 Endpoints

| Metodo | Rota | Descricao | Auth |
|--------|------|-----------|------|
| GET | `/api/health` | Health check | Nao |
| POST | `/api/chat` | Enviar mensagem e receber resposta RAG | Sim |
| GET | `/api/conversations` | Listar conversas do usuario | Sim |
| GET | `/api/conversations/{id}` | Buscar conversa com mensagens | Sim |
| POST | `/api/conversations` | Criar nova conversa | Sim |
| DELETE | `/api/conversations/{id}` | Deletar conversa | Sim |
| PATCH | `/api/messages/{id}/feedback` | Dar like/dislike em mensagem | Sim |

### 4.3 Schemas Principais

```python
# POST /api/chat - Request
class ChatRequest(BaseModel):
    message: str                    # Pergunta do usuario
    conversation_id: str | None     # Conversa existente (ou cria nova)

# POST /api/chat - Response
class ChatResponse(BaseModel):
    message: str                    # Resposta do assistente
    conversation_id: str            # ID da conversa
    message_id: str                 # ID da mensagem
    sources: list[Source]           # Fontes citadas

class Source(BaseModel):
    document_name: str              # "ABNT NBR 10004-2024"
    section: str | None             # "Secao 4.2 - Classificacao"
    page: int | None                # 42
    similarity: float               # 0.89
```

---

## 5. Pipeline RAG

### 5.1 Indexacao (Offline - Executado uma vez)

```
[PDF] → [PyMuPDF: Extrair texto] → [Unstructured: Detectar secoes/tabelas]
                                           │
                                    [Chunking Inteligente]
                                    - max 512 tokens por chunk
                                    - overlap de 50 tokens
                                    - respeita limites de secao
                                           │
                                    [Voyage AI: Gerar embedding]
                                    - modelo: voyage-3
                                    - dimensao: 1024
                                           │
                                    [Supabase: Salvar chunk + embedding]
                                    - tabela document_chunks
```

### 5.2 Query (Online - Cada pergunta)

```
[Pergunta do usuario]
        │
  [Voyage AI: Embedding da pergunta]
        │
  [Supabase pgvector: Busca semantica]
  - top 8 chunks mais similares
  - threshold > 0.7
        │
  [Montar prompt para Claude]
  - System prompt com instrucoes
  - Chunks como contexto
  - Pergunta do usuario
        │
  [Claude API: Gerar resposta]
  - modelo: claude-sonnet-4-20250514
  - temperatura: 0.3 (baixa = mais factual)
  - max_tokens: 2048
        │
  [Extrair citacoes e formatar]
        │
  [Retornar resposta + sources]
```

### 5.3 System Prompt do RAG

```
Voce e o assistente virtual da Freitag Laboratorios, especializado em normas
tecnicas laboratoriais. Seu nome e NormaChat.

REGRAS OBRIGATORIAS:
1. Responda APENAS com base no contexto fornecido (normas tecnicas)
2. Se a informacao nao estiver no contexto, diga claramente que nao encontrou
3. SEMPRE cite a norma de origem: nome do documento, secao e pagina
4. Responda em portugues brasileiro
5. Use linguagem tecnica mas acessivel
6. Quando houver tabelas ou valores numericos, formate de forma clara
7. Se a pergunta for ambigua, peca esclarecimento

FORMATO DA CITACAO:
Ao final de cada informacao, cite assim: [Fonte: {nome da norma}, Secao {x}, p. {y}]
```

---

## 6. Frontend - Componentes Principais

### 6.1 Design System

Baseado nos prototipos HTML existentes:

```typescript
// tailwind.config.ts - cores Freitag
const colors = {
  freitag: {
    green:       '#0A5F38',
    'green-light': '#12845A',
    'green-dark':  '#064428',
    accent:      '#7ED957',
  }
}

// Tipografia
// - Titulos: Libre Baskerville (serif)
// - Body/UI: DM Sans (sans-serif)
```

### 6.2 Paginas

| Rota | Componente | Descricao |
|------|-----------|-----------|
| `/login` | LoginPage | Tela de login (baseada no prototipo freitag-login.html) |
| `/chat` | ChatPage | Tela principal do chat com welcome state |
| `/chat/[id]` | ChatPage | Conversa especifica carregada |

### 6.3 Fluxo de Telas

```
/login → [Supabase Auth] → /chat (welcome state)
                               │
                          [Envia pergunta]
                               │
                          /chat/[conv-id] (mensagens)
                               │
                          [Nova Conversa] → /chat (welcome state)
```

---

## 7. Autenticacao

### 7.1 Fluxo

```
[Frontend: Login Form]
        │
  [Supabase Auth: signInWithPassword()]
        │
  [Recebe JWT + Refresh Token]
        │
  [Armazena em cookie httpOnly (via middleware Next.js)]
        │
  [Cada request ao backend inclui JWT no header]
        │
  [Backend: Valida JWT com supabase.auth.get_user(token)]
```

### 7.2 Cadastro de Usuarios

No MVP, usuarios sao criados pelo admin no dashboard do Supabase.
Nao ha self-registration.

---

## 8. Deploy

### 8.1 Ambiente de Desenvolvimento

```yaml
# docker-compose.yml (dev local)
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=...
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=...
      - BACKEND_URL=http://backend:8000

  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - SUPABASE_URL=...
      - SUPABASE_SERVICE_KEY=...
      - ANTHROPIC_API_KEY=...
      - VOYAGE_API_KEY=...
```

### 8.2 Producao (Recomendado)

| Servico | Plataforma | Custo Estimado |
|---------|-----------|----------------|
| Frontend | Vercel (free tier) | $0/mes |
| Backend | Railway ou Render | $5-20/mes |
| Database | Supabase (free tier) | $0/mes |
| Claude API | Anthropic (pay-as-you-go) | $30-80/mes |
| Voyage AI | Voyage (pay-as-you-go) | $5-10/mes |
| **Total** | | **~$40-110/mes** |

---

## 9. Variaveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_KEY=eyJhbG...  # Apenas no backend

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Voyage AI (Embeddings)
VOYAGE_API_KEY=pa-...

# Backend
BACKEND_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000
```

---

## 10. Ordem de Implementacao (Stories)

| # | Story | Dependencias | Estimativa |
|---|-------|-------------|------------|
| 1 | Setup do projeto (repos, configs, Supabase) | Nenhuma | 1 dia |
| 2 | Schema do banco (tabelas, pgvector, RLS) | Story 1 | 0.5 dia |
| 3 | Pipeline de indexacao dos PDFs | Story 2 | 2-3 dias |
| 4 | Backend: endpoint de chat com RAG | Story 3 | 2 dias |
| 5 | Frontend: tela de login | Story 1 | 1 dia |
| 6 | Frontend: tela de chat | Story 4 | 2 dias |
| 7 | Historico de conversas | Story 6 | 1 dia |
| 8 | Feedback (like/dislike) | Story 6 | 0.5 dia |
| 9 | Testes e ajuste de prompts | Story 4 | 2 dias |
| 10 | Deploy | Todas | 1 dia |
| | **Total estimado** | | **~12-14 dias** |

---

*Documento gerado por Orion (AIOS Master) | 2026-02-19*
