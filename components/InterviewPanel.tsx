import React, { useState } from 'react';
import { CheckCircle2, Send, Loader2 } from 'lucide-react';
import { InterviewQuestion } from '../types';

interface InterviewPanelProps {
  questions: InterviewQuestion[];
  onComplete: (answers: { label: string; answer: string }[]) => void;
  isGenerating: boolean;
  description: string;
}

export const InterviewPanel: React.FC<InterviewPanelProps> = ({
  questions,
  onComplete,
  isGenerating,
  description,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>(() => questions.map(() => null));
  const [customInput, setCustomInput] = useState('');

  const selectAnswer = (answer: string) => {
    const newAnswers = [...answers];
    newAnswers[currentStep] = answer;
    setAnswers(newAnswers);
    setCustomInput('');

    if (currentStep < questions.length - 1) {
      setTimeout(() => setCurrentStep(currentStep + 1), 200);
    } else {
      // Last question — submit all answers
      const compiled = questions.map((q, i) => ({
        label: q.label,
        answer: newAnswers[i]!,
      }));
      onComplete(compiled);
    }
  };

  const handleCustomSubmit = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    selectAnswer(trimmed);
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomSubmit();
    }
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white border-r border-slate-200 px-6">
        <Loader2 className="animate-spin text-blue-500 mb-3" size={28} />
        <p className="text-sm font-medium text-slate-700">Generating your landing page...</p>
        <p className="text-xs text-slate-400 mt-1">This may take a moment</p>
      </div>
    );
  }

  const current = questions[currentStep];

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Progress bar */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500">
            Question {currentStep + 1} of {questions.length}
          </span>
        </div>
        <div className="flex gap-1.5">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= currentStep ? 'bg-blue-500' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Previous answers */}
      {currentStep > 0 && (
        <div className="px-4 py-3 border-b border-slate-100 space-y-1.5">
          {questions.slice(0, currentStep).map((q, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className="flex items-start gap-2 text-xs text-slate-500 w-full text-left hover:text-slate-700 transition-colors"
            >
              <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>
                {q.label}: <span className="font-medium text-slate-700">{answers[i]}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Current question */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">{current.question}</h3>
        <div className="space-y-2">
          {current.options.map((option) => (
            <button
              key={option}
              onClick={() => selectAnswer(option)}
              className={`w-full text-left px-4 py-3 text-sm rounded-lg border transition-all ${
                answers[currentStep] === option
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Custom answer input */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            placeholder="Or type your own answer..."
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customInput.trim()}
            className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
