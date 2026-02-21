interface WelcomeStateProps {
  onSuggestionClick: (text: string) => void;
}

const suggestions = [
  "Qual o método oficial para análise de coliformes totais em água?",
  "Como classificar resíduos sólidos segundo a ABNT NBR 10004?",
  "Qual a temperatura de incubação para ensaio de Salmonella?",
  "Quais métodos a Farmacopeia Brasileira indica para teste de dissolução?",
];

export default function WelcomeState({ onSuggestionClick }: WelcomeStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-freitag-green to-freitag-green-light rounded-3xl flex items-center justify-center mb-7 shadow-[0_8px_30px_rgba(10,95,56,0.25)]">
        <svg className="w-10 h-10 fill-white" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
      </div>
      <h2 className="text-3xl font-bold text-text-primary mb-3">
        Olá! Como posso ajudar?
      </h2>
      <p className="text-text-secondary max-w-lg mb-10">
        Sou o NormaChat, assistente virtual da Freitag Laboratórios. Posso ajudar com consultas sobre normas técnicas, métodos de análise e padrões regulatórios.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[820px] w-full">
        {suggestions.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => onSuggestionClick(suggestion)}
            className="text-left p-4 bg-bg-card border border-transparent rounded-xl text-sm text-text-secondary shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:border-freitag-green hover:bg-freitag-green/5 hover:text-text-primary hover:shadow-[0_4px_16px_rgba(10,95,56,0.12)] active:scale-[0.98] transition-all cursor-pointer group"
          >
            <span className="text-freitag-green font-semibold mr-2 group-hover:mr-3 transition-all">→</span>
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
