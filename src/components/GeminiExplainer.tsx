import React, { useState } from "react";
import { Sparkles, BookOpen, Globe, Volume2, AlertCircle, RefreshCw, Send, HelpCircle } from "lucide-react";
import { type StudyCard } from "../lib/api";

interface GeminiExplainerProps {
  card: StudyCard;
  typedAnswer?: string;
  builtAnswer?: string;
}

type ExplainerTab = "grammar" | "culture" | "pitch" | "compare";

export default function GeminiExplainer({ card, typedAnswer, builtAnswer }: GeminiExplainerProps) {
  const [activeTab, setActiveTab] = useState<ExplainerTab>("grammar");
  const [customGuess, setCustomGuess] = useState("");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive relevant default guesses based on card state
  const derivedUserGuess = typedAnswer || builtAnswer || "";

  const handleExplain = async (tab: ExplainerTab, customText?: string) => {
    setLoading(true);
    setError(null);
    setExplanation("");

    const cardRepresentation = `
Card Type: ${card.card_type}
Question/Prompt Text: ${
      card.card_type === "basic"
        ? card.question.text
        : card.card_type === "scramble"
        ? card.question.words.join(", ")
        : card.card_type === "listening"
        ? card.question.tts || "Listening Task"
        : (card.question as any).text || ""
    }
Expected Correct Answer: ${
      card.card_type === "basic"
        ? card.answer.text
        : card.card_type === "scramble"
        ? card.answer.words.join(" ")
        : card.card_type === "pitch"
        ? `Pitch accent type ${card.answer.pitch.type} with accent at mora ${card.answer.pitch.accent}`
        : (card.answer as any).text || ""
    }
`;

    let question = "";
    if (tab === "grammar") {
      question = `Explain the Japanese grammar and usage patterns present in this card. Break down any grammatical particles, conjugations, sentence structures, and vocabulary words so that a Japanese language learner can easily understand. Ensure you explain why this is the correct phrasing.`;
    } else if (tab === "culture") {
      question = `Describe the cultural context, politeness levels (e.g., casual/kudake, polite/teineigo, humble/kenjougo, honorific/sonkeigo), context-appropriate usage, and common everyday scenarios of this card. Are there alternative expressions that are more natural or preferred in specific situations?`;
    } else if (tab === "pitch") {
      question = `Explain the pitch accent, phonetics, and pronunciation rules of the Japanese words in this card. Break down accent patterns (Heiban, Atamadaka, Nakadaka, Odaka) and provide helpful pronunciation tips for language learners.`;
    } else if (tab === "compare") {
      const guessToCompare = customText || customGuess || derivedUserGuess;
      if (!guessToCompare.trim()) {
        setError("Please enter or select a guess to compare.");
        setLoading(false);
        return;
      }
      question = `Analyze my wrong answer / draft guess and compare it with the correct Japanese answer.
My Answer: "${guessToCompare}"
Correct Answer:
${cardRepresentation}

Please do a thorough contrastive analysis:
1. Identify all spelling, grammar, particle, or vocabulary errors in my answer.
2. Explain exactly why these mistakes occur and why the correct answer is grammatically/semantically superior or more natural.
3. Provide constructive recommendations to help me avoid this mistake in the future.`;
    }

    // Append card details to all requests
    const fullQuestion = `${question}\n\nCard details under study:\n${cardRepresentation}`;

    try {
      const response = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: fullQuestion,
          cardId: card.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Unable to initialize streaming connection.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunkValue = decoder.decode(value);
          const lines = chunkValue.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") {
                done = true;
                break;
              }
              try {
                const data = JSON.parse(dataStr);
                if (data.text) {
                  accumulatedText += data.text;
                  setExplanation(accumulatedText);
                } else if (data.error) {
                  setError(data.error);
                }
              } catch {
                // Ignore parsing errors for partial/broken lines
              }
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch on-demand explanation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 border border-white/10 bg-white/5 backdrop-blur-md rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
        <Sparkles className="w-5 h-5 text-[#FF6B6B]" />
        <h3 className="text-base font-semibold text-white tracking-wide">Gemini Explainer AI</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold bg-[#FF6B6B]/20 text-[#FF6B6B] px-2 py-0.5 rounded-full">
          On Demand
        </span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => {
            setActiveTab("grammar");
            setExplanation("");
            setError(null);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "grammar"
              ? "bg-[#FF6B6B] text-white shadow-glow"
              : "bg-white/5 hover:bg-white/10 text-white/70"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Grammar & Nuances
        </button>

        <button
          onClick={() => {
            setActiveTab("culture");
            setExplanation("");
            setError(null);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "culture"
              ? "bg-[#FF6B6B] text-white shadow-glow"
              : "bg-white/5 hover:bg-white/10 text-white/70"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Cultural & Usage
        </button>

        <button
          onClick={() => {
            setActiveTab("pitch");
            setExplanation("");
            setError(null);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "pitch"
              ? "bg-[#FF6B6B] text-white shadow-glow"
              : "bg-white/5 hover:bg-white/10 text-white/70"
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          Pitch & Phonetics
        </button>

        <button
          onClick={() => {
            setActiveTab("compare");
            setExplanation("");
            setError(null);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "compare"
              ? "bg-[#FF6B6B] text-white shadow-glow"
              : "bg-white/5 hover:bg-white/10 text-white/70"
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Analyze Wrong Answer
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "compare" && (
        <div className="mb-4 space-y-3">
          {derivedUserGuess && (
            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
              <span className="text-[10px] text-white/40 block uppercase font-mono mb-1">Detected Attempt</span>
              <p className="text-sm font-semibold text-[#FF6B6B]">"{derivedUserGuess}"</p>
              <button
                disabled={loading}
                onClick={() => handleExplain("compare", derivedUserGuess)}
                className="mt-2 text-xs bg-[#FF6B6B]/20 text-[#FF6B6B] px-3 py-1 rounded-md hover:bg-[#FF6B6B]/30 font-medium transition-all"
              >
                Compare Detected Attempt
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-[11px] text-white/60 font-medium">Or type your guess/incorrect answer to compare:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customGuess}
                onChange={(e) => setCustomGuess(e.target.value)}
                placeholder="e.g. 私は日本語をべんきょうします"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6B6B]/50"
              />
              <button
                disabled={loading || !customGuess.trim()}
                onClick={() => handleExplain("compare", customGuess)}
                className="bg-[#FF6B6B] hover:bg-[#FF6B6B]/90 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 text-white shadow-sm transition-all"
              >
                <Send className="w-3 h-3" />
                Analyze
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab !== "compare" && !explanation && !loading && (
        <div className="flex justify-center my-2">
          <button
            onClick={() => handleExplain(activeTab)}
            className="flex items-center gap-1.5 bg-[#FF6B6B]/15 border border-[#FF6B6B]/30 hover:bg-[#FF6B6B]/25 text-white px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FF6B6B]" />
            Generate On-Demand Explanation
          </button>
        </div>
      )}

      {/* Output Panel */}
      {(loading || explanation || error) && (
        <div className="mt-4 bg-white/5 rounded-xl border border-white/10 p-4 relative overflow-hidden">
          {loading && !explanation && (
            <div className="flex items-center gap-3 text-xs text-white/70 py-4 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin text-[#FF6B6B]" />
              <span>Consulting Gemini models...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {explanation && (
            <div className="prose prose-invert max-w-none text-xs leading-relaxed text-white/90 space-y-2 whitespace-pre-wrap font-sans">
              {explanation}
              {loading && (
                <span className="inline-block w-1.5 h-3 ml-1 bg-[#FF6B6B] animate-pulse" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
