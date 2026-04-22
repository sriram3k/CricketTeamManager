import { Question } from '../data/surveyData';

interface Props {
  question: Question;
  totalQuestions: number;
  selected: string | null;
  onSelect: (optionId: string) => void;
  onNext: () => void;
  onBack: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export default function QuestionCard({
  question,
  totalQuestions,
  selected,
  onSelect,
  onNext,
  onBack,
  isFirst,
  isLast,
}: Props) {
  const progress = ((question.id - 1) / totalQuestions) * 100;

  return (
    <div className="min-h-screen flex flex-col px-6 py-10">
      {/* Header */}
      <div className="max-w-2xl mx-auto w-full mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-yellow-400 text-xs font-semibold uppercase tracking-widest">
            Tamil Nadu 2026
          </span>
          <span className="text-gray-500 text-sm">
            {question.id} / {totalQuestions}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/10 rounded-full h-1.5">
          <div
            className="bg-yellow-400 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="max-w-2xl mx-auto w-full flex-1">
        <div className="mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {question.topic}
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-6">
          {question.text}
        </h2>

        {/* Options */}
        <div className="space-y-3">
          {question.options.map((option) => {
            const isSelected = selected === option.id;
            return (
              <button
                key={option.id}
                onClick={() => onSelect(option.id)}
                className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-black ${
                  isSelected
                    ? 'border-yellow-400 bg-yellow-400/10 text-white'
                    : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/30 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-yellow-400' : 'border-gray-600'
                    }`}
                  >
                    {isSelected && (
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    )}
                  </div>
                  <span className="text-sm sm:text-base leading-relaxed">
                    {option.text}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-2xl mx-auto w-full mt-8 flex gap-3">
        {!isFirst && (
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-xl border border-white/20 text-gray-400 hover:text-white hover:border-white/40 font-medium transition-colors duration-150 focus:outline-none"
          >
            ← Back
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!selected}
          className={`flex-1 py-3 rounded-xl font-bold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
            selected
              ? 'bg-yellow-400 hover:bg-yellow-300 text-black'
              : 'bg-white/10 text-gray-600 cursor-not-allowed'
          }`}
        >
          {isLast ? 'See my results →' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
