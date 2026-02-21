import type { Source } from "./ChatInterface";

interface SourceCitationProps {
  source: Source;
}

export default function SourceCitation({ source }: SourceCitationProps) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-freitag-accent/10 border border-freitag-accent/20 rounded-lg text-xs">
      <svg className="w-3.5 h-3.5 fill-freitag-green shrink-0" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
      <span className="text-freitag-green-dark font-medium">
        {source.documentName}
        {source.section && ` - ${source.section}`}
        {source.page && `, p. ${source.page}`}
      </span>
    </div>
  );
}
