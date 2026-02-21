"""
Script to ingest PDF files and create embeddings in Supabase.

Handles large documents (1000+ pages) with:
- Rate limiting for Google free tier
- Checkpoint/resume capability
- Progress tracking
- Batch processing

Usage:
    python -m scripts.ingest_pdfs --pdf-dir ../normas/
    python -m scripts.ingest_pdfs --pdf-dir ../normas/ --resume   # resume from checkpoint
    python -m scripts.ingest_pdfs --pdf-dir ../normas/ --file Standard-Methods-24ed.pdf  # single file
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import fitz  # PyMuPDF
from dotenv import load_dotenv

from app.config import get_settings
from app.models.database import get_supabase_client
from app.utils.text_processing import clean_text, chunk_text

load_dotenv()

CHECKPOINT_FILE = Path(__file__).parent / ".ingest_checkpoint.json"

# Rate limiting for Google free tier (gemini-embedding-001)
# Free tier: 1,500 RPD, 100 RPM, 500k TPM
BATCH_SIZE = 10                 # chunks per batch (conservative)
DELAY_BETWEEN_BATCHES = 5.0     # seconds between batches
DELAY_BETWEEN_DOCS = 10.0       # seconds between documents
MAX_RETRIES = 3                 # max retries on rate limit
RETRY_BASE_DELAY = 60           # base delay on rate limit (seconds)

# Map of filenames to metadata
PDF_METADATA = {
    "ABNT-NBR-10004-2024-P1.pdf": {
        "name": "ABNT NBR 10004-2024 - Parte 1",
        "doc_type": "norma_tecnica",
    },
    "ABNT-NBR-10004-2024-P2.pdf": {
        "name": "ABNT NBR 10004-2024 - Parte 2",
        "doc_type": "norma_tecnica",
    },
    "MAPA-Metodos-Microbiologicos.pdf": {
        "name": "Métodos Oficiais MAPA - Microbiológicos",
        "doc_type": "manual_oficial",
    },
    "MAPA-Metodos-Quimicos.pdf": {
        "name": "Métodos Oficiais MAPA - Químicos",
        "doc_type": "manual_oficial",
    },
    "Standard-Methods-24ed.pdf": {
        "name": "Standard Methods for Water and Wastewater 24th Ed.",
        "doc_type": "referencia_internacional",
    },
    "Farmacopeia-Brasileira-7-Vol1.pdf": {
        "name": "Farmacopeia Brasileira 7ª Edição - Vol. I",
        "doc_type": "farmacopeia",
    },
}


def load_checkpoint() -> dict:
    """Load checkpoint from file."""
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE) as f:
            return json.load(f)
    return {"completed_files": [], "current_file": None, "current_batch": 0}


def save_checkpoint(data: dict):
    """Save checkpoint to file."""
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(data, f, indent=2)


def clear_checkpoint():
    """Remove checkpoint file."""
    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()


def extract_text_from_pdf(pdf_path: str) -> list[dict]:
    """Extract text from PDF, page by page, with progress."""
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    pages = []

    print(f"  Extracting text from {total_pages} pages...")

    for page_num in range(total_pages):
        page = doc[page_num]
        text = page.get_text()

        if text.strip():
            pages.append({
                "page_number": page_num + 1,
                "text": clean_text(text),
            })

        # Progress every 100 pages
        if (page_num + 1) % 100 == 0:
            pct = ((page_num + 1) / total_pages) * 100
            print(f"    ... {page_num + 1}/{total_pages} pages ({pct:.0f}%)")

    doc.close()
    print(f"  Extracted {len(pages)} pages with text (of {total_pages} total)")
    return pages


def create_chunks(pages: list[dict], chunk_size: int, chunk_overlap: int) -> list[dict]:
    """Create chunks from extracted pages."""
    all_chunks = []

    for page in pages:
        page_text = page["text"]
        page_num = page["page_number"]

        chunks = chunk_text(page_text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)

        for chunk in chunks:
            if len(chunk.strip()) > 50:  # Skip very short chunks
                all_chunks.append({
                    "content": chunk,
                    "page_start": page_num,
                    "page_end": page_num,
                })

    print(f"  Created {len(all_chunks)} chunks")
    return all_chunks


# Module-level client (reused across batches)
_genai_client = None
_embed_config = None


def _get_genai_client(settings):
    """Get or create the Google GenAI client."""
    global _genai_client, _embed_config
    if _genai_client is None:
        from google import genai
        from google.genai import types
        _genai_client = genai.Client(api_key=settings.google_api_key)
        _embed_config = types.EmbedContentConfig(output_dimensionality=settings.embedding_dimensions)
    return _genai_client, _embed_config


def generate_embeddings_batch(texts: list[str], settings) -> list[list[float]]:
    """Generate embeddings for a batch of texts using Google Gemini."""
    client, embed_config = _get_genai_client(settings)

    embeddings = []
    for idx, text in enumerate(texts):
        for attempt in range(MAX_RETRIES):
            try:
                result = client.models.embed_content(
                    model=settings.embedding_model,
                    contents=text,
                    config=embed_config,
                )
                embeddings.append(list(result.embeddings[0].values))
                # Small delay between individual calls to avoid rate limits
                if idx < len(texts) - 1:
                    time.sleep(0.5)
                break
            except Exception as e:
                error_msg = str(e)
                if ("429" in error_msg or "quota" in error_msg.lower() or "expired" in error_msg.lower()) and attempt < MAX_RETRIES - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    print(f"\n  Rate limit hit (attempt {attempt + 1}/{MAX_RETRIES}). Waiting {delay}s...")
                    time.sleep(delay)
                else:
                    raise

    return embeddings


def ingest_pdf(
    pdf_path: str,
    settings,
    supabase,
    checkpoint: dict,
    resume_batch: int = 0,
):
    """Ingest a single PDF file with checkpoint support."""
    file_name = os.path.basename(pdf_path)
    metadata = PDF_METADATA.get(file_name, {
        "name": file_name,
        "doc_type": "outro",
    })

    print(f"\n{'='*60}")
    print(f"Processing: {metadata['name']}")
    print(f"  File: {file_name}")
    print(f"{'='*60}")

    # 1. Extract text
    pages = extract_text_from_pdf(pdf_path)
    if not pages:
        print("  WARNING: No text extracted. Skipping.")
        return

    # 2. Create chunks
    chunks = create_chunks(pages, settings.chunk_size, settings.chunk_overlap)
    total_batches = (len(chunks) - 1) // BATCH_SIZE + 1

    # 3. Register document (or find existing if resuming)
    if resume_batch > 0:
        # Find existing document
        result = (
            supabase.table("documents")
            .select("id")
            .eq("file_name", file_name)
            .execute()
        )
        if result.data:
            document_id = result.data[0]["id"]
            print(f"  Resuming document ID: {document_id} from batch {resume_batch + 1}")
        else:
            resume_batch = 0  # Document not found, start fresh

    if resume_batch == 0:
        # Delete existing document data if re-indexing
        existing = (
            supabase.table("documents")
            .select("id")
            .eq("file_name", file_name)
            .execute()
        )
        if existing.data:
            supabase.table("documents").delete().eq("file_name", file_name).execute()
            print(f"  Removed previous index for {file_name}")

        doc_result = supabase.table("documents").insert({
            "name": metadata["name"],
            "file_name": file_name,
            "doc_type": metadata["doc_type"],
            "total_pages": len(pages),
            "total_chunks": len(chunks),
        }).execute()

        document_id = doc_result.data[0]["id"]
        print(f"  Document ID: {document_id}")

    # 4. Process in batches with rate limiting
    start_time = time.time()

    for batch_idx in range(resume_batch, total_batches):
        i = batch_idx * BATCH_SIZE
        batch = chunks[i:i + BATCH_SIZE]
        texts = [c["content"] for c in batch]

        pct = ((batch_idx + 1) / total_batches) * 100
        elapsed = time.time() - start_time
        if batch_idx > resume_batch:
            batches_done = batch_idx - resume_batch
            avg_time = elapsed / batches_done
            remaining = avg_time * (total_batches - batch_idx - 1)
            eta = f"~{remaining/60:.1f}min left"
        else:
            eta = "calculating..."

        print(
            f"  Batch {batch_idx + 1}/{total_batches} "
            f"({pct:.0f}%) - {len(batch)} chunks - {eta}"
        )

        # Generate embeddings
        batch_embeddings = generate_embeddings_batch(texts, settings)

        # Insert chunks with embeddings
        rows = []
        for j, (chunk, embedding) in enumerate(zip(batch, batch_embeddings)):
            rows.append({
                "document_id": document_id,
                "chunk_index": i + j,
                "content": chunk["content"],
                "embedding": embedding,
                "page_start": chunk["page_start"],
                "page_end": chunk["page_end"],
            })

        supabase.table("document_chunks").insert(rows).execute()

        # Save checkpoint
        checkpoint["current_file"] = file_name
        checkpoint["current_batch"] = batch_idx + 1
        save_checkpoint(checkpoint)

        # Rate limiting delay
        if batch_idx < total_batches - 1:
            time.sleep(DELAY_BETWEEN_BATCHES)

    elapsed_total = time.time() - start_time
    print(f"  Done! {len(chunks)} chunks indexed in {elapsed_total/60:.1f} minutes")

    # Mark file as completed
    checkpoint["completed_files"].append(file_name)
    checkpoint["current_file"] = None
    checkpoint["current_batch"] = 0
    save_checkpoint(checkpoint)


def main():
    parser = argparse.ArgumentParser(description="Ingest PDFs into Supabase vector store")
    parser.add_argument("--pdf-dir", default="../normas/", help="Directory with PDF files")
    parser.add_argument("--resume", action="store_true", help="Resume from last checkpoint")
    parser.add_argument("--file", type=str, help="Process only this specific file")
    parser.add_argument("--clear", action="store_true", help="Clear checkpoint and start fresh")
    args = parser.parse_args()

    settings = get_settings()
    supabase = get_supabase_client(settings)

    pdf_dir = Path(args.pdf_dir)
    if not pdf_dir.exists():
        print(f"Error: Directory {pdf_dir} not found")
        sys.exit(1)

    if args.clear:
        clear_checkpoint()
        print("Checkpoint cleared.")

    # Load or create checkpoint
    checkpoint = load_checkpoint() if args.resume else {
        "completed_files": [],
        "current_file": None,
        "current_batch": 0,
    }

    # Get PDF files
    if args.file:
        pdf_files = [pdf_dir / args.file]
        if not pdf_files[0].exists():
            print(f"Error: File {args.file} not found in {pdf_dir}")
            sys.exit(1)
    else:
        pdf_files = sorted(pdf_dir.glob("*.pdf"))

    print(f"Found {len(pdf_files)} PDF files in {pdf_dir}")
    print(f"Batch size: {BATCH_SIZE} | Delay: {DELAY_BETWEEN_BATCHES}s between batches")

    if checkpoint["completed_files"]:
        print(f"Already completed: {', '.join(checkpoint['completed_files'])}")

    total_start = time.time()

    for pdf_path in pdf_files:
        file_name = pdf_path.name

        # Skip completed files
        if file_name in checkpoint.get("completed_files", []):
            print(f"\nSkipping {file_name} (already completed)")
            continue

        # Check if resuming a partially completed file
        resume_batch = 0
        if (
            args.resume
            and checkpoint.get("current_file") == file_name
            and checkpoint.get("current_batch", 0) > 0
        ):
            resume_batch = checkpoint["current_batch"]

        ingest_pdf(str(pdf_path), settings, supabase, checkpoint, resume_batch)

        # Delay between documents
        if pdf_path != pdf_files[-1]:
            print(f"\n  Waiting {DELAY_BETWEEN_DOCS}s before next document...")
            time.sleep(DELAY_BETWEEN_DOCS)

    total_elapsed = time.time() - total_start
    print(f"\n{'='*60}")
    print(f"All done! {len(pdf_files)} documents processed in {total_elapsed/60:.1f} minutes")
    print(f"{'='*60}")

    # Clear checkpoint on success
    clear_checkpoint()


if __name__ == "__main__":
    main()
