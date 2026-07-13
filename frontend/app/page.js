export default function Home() {
  return (
    <div className="relative flex flex-col flex-1 min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2e] to-[#0a1a2e]">
      <nav className="glass mx-auto mt-4 flex h-14 w-[95%] max-w-5xl items-center justify-between rounded-2xl px-6">
        <span className="text-sm font-semibold tracking-wide text-white/80">
          AI Chat
        </span>
        <span className="text-xs text-white/40">Nav Placeholder</span>
      </nav>

      <main className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="glass flex h-[600px] w-full max-w-3xl flex-col rounded-2xl p-6">
          <div className="flex items-center justify-center flex-1 text-sm text-white/30">
            Chat container — ready for messages
          </div>
        </div>
      </main>
    </div>
  );
}
