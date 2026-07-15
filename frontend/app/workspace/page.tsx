"use client";

import * as React from "react";
import { useUIStore } from "@/store/uiStore";
import { useTheme } from "next-themes";
import { Sun, Moon, Menu, Compass, Calendar, Wallet, Settings } from "lucide-react";

export default function WorkspacePage() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-full w-full bg-background text-foreground overflow-hidden">
      {/* 1. Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex flex-col w-[240px] bg-card border-r border-border transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
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

        {/* WorkspaceSelector / TripList */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <span className="px-2 text-xs font-semibold uppercase tracking-wider text-muted opacity-60">
              Navigation
            </span>
            <div className="mt-2 space-y-1">
              <button className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md bg-muted text-foreground">
                <Compass className="h-4 w-4 text-primary" />
                <span>Explore & Plan</span>
              </button>
              <button className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-muted/50 text-muted">
                <Calendar className="h-4 w-4" />
                <span>Itineraries</span>
              </button>
              <button className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-muted/50 text-muted">
                <Wallet className="h-4 w-4" />
                <span>Expenses</span>
              </button>
            </div>
          </div>

          <div>
            <span className="px-2 text-xs font-semibold uppercase tracking-wider text-muted opacity-60">
              Active Trips
            </span>
            <div className="mt-2 space-y-1">
              <div className="px-3 py-2 text-sm rounded-md border border-border bg-muted/30">
                <div className="font-medium text-foreground">Goa Getaway</div>
                <div className="text-xs text-muted">5 Days • Oct 2026</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between">
          <button className="flex items-center gap-2 text-sm text-muted hover:text-foreground">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* 2. Top Navigation */}
        <header className="flex h-14 items-center justify-between px-6 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-md hover:bg-muted text-muted"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base font-semibold tracking-tight">Goa Workspace</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
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

        {/* 3. Main Content Container */}
        <main className="flex-1 overflow-y-auto p-6 bg-background relative">
          <div className="max-w-[1200px] mx-auto h-full flex items-center justify-center border border-dashed border-border rounded-lg p-12 text-center">
            <div>
              <p className="text-sm text-muted">Workspace initialized. Standing by for UI component modules.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
