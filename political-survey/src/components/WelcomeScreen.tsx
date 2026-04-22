interface Props {
  onStart: () => void;
}

export default function WelcomeScreen({ onStart }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-lg w-full">
        <p className="text-yellow-400 text-sm font-semibold tracking-widest uppercase mb-3">
          Tamil Nadu Assembly Election 2026
        </p>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-4">
          My Political Match
        </h1>

        <p className="text-gray-400 text-base sm:text-lg leading-relaxed mb-8">
          Answer 10 policy questions based on the manifestos of{' '}
          <span className="text-white font-medium">DMK</span>,{' '}
          <span className="text-white font-medium">AIADMK</span>,{' '}
          <span className="text-white font-medium">TVK</span> and{' '}
          <span className="text-white font-medium">NTK</span>. Discover which
          party's stated policies best align with your views.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-8 text-sm text-gray-400">
          {[
            ['📋', '10 questions'],
            ['⏱️', 'About 2 minutes'],
            ['🔒', 'Anonymous — no data stored'],
            ['⚖️', 'Neutral & fact-based'],
          ].map(([icon, label]) => (
            <div
              key={label}
              className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"
            >
              <span>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-lg py-4 rounded-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-black"
        >
          Take the quiz →
        </button>

        <p className="mt-6 text-xs text-gray-600">
          This quiz is non-partisan. Positions are sourced from publicly available
          party manifestos and official policy statements. It does not endorse any
          political party.
        </p>
      </div>
    </div>
  );
}
