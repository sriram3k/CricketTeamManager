import { useEffect, useState } from 'react';
import { PARTIES, getTopParty, PartyId } from '../data/surveyData';

interface Props {
  results: Record<PartyId, number>;
  onRetake: () => void;
}

export default function ResultsScreen({ results, onRetake }: Props) {
  const [animatedWidths, setAnimatedWidths] = useState<Record<PartyId, number>>(
    { DMK: 0, AIADMK: 0, TVK: 0, NTK: 0 }
  );

  const topPartyId = getTopParty(results);
  const topParty = PARTIES.find((p) => p.id === topPartyId)!;

  // Sort parties by score descending
  const sortedParties = [...PARTIES].sort((a, b) => results[b.id] - results[a.id]);

  // Trigger bar animation after mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      setAnimatedWidths({ ...results });
    }, 100);
    return () => clearTimeout(timeout);
  }, [results]);

  const shareText = `I took the Tamil Nadu 2026 Political Match quiz and my top match is ${topPartyId} (${results[topPartyId]}%). Find your match at`;

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Tamil Nadu Political Match', text: shareText, url });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      alert('Result copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-md w-full">
        {/* Header */}
        <p className="text-yellow-400 text-sm font-semibold tracking-widest uppercase mb-2">
          Tamil Nadu Assembly Election 2026
        </p>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
          My Political Match
        </h1>

        {/* Top party */}
        <p
          className="text-3xl sm:text-4xl font-bold mb-1"
          style={{ color: topParty.color }}
        >
          {topParty.name}
        </p>

        {/* Big percentage */}
        <div className="mb-6">
          <span className="font-serif text-8xl sm:text-9xl font-light text-white leading-none">
            {results[topPartyId]}
          </span>
          <span className="font-serif text-5xl sm:text-6xl font-light text-white">%</span>
        </div>

        {/* Alignment bars */}
        <p className="text-gray-400 text-sm mb-4">Top alignments</p>

        <div className="space-y-5">
          {sortedParties.map((party) => {
            const pct = results[party.id];
            const animPct = animatedWidths[party.id];
            return (
              <div key={party.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white font-bold text-base w-20">{party.name}</span>
                  <span className="text-white font-semibold text-base">{pct}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-6 rounded-full bar-fill"
                    style={{
                      width: `${animPct}%`,
                      backgroundColor: party.barColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Disclaimer */}
        <p className="mt-6 text-xs text-gray-600 leading-relaxed">
          Results reflect alignment with publicly stated party manifesto positions only.
          This quiz is non-partisan and does not endorse any political party.
        </p>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleShare}
            className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 rounded-xl transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            Share my result
          </button>
          <button
            onClick={onRetake}
            className="flex-1 border border-white/20 text-gray-300 hover:text-white hover:border-white/40 font-medium py-3 rounded-xl transition-colors duration-150 focus:outline-none"
          >
            Retake quiz
          </button>
        </div>
      </div>
    </div>
  );
}
