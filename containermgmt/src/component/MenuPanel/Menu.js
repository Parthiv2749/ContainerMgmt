import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, FileText, Container, ChevronDown } from 'lucide-react';

function Sidebar({ onLinkClick }) {
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  return (
    <div className="flex flex-col justify-between h-full bg-slate-950 text-white group md:w-16 md:hover:w-64 w-64 transition-all duration-300 overflow-hidden">
      
      {/* Navigation */}
      <div className="p-4 space-y-2">
        <nav className="flex flex-col gap-2">
          
          {/* Dashboard Section */}
          <div className="relative">
            <button
              onClick={() => setIsDashboardOpen(!isDashboardOpen)}
              className="flex items-center w-full gap-3 px-3 py-2 rounded hover:bg-slate-800 transition"
            >
              <LayoutDashboard size={18} />
              <span className="text-sm inline md:hidden">Dashboard</span>
              <span className="text-sm hidden md:group-hover:inline">Dashboard</span>
              
              <ChevronDown
                size={16}
                className={`ml-auto transition-transform ${isDashboardOpen ? 'rotate-180' : ''} hidden md:group-hover:inline`}
              />
            </button>
            {isDashboardOpen && (
              <div className="ml-6 mt-1 space-y-1">
                <Link to="/dashboard" className="block text-sm hover:text-blue-400" onClick={onLinkClick}>Overview</Link>
                <Link to="/dashboard/analytics" className="block text-sm hover:text-blue-400" onClick={onLinkClick}>Analytics</Link>
                <Link to="/dashboard/saas" className="block text-sm hover:text-blue-400" onClick={onLinkClick}>SaaS</Link>
              </div>
            )}
          </div>

          {/* Report */}
          <Link
            to="/report"
            onClick={onLinkClick}
            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-800 transition"
          >
            <FileText size={18} />
            <span className="text-sm inline md:hidden">Report</span>

            <span className="text-sm hidden md:group-hover:inline">Report</span>
          </Link>

          {/* View Container */}
          <Link
            to="/viewContainer"
            onClick={onLinkClick}
            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-800 transition"
          >
            <Container size={18} />
            <span className="text-sm inline md:hidden">View Container</span>
            <span className="text-sm hidden md:group-hover:inline">View Container</span>
          </Link>
        </nav>
      </div>

      {/* User Section */}
      <div className="px-4 py-3 border-t border-slate-800 flex items-center gap-3">
        <img src="/user.jpg" alt="User" className="w-10 h-10 rounded-full object-cover" />
          <div className="text-sm inline md:hidden">
            <p className="text-sm font-medium">John Doe</p>
            <p className="text-xs text-slate-400">Logged in</p>
          </div>
      
        <div className="hidden md:group-hover:block">
          <p className="text-sm font-medium">John Doe</p>
          <p className="text-xs text-slate-400">Logged in</p>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
