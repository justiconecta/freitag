import re


def clean_text(text: str) -> str:
    """Clean extracted text from PDFs."""
    # Remove excessive whitespace
    text = re.sub(r"\s+", " ", text)
    # Remove page numbers that are standalone
    text = re.sub(r"\n\s*\d+\s*\n", "\n", text)
    # Normalize line breaks
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_text(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 128,
) -> list[str]:
    """Split text into overlapping chunks."""
    words = text.split()
    chunks = []
    start = 0

    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start = end - chunk_overlap

    return chunks
