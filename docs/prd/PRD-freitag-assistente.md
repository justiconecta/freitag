# PRD - Freitag Assistente Virtual de Normas

**Produto:** Freitag NormaChat
**Versão:** 1.0 (MVP)
**Data:** 2026-02-19
**Status:** Draft
**Owner:** Carlos Leal

---

## 1. Visao Geral do Produto

### 1.1 Problema

A equipe interna da Freitag Laboratorios (analistas, tecnicos, atendimento) precisa consultar frequentemente normas tecnicas complexas (ABNT, Standard Methods, Farmacopeia Brasileira, manuais do MAPA) para realizar analises, interpretar resultados e responder clientes. Hoje isso e feito manualmente, folheando PDFs extensos, o que consome tempo e esta sujeito a erros de interpretacao.

### 1.2 Solucao

Um assistente virtual inteligente (chatbot) que utiliza RAG (Retrieval-Augmented Generation) para responder perguntas da equipe com base nas normas tecnicas oficiais. O sistema indexa os PDFs das normas e responde perguntas em linguagem natural, citando as fontes.

### 1.3 Proposta de Valor

- **Velocidade**: Respostas em segundos ao inves de minutos folheando PDFs
- **Precisao**: Respostas baseadas nas normas oficiais, com citacao da fonte
- **Acessibilidade**: Interface simples de chat, sem necessidade de treinamento
- **Disponibilidade**: Acesso 24/7 via navegador web

---

## 2. Usuarios e Personas

### 2.1 Persona Primaria: Analista de Laboratorio

- **Quem**: Analistas e tecnicos que executam ensaios laboratoriais
- **Necessidade**: Consultar metodos de analise, parametros de referencia, limites aceitaveis
- **Exemplo de uso**: "Qual o metodo oficial para determinacao de coliformes totais em agua?"
- **Frequencia**: Diaria

### 2.2 Persona Secundaria: Atendimento ao Cliente

- **Quem**: Equipe de atendimento que lida com duvidas de clientes
- **Necessidade**: Responder rapidamente perguntas sobre metodos, prazos de validade, normas aplicaveis
- **Exemplo de uso**: "Quais normas se aplicam a analise de residuos solidos industriais?"
- **Frequencia**: Diaria

### 2.3 Persona Terciaria: Coordenador Tecnico

- **Quem**: Responsavel tecnico que valida metodos e procedimentos
- **Necessidade**: Consultar detalhes especificos de normas para validacao de metodos
- **Exemplo de uso**: "Qual a temperatura de incubacao e o tempo para ensaio de Salmonella segundo o MAPA?"
- **Frequencia**: Semanal

---

## 3. Escopo do MVP

### 3.1 Funcionalidades Incluidas (MVP)

| ID | Funcionalidade | Prioridade | Descricao |
|----|---------------|-----------|-----------|
| F01 | Login/Autenticacao | Alta | Autenticacao de usuarios internos com email/senha |
| F02 | Chat com RAG | Alta | Interface de chat que responde perguntas usando as normas como base |
| F03 | Citacao de Fontes | Alta | Cada resposta deve indicar de qual norma/pagina a informacao foi extraida |
| F04 | Historico de Conversas | Media | Manter historico das conversas por usuario |
| F05 | Nova Conversa | Media | Iniciar uma nova conversa limpa |
| F06 | Feedback de Respostas | Baixa | Botao de like/dislike para avaliar qualidade das respostas |

### 3.2 Fora do Escopo (MVP)

- Integracao com LIMS
- Consulta de laudos/amostras
- Agendamento de coleta
- Upload de novas normas pelo usuario (admin faz manualmente)
- App mobile nativo
- Multi-tenant (outras empresas)

---

## 4. Base de Conhecimento (Normas)

### 4.1 Documentos Indexados no MVP

| # | Documento | Tipo | Escopo |
|---|----------|------|--------|
| 1 | ABNT NBR 10004-2024 (Partes 1 e 2) | Norma tecnica | Classificacao de residuos solidos |
| 2 | Metodos Oficiais - Microbiologicos (MAPA/SDA) | Manual oficial | Analise microbiologica de produtos de origem animal |
| 3 | Metodos Oficiais - Quimicos (MAPA/SDA) | Manual oficial | Analise quimica de produtos de origem animal |
| 4 | Standard Methods 24th Edition | Referencia internacional | Metodos para analise de agua e efluentes |
| 5 | Farmacopeia Brasileira 7a Edicao (Vol. I) | Farmacopeia | Metodos e padroes farmacopeia |

### 4.2 Estrategia de Indexacao

- Extracao de texto dos PDFs com OCR quando necessario
- Chunking inteligente respeitando secoes/capitulos das normas
- Metadados por chunk: nome da norma, secao, pagina, tipo de metodo
- Embeddings vetoriais para busca semantica

---

## 5. Requisitos Nao-Funcionais

| Requisito | Especificacao |
|-----------|--------------|
| **Performance** | Resposta em < 10 segundos |
| **Disponibilidade** | 99% uptime em horario comercial |
| **Seguranca** | Autenticacao obrigatoria, HTTPS, dados nao expostos publicamente |
| **Escalabilidade** | Suportar 50-500 usuarios simultaneos |
| **Idioma** | Portugues brasileiro (interface e respostas) |
| **Dispositivos** | Desktop e mobile (web responsivo) |
| **Dados** | Normas armazenadas localmente, nao enviadas para terceiros sem necessidade |

---

## 6. Stack Tecnica Recomendada

### 6.1 Recomendacao: Python + Next.js

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Frontend** | Next.js 14 + TypeScript + Tailwind CSS | SSR, responsivo, facil de deploy. Os prototipos HTML existentes servem de referencia para o design system |
| **Backend/API** | Python + FastAPI | Ecossistema maduro para AI/ML, LangChain/LlamaIndex nativos, processamento de PDF robusto |
| **LLM** | Claude API (Anthropic) | Melhor custo-beneficio para portugues, contexto longo (200k tokens), qualidade superior em normas tecnicas |
| **Embeddings** | Voyage AI ou OpenAI text-embedding-3-small | Alta qualidade para portugues |
| **Database + Vector Store + Auth** | **Supabase** (PostgreSQL + pgvector + Supabase Auth) | Banco unificado: relacional (usuarios, sessoes, historico) + vetorial (embeddings das normas) + auth pronto (email/senha, magic link). Free tier generoso |
| **PDF Processing** | PyMuPDF + Unstructured.io | Extracao robusta de PDFs complexos com tabelas |
| **Deploy** | Docker + Railway ou Vercel + Render | Facil, economico para MVP |

### 6.2 Alternativa Simplificada (Full Python)

Se preferir manter tudo em Python:
- **Frontend**: Streamlit ou Gradio (mais rapido para MVP, menos customizavel)
- **Backend**: FastAPI (mesmo)
- **Trade-off**: Interface menos polida, mas MVP muito mais rapido de implementar

### 6.3 Por que esta stack?

1. **Python para AI/RAG** e o padrao da industria - LangChain, LlamaIndex, PyMuPDF funcionam nativamente
2. **Next.js no front** permite replicar o design bonito dos prototipos HTML existentes
3. **Claude API** entende portugues tecnico melhor que concorrentes e tem janela de contexto enorme
4. **Supabase unificado** resolve 3 problemas com 1 servico: banco relacional (usuarios/sessoes/historico) + vector store (pgvector para embeddings) + auth pronto. Free tier suporta ate 50k usuarios e 500MB
5. **Custo estimado MVP**: ~$50-100/mes (API Claude + hosting). Supabase free tier incluso

---

## 7. Arquitetura de Alto Nivel

```
[Usuario/Browser]
       |
   [Next.js Frontend]
       |
   [FastAPI Backend]
      / \
     /   \
[Supabase]    [Claude API]
 |-- pgvector    (gera respostas)
 |   (embeddings normas)
 |-- PostgreSQL
 |   (usuarios, sessoes, historico)
 |-- Supabase Auth
     (login, JWT, RLS)
```

### Fluxo RAG:
1. Usuario faz login via Supabase Auth
2. Usuario faz pergunta no chat
3. Backend gera embedding da pergunta e busca os 5-10 chunks mais relevantes via pgvector (Supabase)
4. Chunks + pergunta sao enviados para a Claude API como contexto
5. Claude gera resposta citando as normas
6. Resposta e exibida no chat com as referencias
7. Conversa e salva no PostgreSQL (Supabase) para historico

---

## 8. Criterios de Aceitacao do MVP

- [ ] Usuario consegue fazer login com email/senha
- [ ] Usuario consegue fazer perguntas em linguagem natural
- [ ] Assistente responde com base nas normas indexadas
- [ ] Respostas incluem citacao da norma de origem (nome do documento + secao)
- [ ] Interface funciona em desktop e mobile
- [ ] Historico de conversa e mantido por sessao
- [ ] Botao de nova conversa funciona
- [ ] Tempo de resposta < 10 segundos
- [ ] Design segue a identidade visual Freitag (verde #0A5F38, tipografia DM Sans/Libre Baskerville)

---

## 9. Riscos e Mitigacoes

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| PDFs com tabelas complexas nao extraem bem | Respostas imprecisas | Usar Unstructured.io + revisao manual dos chunks criticos |
| Standard Methods 24ed e muito grande (60MB+) | Lentidao na indexacao | Chunking otimizado, processar uma vez e cachear |
| Alucinacoes da LLM | Informacao incorreta sobre normas | Prompt engineering rigido: "Responda APENAS com base no contexto fornecido" |
| Custo de API escala com uso | Budget excedido | Monitorar tokens, implementar cache de respostas frequentes |
| Normas atualizam periodicamente | Base desatualizada | Processo manual de re-indexacao quando nova versao sair |

---

## 10. Roadmap Pos-MVP

| Fase | Funcionalidade | Timeline estimado |
|------|---------------|-------------------|
| v1.1 | Upload de novas normas via admin panel | +2-4 semanas |
| v1.2 | Integracao com LIMS para consulta de laudos | +1-2 meses |
| v2.0 | Abertura para clientes externos | +2-3 meses |
| v2.1 | Agendamento de coleta via chat | +3-4 meses |
| v2.2 | Analytics de perguntas mais frequentes | +4 meses |

---

## 11. Metricas de Sucesso

| Metrica | Meta MVP |
|---------|----------|
| Tempo medio de resposta | < 10s |
| Taxa de satisfacao (like/dislike) | > 80% likes |
| Adocao da equipe | > 70% da equipe usando semanalmente |
| Reducao de tempo em consulta manual | > 50% |

---

*Documento gerado por Orion (AIOS Master) | 2026-02-19*
