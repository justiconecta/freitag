# Freitag NormaChat

Assistente virtual inteligente para consulta de normas tecnicas da **Freitag Laboratorios**.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | Python + FastAPI |
| LLM | Claude API (Anthropic) |
| Embeddings | Voyage AI (voyage-3) |
| Database | Supabase (PostgreSQL + pgvector + Auth) |

## Estrutura

```
├── frontend/          # Next.js app
├── backend/           # Python FastAPI
├── normas/            # PDFs das normas (gitignored)
├── docs/              # PRD e arquitetura
└── docker-compose.yml # Orquestracao
```

## Setup Rapido

### 1. Pre-requisitos

- Node.js 18+
- Python 3.11+
- Conta no [Supabase](https://supabase.com)
- API key da [Anthropic](https://console.anthropic.com)
- API key da [Voyage AI](https://www.voyageai.com)

### 2. Configurar ambiente

```bash
cp .env.example .env
# Preencha as chaves no .env
```

### 3. Supabase

1. Crie um projeto em supabase.com
2. Habilite a extensao pgvector: SQL Editor → `CREATE EXTENSION vector;`
3. Execute o script: `backend/scripts/create_tables.sql`
4. Copie URL e chaves para o .env

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# Acesse http://localhost:3000
```

### 5. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # ou venv\Scripts\activate no Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
# API em http://localhost:8000
```

### 6. Indexar normas

```bash
cd backend
python -m scripts.ingest_pdfs --pdf-dir ../normas/
```

### 7. Docker (alternativa)

```bash
docker compose up
```

## Normas Indexadas

- ABNT NBR 10004-2024 (Partes 1 e 2)
- Metodos Oficiais MAPA - Microbiologicos
- Metodos Oficiais MAPA - Quimicos
- Standard Methods 24th Edition
- Farmacopeia Brasileira 7a Edicao

## Documentacao

- [PRD](docs/prd/PRD-freitag-assistente.md)
- [Arquitetura](docs/architecture/architecture.md)
