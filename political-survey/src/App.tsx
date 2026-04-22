import { useState } from 'react';
import { QUESTIONS, calculateResults, PartyId } from './data/surveyData';
import WelcomeScreen from './components/WelcomeScreen';
import QuestionCard from './components/QuestionCard';
import ResultsScreen from './components/ResultsScreen';

type Screen = 'welcome' | 'survey' | 'results';

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<PartyId, number> | null>(null);

  const currentQuestion = QUESTIONS[currentIndex];

  const handleStart = () => {
    setCurrentIndex(0);
    setAnswers({});
    setResults(null);
    setScreen('survey');
  };

  const handleSelect = (optionId: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
  };

  const handleNext = () => {
    if (currentIndex < QUESTIONS.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      const r = calculateResults(answers);
      setResults(r);
      setScreen('results');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleRetake = () => {
    setScreen('welcome');
  };

  if (screen === 'welcome') return <WelcomeScreen onStart={handleStart} />;

  if (screen === 'results' && results)
    return <ResultsScreen results={results} onRetake={handleRetake} />;

  return (
    <QuestionCard
      question={currentQuestion}
      totalQuestions={QUESTIONS.length}
      selected={answers[currentQuestion.id] ?? null}
      onSelect={handleSelect}
      onNext={handleNext}
      onBack={handleBack}
      isFirst={currentIndex === 0}
      isLast={currentIndex === QUESTIONS.length - 1}
    />
  );
}
