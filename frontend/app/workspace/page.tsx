"use client";

import * as React from "react";
import { useChatStore } from "@/store/chatStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Gauge } from "lucide-react";
import { useSSE } from "@/hooks/useSSE";
import { SplashScreen } from "@/components/workspace/SplashScreen";
import { LeftRail } from "@/components/workspace/LeftRail";
import { HomeView } from "@/components/workspace/HomeView";
import { ExpeditionLog } from "@/components/workspace/ExpeditionLog";
import { JourneyView } from "@/components/workspace/JourneyView";
import { IntelligencePanel } from "@/components/workspace/IntelligencePanel";
import { MobileNav } from "@/components/workspace/MobileNav";

type ScreenState = "splash" | "home" | "ai-plan" | "trip-edit";

export default function WorkspacePage() {
  const [currentScreen, setCurrentScreen] = React.useState<ScreenState>("splash");
  const [leftOpen, setLeftOpen] = React.useState(false);
  const [intelOpen, setIntelOpen] = React.useState(false);
  const [budgetLimit, setBudgetLimit] = React.useState(40000);

  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const clearChat = useChatStore((s) => s.clearChat);

  const dailyPlan = useItineraryStore((s) => s.dailyPlan);
  const budgetSummary = useItineraryStore((s) => s.budgetSummary);
  const activeContext = useItineraryStore((s) => s.activeContext);
  const weatherInfo = useItineraryStore((s) => s.weather);
  const packingList = useItineraryStore((s) => s.packing);
  const travelScore = useItineraryStore((s) => s.travelScore);
  const conversationState = useItineraryStore((s) => s.conversationState);
  const backendOutput = useItineraryStore((s) => s.backendOutput);
  const clearItinerary = useItineraryStore((s) => s.clearItinerary);

  const { startStream, error: sseError } = useSSE();

  const showClarification = conversationState === "WAITING_FOR_CLARIFICATION"
    || activeContext?.state?.conversationState?.currentState === "WAITING_FOR_CLARIFICATION";

  const clarificationTarget = activeContext?.state?.conversationState?.clarificationTarget || null;
  const clarificationConfig = activeContext?.state?.conversationState?.clarificationConfig || null;

  const hasPlan = dailyPlan && dailyPlan.length > 0;

  React.useEffect(() => {
    if (hasPlan && currentScreen === "ai-plan") {
      const t = setTimeout(() => setCurrentScreen("trip-edit"), 0);
      return () => clearTimeout(t);
    }
  }, [hasPlan, currentScreen]);

  const handleSendMessage = (text: string) => startStream(text, activeContext);

  const handleRetry = () => {
    clearChat();
    handleSendMessage("Plan a 5 day Goa trip");
  };

  const handleSwapSlot = (day: number, slotId: string) => {
    handleSendMessage(`Please swap out the activity ${slotId} on day ${day}`);
  };

  const handleStartPlanning = () => {
    clearChat();
    clearItinerary();
    setLeftOpen(false);
    setIntelOpen(false);
    setCurrentScreen("ai-plan");
  };

  const handleSaveTrip = async (status: "draft" | "finalized") => {
    if (!dailyPlan) return;
    try {
      const tripData = {
        status,
        version: 1,
        budget: budgetLimit
      };
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tripData)
      });
      if (res.ok) {
        alert(status === "finalized" ? "Itinerary finalized and saved!" : "Draft saved successfully!");
        if (status === "finalized") {
          clearItinerary();
          setCurrentScreen("home");
        }
      } else {
        alert("Failed to save trip.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving trip.");
    }
  };

  const handleDeleteTrip = () => {
    if (confirm("Are you sure you want to delete this draft?")) {
      clearItinerary();
      setCurrentScreen("home");
    }
  };

  const handleQuick = (text: string) => {
    setLeftOpen(false);
    setCurrentScreen("ai-plan");
    handleSendMessage(text);
  };

  const closeDrawers = () => {
    setLeftOpen(false);
    setIntelOpen(false);
  };

  const title =
    currentScreen === "home"
      ? "Discover"
      : currentScreen === "ai-plan"
      ? "Expedition Log"
      : "The Journey";

  const showIntelToggle = currentScreen === "trip-edit" || currentScreen === "ai-plan";

  return (
    <div className="flex h-full w-full overflow-hidden bg-background font-sans text-foreground">
      <AnimatePresence>
        {currentScreen === "splash" && <SplashScreen onDone={() => setCurrentScreen("home")} />}
      </AnimatePresence>

      <aside className="hidden w-[264px] shrink-0 border-r border-border-soft md:flex">
        <LeftRail
          messages={messages}
          hasTrip={!!dailyPlan}
          current={currentScreen === "splash" ? "home" : currentScreen}
          onNavigate={(s) => setCurrentScreen(s)}
          onQuick={handleQuick}
        />
      </aside>

      <AnimatePresence>
        {leftOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLeftOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-[264px] md:hidden"
            >
              <LeftRail
                messages={messages}
                hasTrip={!!dailyPlan}
                current={currentScreen === "splash" ? "home" : currentScreen}
                onNavigate={(s) => {
                  setCurrentScreen(s);
                  setLeftOpen(false);
                }}
                onQuick={(t) => {
                  handleQuick(t);
                }}
                onClose={() => setLeftOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-soft px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLeftOpen(true)}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-foreground md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-heading font-semibold tracking-tight">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {sseError && (
              <span className="hidden text-[10px] font-mono text-destructive sm:inline">connection lost</span>
            )}
            {showIntelToggle && (
              <button
                onClick={() => setIntelOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-border-soft px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:border-gold/40 hover:text-gold lg:hidden"
                aria-label="Open intelligence panel"
              >
                <Gauge className="h-3.5 w-3.5" /> Intel
              </button>
            )}
          </div>
        </header>

        <main className="scrollbar-refined flex-1 overflow-y-auto px-4 pb-24 pt-6 md:px-8 md:pb-8">
          <AnimatePresence mode="wait">
            {currentScreen === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mx-auto"
              >
                <HomeView
                  hasTrip={!!dailyPlan}
                  onOpenTrip={() => setCurrentScreen("trip-edit")}
                  onStartPlanning={handleStartPlanning}
                  onQuick={handleQuick}
                />
              </motion.div>
            )}

            {currentScreen === "ai-plan" && (
              <motion.div
                key="ai-plan"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mx-auto h-full max-w-[760px]"
              >
                <ExpeditionLog
                  messages={messages}
                  isStreaming={isStreaming}
                  showClarification={showClarification}
                  clarificationTarget={clarificationTarget}
                  clarificationConfig={clarificationConfig}
                  onSend={handleSendMessage}
                  onSelectOption={(opt) => handleSendMessage(opt)}
                />
              </motion.div>
            )}

            {currentScreen === "trip-edit" && hasPlan && (
              <motion.div
                key="trip-edit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <JourneyView
                  dailyPlan={dailyPlan}
                  onSwapSlot={handleSwapSlot}
                  onDelete={handleDeleteTrip}
                  onSaveDraft={() => handleSaveTrip("draft")}
                  onFinalize={() => handleSaveTrip("finalized")}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <aside className="hidden w-[340px] shrink-0 flex-col border-l border-border-soft bg-surface/40 px-4 py-5 lg:flex">
        <IntelligencePanel
          variant={currentScreen === "trip-edit" ? "full" : "compact"}
          weather={weatherInfo}
          budget={budgetSummary}
          travelScore={travelScore}
          packing={packingList}
          dailyPlan={dailyPlan}
          budgetLimit={budgetLimit}
          onBudgetLimitChange={setBudgetLimit}
          onBudgetLimitCommit={(n) => handleSendMessage(`Replan the trip to fit within ₹${n}`)}
        />
      </aside>

      <AnimatePresence>
        {intelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIntelOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 z-50 flex w-[86%] max-w-[360px] flex-col bg-surface px-4 py-5 lg:hidden"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted/60">
                  Intelligence
                </span>
                <button
                  onClick={() => setIntelOpen(false)}
                  className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-foreground"
                  aria-label="Close intelligence"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="scrollbar-refined mt-4 flex-1 overflow-y-auto pr-2">
                <IntelligencePanel
                  variant={currentScreen === "trip-edit" ? "full" : "compact"}
                  weather={weatherInfo}
                  budget={budgetSummary}
                  travelScore={travelScore}
                  packing={packingList}
                  dailyPlan={dailyPlan}
                  budgetLimit={budgetLimit}
                  onBudgetLimitChange={setBudgetLimit}
                  onBudgetLimitCommit={(n) => handleSendMessage(`Replan the trip to fit within ₹${n}`)}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <MobileNav
        current={currentScreen === "splash" ? "home" : currentScreen}
        hasTrip={!!dailyPlan}
        intelOpen={intelOpen}
        onNavigate={(s) => {
          setCurrentScreen(s);
          closeDrawers();
        }}
        onToggleIntel={() => setIntelOpen((v) => !v)}
      />
    </div>
  );
}
