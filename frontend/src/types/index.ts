export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "analyst" | "support" | "coordinator" | "admin";
  department?: string;
  avatar_url?: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  feedback: "like" | "dislike" | null;
  created_at: string;
}

export interface Source {
  document_name: string;
  section: string | null;
  page: number | null;
  similarity: number;
}

export interface Document {
  id: string;
  name: string;
  file_name: string;
  doc_type: string;
  total_pages: number;
  total_chunks: number;
  indexed_at: string;
}
