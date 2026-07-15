"use client";

import * as React from "react";
import { useUIStore } from "@/store/uiStore";
import { useChatStore } from "@/store/chatStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Moon,
  Menu,
  Compass,
  Calendar,
  Wallet,
  Settings,
  ArrowRight,
  CloudSun,
  Briefcase,
  Play,
  Trash2,
  Check,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { ItineraryTimeline } from "@/components/itinerary/ItineraryTimeline";
import { BudgetSummary } from "@/components/itinerary/BudgetSummary";
import { LeafletMap } from "@/components/map/LeafletMap";
import { useSSE } from "@/hooks/useSSE";
import { SystemStatusWidget } from "@/components/status/SystemStatusWidget";

type ScreenState = "splash" | "home" | "ai-plan" | "trip-edit";

export default function WorkspacePage() {
  const [currentScreen, setCurrentScreen] = React.useState<ScreenState>("splash");
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { theme, setTheme } = useTheme();

  // Chat & Itinerary Store bindings
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const clearChat = useChatStore((s) => s.clearChat);

  const dailyPlan = useItineraryStore((s) => s.dailyPlan);
  const budgetSummary = useItineraryStore((s) => s.budgetSummary);
  const activeContext = useItineraryStore((s) => s.activeContext);
  const weatherInfo = useItineraryStore((s) => s.weather);
  const packingList = useItineraryStore((s) => s.packing);
  const setItinerary = useItineraryStore((s) => s.setItinerary);
  const clearItinerary = useItineraryStore((s) => s.clearItinerary);

  const { startStream, error: sseError } = useSSE();
  const [budgetLimit, setBudgetLimit] = React.useState(40000);
  const showClarification = activeContext?.state?.conversationState?.currentState === "WAITING_FOR_CLARIFICATION";

  // 1. Splash Timeout
  React.useEffect(() => {
    if (currentScreen === "splash") {
      const timer = setTimeout(() => {
        setCurrentScreen("home");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  // 2. Transition automatically when plan loads
  React.useEffect(() => {
    if (dailyPlan && dailyPlan.length > 0 && currentScreen === "ai-plan") {
      const timer = setTimeout(() => {
        setCurrentScreen("trip-edit");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [dailyPlan, currentScreen]);

  // 3. Connect real SSE handler
  const handleSendMessage = (text: string) => {
    startStream(text, activeContext);
  };

  const handleRetry = () => {
    clearChat();
    handleSendMessage("Plan a 5 day Goa trip");
  };

  // Local card mutation swap
  const handleSwapSlot = (day: number, slotId: string) => {
    if (!dailyPlan) return;
    const updatedPlan = dailyPlan.map((d) => {
      if (d.day === day) {
        const updatedSlots = d.slots.map((s: any) => {
          if (s.nodeId === slotId) {
            return { ...s, name: `${s.name} (Alternate Selection)`, price: (s.price || 500) + 150 };
          }
          return s;
        });
        return { ...d, slots: updatedSlots };
      }
      return d;
    });
    setItinerary(updatedPlan, budgetSummary, activeContext, weatherInfo, packingList);
  };

  const handleStartPlanning = () => {
    clearChat();
    clearItinerary();
    setCurrentScreen("ai-plan");
  };

  return (
    <div className="flex h-full w-full bg-background text-foreground overflow-hidden font-sans">
      <AnimatePresence mode="wait">
        {/* State 1: Splash Screen */}
        {currentScreen === "splash" && (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="text-center space-y-2"
            >
              <h1 className="text-3xl font-heading font-semibold tracking-wider text-primary uppercase">
                Travel OS
              </h1>
              <p className="text-[10px] font-mono text-muted tracking-widest uppercase opacity-60">
                Intelligence Engine
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* Unified Application Shell */}
        {currentScreen !== "splash" && (
          <motion.div
            key="app-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex h-full w-full overflow-hidden"
          >
            {/* Sidebar Navigation */}
            <aside
              className={`fixed inset-y-0 left-0 z-20 flex flex-col w-[240px] bg-card border-r border-border transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
                sidebarOpen ? "translate-x-0 block" : "-translate-x-full hidden md:flex"
              }`}
            >
              <div className="flex h-14 items-center justify-between px-4 border-b border-border">
                <span className="text-sm font-heading font-semibold tracking-wide uppercase text-primary">
                  Travel OS
                </span>
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-md hover:bg-muted text-muted md:hidden"
                  aria-label="Close sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                <div>
                  <span className="px-2 text-xs font-semibold uppercase tracking-wider text-muted opacity-60">
                    Workspace
                  </span>
                  <div className="mt-2 space-y-1">
                    <button
                      onClick={() => setCurrentScreen("home")}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        currentScreen === "home" ? "bg-muted text-foreground" : "hover:bg-muted/50 text-muted"
                      }`}
                    >
                      <Compass className="h-4 w-4" />
                      <span>Home Discovery</span>
                    </button>
                    <button
                      onClick={() => setCurrentScreen("ai-plan")}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        currentScreen === "ai-plan" ? "bg-muted text-foreground" : "hover:bg-muted/50 text-muted"
                      }`}
                    >
                      <Play className="h-4 w-4" />
                      <span>AI Planning</span>
                    </button>
                  </div>
                </div>

                {dailyPlan && (
                  <div>
                    <span className="px-2 text-xs font-semibold uppercase tracking-wider text-muted opacity-60">
                      Active Trips
                    </span>
                    <div className="mt-2 space-y-1">
                      <button
                        onClick={() => setCurrentScreen("trip-edit")}
                        className={`flex w-full flex-col text-left px-3 py-2 rounded-md border transition-all ${
                          currentScreen === "trip-edit"
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border bg-muted/30 hover:bg-muted/50 text-muted"
                        }`}
                      >
                        <span className="font-semibold text-sm">Goa Expedition</span>
                        <span className="text-[10px] opacity-80">5 Days • Budget ₹40,000</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-border flex flex-col gap-2">
                <div className="text-[9px] font-mono text-muted/40">v1.0.0-rc1</div>
              </div>
            </aside>

            {/* Main Panel */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
              {/* Header Navigation */}
              <header className="flex h-14 items-center justify-between px-6 border-b border-border bg-card">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSidebar}
                    className="p-1.5 rounded-md hover:bg-muted text-muted"
                    aria-label="Toggle sidebar"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <h2 className="text-sm font-heading font-semibold tracking-tight">
                    {currentScreen === "home"
                      ? "Discovery Desk"
                      : currentScreen === "ai-plan"
                      ? "AI Planner Panel"
                      : "Curated Journal"}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <SystemStatusWidget />
                  <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="p-2 rounded-md hover:bg-muted text-muted transition-colors"
                    aria-label="Toggle theme"
                  >
                    <Sun className="h-4 w-4 dark:hidden" />
                    <Moon className="h-4 w-4 hidden dark:block" />
                  </button>
                </div>
              </header>

              {/* View Screen Switcher */}
              <main className="flex-1 overflow-y-auto p-6 bg-background relative">
                {/* Active Error Panel */}
                <AnimatePresence>
                  {sseError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="max-w-md mx-auto mb-6 p-4 border border-destructive/30 bg-destructive/5 rounded-lg flex items-start gap-3"
                    >
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider">
                          Connection Interrupted
                        </h4>
                        <p className="text-xs text-muted leading-relaxed">{sseError}</p>
                        <button
                          onClick={handleRetry}
                          className="py-1.5 px-3 bg-destructive/15 hover:bg-destructive/20 text-[11px] font-semibold text-destructive rounded flex items-center gap-1.5 transition-colors"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Retry Query</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  {/* State 2: Home Discovery Screen */}
                  {currentScreen === "home" && (
                    <motion.div
                      key="home"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="max-w-4xl mx-auto space-y-8"
                    >
                      <div className="space-y-2">
                        <span className="text-xs font-mono font-semibold uppercase text-primary tracking-widest">
                          Welcome Back
                        </span>
                        <h2 className="text-3xl font-heading font-semibold tracking-tight">
                          Where does your next journey begin?
                        </h2>
                      </div>

                      {dailyPlan ? (
                        <div className="border border-border bg-card rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider block">
                              Continue Planning
                            </span>
                            <h3 className="text-base font-semibold">Goa Expedition</h3>
                            <p className="text-xs text-muted">
                              5 days structured with optimized budget allotments.
                            </p>
                          </div>
                          <button
                            onClick={() => setCurrentScreen("trip-edit")}
                            className="py-2.5 px-4 text-xs font-semibold bg-primary text-white hover:bg-primary/95 rounded-md flex items-center gap-1.5 self-stretch md:self-auto justify-center"
                          >
                            <span>Open Journal</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="border border-dashed border-border rounded-lg p-10 text-center space-y-4">
                          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Compass className="h-6 w-6" />
                          </div>
                          <div className="space-y-1 max-w-sm mx-auto">
                            <h3 className="text-sm font-semibold">Create your first itinerary</h3>
                            <p className="text-xs text-muted leading-relaxed">
                              Use the conversational planner to generate detailed routes, stays, and budget matrices.
                            </p>
                          </div>
                          <button
                            onClick={handleStartPlanning}
                            className="py-2.5 px-6 text-xs font-semibold bg-primary text-white hover:bg-primary/90 rounded-md inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                          >
                            <span>Start Planning</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Suggested Destinations */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-mono font-semibold uppercase text-muted tracking-widest opacity-60">
                          Suggested Expeditions
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[
                            { name: "Jaipur", desc: "Heritage discovery through historic palaces and temples." },
                            { name: "Munnar", desc: "Tea gardens and forest trails in Kerala." }
                          ].map((dest) => (
                            <div
                              key={dest.name}
                              onClick={handleStartPlanning}
                              className="group border border-border hover:border-primary/20 bg-card rounded-lg p-5 cursor-pointer transition-all"
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => e.key === "Enter" && handleStartPlanning()}
                              aria-label={`Explore ${dest.name}`}
                            >
                              <h4 className="text-sm font-semibold group-hover:text-primary transition-colors">
                                {dest.name}
                              </h4>
                              <p className="text-xs text-muted mt-1">{dest.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* State 3: AI Planning Screen */}
                  {currentScreen === "ai-plan" && (
                    <motion.div
                      key="ai-plan"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col justify-between max-w-3xl mx-auto"
                    >
                      <div className="flex-1 overflow-y-auto min-h-[300px] border border-border rounded-lg bg-card/10 mb-6">
                        <MessageList
                          messages={messages}
                          isStreaming={isStreaming}
                          showClarification={showClarification}
                          onSelectOption={(opt) => {
                            setShowClarification(false);
                            handleSendMessage(opt);
                          }}
                        />
                      </div>

                      <div className="p-2 bg-background sticky bottom-0">
                        <ChatInput
                          onSend={handleSendMessage}
                          disabled={isStreaming}
                          placeholder="Plan a 5 day Goa trip..."
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* State 4 & 5: Trip Workspace & Interactive Editing */}
                  {currentScreen === "trip-edit" && dailyPlan && (
                    <motion.div
                      key="trip-edit"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start max-w-6xl mx-auto"
                    >
                      {/* Timeline details */}
                      <div className="xl:col-span-2 space-y-6">
                        <div className="flex items-center justify-between border-b border-border pb-4">
                          <div>
                            <h2 className="text-2xl font-heading font-semibold text-foreground">
                              Goa Expedition Itinerary
                            </h2>
                            <p className="text-xs text-muted mt-0.5">
                              5 Days curated route • Optimal stay segments
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                clearItinerary();
                                setCurrentScreen("home");
                              }}
                              className="p-2 border border-border hover:bg-muted rounded text-muted hover:text-foreground h-9 w-9 flex items-center justify-center transition-colors"
                              aria-label="Delete Trip"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <button
                              className="py-1.5 px-3 bg-primary text-white text-xs font-semibold rounded hover:bg-primary/95 flex items-center gap-1.5 h-9"
                              onClick={() => alert("Itinerary saved successfully!")}
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Finalize</span>
                            </button>
                          </div>
                        </div>

                        <ItineraryTimeline dailyPlan={dailyPlan} onSwapSlot={handleSwapSlot} />
                      </div>

                      {/* Map and Budget side cards */}
                      <div className="space-y-6">
                        {/* Map Panel */}
                        <div className="h-[280px]">
                          <LeafletMap />
                        </div>

                        {/* Budget breakdown */}
                        {budgetSummary && (
                          <BudgetSummary
                            totalCost={budgetSummary.totalCost}
                            budgetLimit={budgetLimit}
                            breakdown={budgetSummary.breakdown}
                            onLimitChange={(limit) => setBudgetLimit(limit)}
                          />
                        )}

                        {/* Weather advice Card */}
                        {weatherInfo && (
                          <div className="border border-border bg-card rounded-lg p-5 space-y-3">
                            <div className="flex items-center justify-between text-sm font-heading font-semibold">
                              <span>Weather Status</span>
                              <CloudSun className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex items-baseline justify-between font-mono text-xs">
                              <span className="text-foreground text-lg font-semibold">{weatherInfo.temp || "29°C"}</span>
                              <span className="text-muted text-right max-w-[70%]">{weatherInfo.condition}</span>
                            </div>
                            <p className="text-[10px] text-muted font-mono">{weatherInfo.precipitation}</p>
                          </div>
                        )}

                        {/* Packing list Card */}
                        {packingList.length > 0 && (
                          <div className="border border-border bg-card rounded-lg p-5 space-y-3">
                            <div className="flex items-center justify-between text-sm font-heading font-semibold">
                              <span>Packing Checklist</span>
                              <Briefcase className="h-4 w-4 text-primary" />
                            </div>
                            <ul className="space-y-2 text-xs font-mono">
                              {packingList.map((item, idx) => (
                                <li key={idx} className="flex items-center gap-2">
                                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
