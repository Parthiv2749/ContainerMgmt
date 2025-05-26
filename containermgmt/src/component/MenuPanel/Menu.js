import React, { useState } from "react";
import {
  ChevronDown,
  LayoutDashboard,
  FileText,
  Layers,
} from "lucide-react";

function Sidebar({ setActiveComponent }) {
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isAssetsOpen, setIsAssetsOpen] = useState(false);
  const [isFuelOpen, setIsFuelOpen] = useState(false);

  return (
    <div className="relative w-64 min-h-screen bg-slate-950 text-white flex flex-col justify-between">

      {/* Sidebar navigation */}
      <div className="p-4 space-y-2">
        <nav className="flex flex-col gap-2">

          {/* Dashboard */}
          <button
            className="w-full text-left flex items-center justify-between px-3 py-2 rounded hover:bg-slate-800 transition"
            onClick={() => setIsDashboardOpen(!isDashboardOpen)}
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard size={18} />
              <span className="text-sm">Dashboard</span>
            </div>
            <ChevronDown className={`transition-transform ${isDashboardOpen ? "rotate-180" : ""}`} size={16} />
          </button>
          {isDashboardOpen && (
            <div className="ml-6 space-y-1">
              <button
                className="block text-sm hover:text-blue-400"
                onClick={() => setActiveComponent("Dashboard")}
              >
                Overview
              </button>
              <button className="block text-sm hover:text-blue-400">Analytic</button>
              <button className="block text-sm hover:text-blue-400">Saas</button>
            </div>
          )}


          {/* Static Link */}
          <button
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-800 transition"
            onClick={() => setActiveComponent("Installation")}
          >
            <FileText size={18} />
            <span className="text-sm">View Container</span>
          </button>
        </nav>
      </div>

      {/* User profile section */}
      <div className="w-full px-4 py-3 border-t border-slate-800 flex items-center gap-3 bg-slate-950">
        <img
          src="/user.jpg" // <-- Replace with actual image path or URL
          alt="User"
          className="w-10 h-10 rounded-full object-cover"
        />
        <div>
          <p className="text-sm font-medium">John Doe</p>
          <p className="text-xs text-slate-400">Logged in</p>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
