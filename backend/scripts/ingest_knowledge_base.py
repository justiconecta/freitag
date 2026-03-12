"""
Script to ingest Markdown knowledge base files into Supabase vector store.

Splits content by sections (## headers separated by ---) for semantic chunking,
then generates embeddings and stores in document_chunks table.

Usage:
    python -m scripts.ingest_knowledge_base
    python -m scripts.ingest_knowledge_base --file data/conhecimento-freitag.md
    python -m scripts.ingest_knowledge_base --dry-run  # preview chunks without inserting
"""

import argparse
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

from app.config import get_settings
from app.models.database import get_supabase_client

load_dotenv(Path(__file__).parent.parent.parent / ".env")

# Rate limiting for Google free tier
BATCH_SIZE = 10
DELAY_BETWEEN_BATCHES = 5.0
MAX_RETRIES = 3
RETRY_BASE_DELAY = 60

# Knowledge base files metadata
KB_METADATA = {
    "conhecimento-freitag.md": {
        "name": "Base de Conhecimento — Freitag Laboratórios",
        "doc_type": "conhecimento_institucional",
    },
}


def parse_markdown_sections(filepath: str) -> list[dict]:
    """Parse a Markdown file into sections split by ## headers and --- separators."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Split by --- separators
    raw_sections = re.split(r"\n---\n", content)

    sections = []
    for raw in raw_sections:
        raw = raw.strip()
        if not raw or len(raw) < 30:
            continue

        # Extract section title from ## header
        title_match = re.match(r"^#+\s+(.+)", raw)
        title = title_match.group(1).strip() if title_match else None

        # Remove the header line from content for cleaner embedding
        if title_match:
            body = raw[title_match.end():].strip()
        else:
            body = raw

        if len(body) < 20:
            continue

        sections.append({
            "section_title": title,
            "content": body,
        })

    return sections


_genai_client = None
_embed_config = None


def _get_genai_client(settings):
    """Get or create the Google GenAI client."""
    global _genai_client, _embed_config
    if _genai_client is None:
        from google import genai
        from google.genai import types
        _genai_client = genai.Client(api_key=settings.google_api_key)
        _embed_config = types.EmbedContentConfig(
            output_dimensionality=settings.embedding_dimensions
        )
    return _genai_client, _embed_config


def generate_embedding(text: str, settings) -> list[float]:
    """Generate embedding for a single text using Google Gemini."""
    client, embed_config = _get_genai_client(settings)

    for attempt in range(MAX_RETRIES):
        try:
            result = client.models.embed_content(
                model=settings.embedding_model,
                contents=text,
                config=embed_config,
            )
            return list(result.embeddings[0].values)
        except Exception as e:
            error_msg = str(e)
            if ("429" in error_msg or "quota" in error_msg.lower()) and attempt < MAX_RETRIES - 1:
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                print(f"  Rate limit hit (attempt {attempt + 1}/{MAX_RETRIES}). Waiting {delay}s...")
                time.sleep(delay)
            else:
                raise


def generate_embeddings_batch(texts: list[str], settings) -> list[list[float]]:
    """Generate embeddings for a batch of texts."""
    embeddings = []
    for idx, text in enumerate(texts):
        embedding = generate_embedding(text, settings)
        embeddings.append(embedding)
        if idx < len(texts) - 1:
            time.sleep(0.5)
    return embeddings


def ingest_knowledge_base(filepath: str, settings, supabase, dry_run: bool = False):
    """Ingest a single Markdown knowledge base file."""
    file_name = Path(filepath).name
    metadata = KB_METADATA.get(file_name, {
        "name": file_name,
        "doc_type": "conhecimento_institucional",
    })

    print(f"\n{'='*60}")
    print(f"Processing: {metadata['name']}")
    print(f"  File: {file_name}")
    print(f"{'='*60}")

    # 1. Parse sections
    sections = parse_markdown_sections(filepath)
    print(f"  Found {len(sections)} sections")

    if dry_run:
        print("\n  [DRY RUN] Preview of sections:")
        for i, section in enumerate(sections):
            title = section["section_title"] or "(sem título)"
            content_preview = section["content"][:100].replace("\n", " ")
            print(f"    {i+1}. [{title}] {content_preview}...")
        print(f"\n  Total: {len(sections)} chunks would be created")
        return

    # 2. Remove existing document data if re-indexing
    existing = (
        supabase.table("documents")
        .select("id")
        .eq("file_name", file_name)
        .execute()
    )
    if existing.data:
        supabase.table("documents").delete().eq("file_name", file_name).execute()
        print(f"  Removed previous index for {file_name}")

    # 3. Register document
    doc_result = supabase.table("documents").insert({
        "name": metadata["name"],
        "file_name": file_name,
        "doc_type": metadata["doc_type"],
        "total_pages": 1,
        "total_chunks": len(sections),
    }).execute()

    document_id = doc_result.data[0]["id"]
    print(f"  Document ID: {document_id}")

    # 4. Process in batches
    total_batches = (len(sections) - 1) // BATCH_SIZE + 1
    start_time = time.time()

    for batch_idx in range(total_batches):
        i = batch_idx * BATCH_SIZE
        batch = sections[i:i + BATCH_SIZE]

        # Embed with section title prepended for better semantic search
        texts = []
        for s in batch:
            if s["section_title"]:
                texts.append(f"{s['section_title']}: {s['content']}")
            else:
                texts.append(s["content"])

        pct = ((batch_idx + 1) / total_batches) * 100
        print(f"  Batch {batch_idx + 1}/{total_batches} ({pct:.0f}%) - {len(batch)} sections")

        # Generate embeddings
        batch_embeddings = generate_embeddings_batch(texts, settings)

        # Insert chunks
        rows = []
        for j, (section, embedding) in enumerate(zip(batch, batch_embeddings)):
            rows.append({
                "document_id": document_id,
                "chunk_index": i + j,
                "content": section["content"],
                "embedding": embedding,
                "page_start": None,
                "page_end": None,
                "section_title": section["section_title"],
            })

        supabase.table("document_chunks").insert(rows).execute()

        # Rate limiting
        if batch_idx < total_batches - 1:
            time.sleep(DELAY_BETWEEN_BATCHES)

    elapsed = time.time() - start_time
    print(f"  Done! {len(sections)} sections indexed in {elapsed:.1f}s")


def main():
    parser = argparse.ArgumentParser(description="Ingest Markdown knowledge base into Supabase")
    parser.add_argument(
        "--file",
        type=str,
        default="data/conhecimento-freitag.md",
        help="Path to Markdown file (relative to backend/)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview chunks without inserting")
    args = parser.parse_args()

    settings = get_settings()

    filepath = Path(__file__).parent.parent / args.file
    if not filepath.exists():
        print(f"Error: File {filepath} not found")
        sys.exit(1)

    if args.dry_run:
        print("DRY RUN MODE — no database changes will be made\n")
        ingest_knowledge_base(str(filepath), settings, None, dry_run=True)
    else:
        supabase = get_supabase_client(settings)
        ingest_knowledge_base(str(filepath), settings, supabase)

    print(f"\n{'='*60}")
    print("Knowledge base ingestion complete!")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
