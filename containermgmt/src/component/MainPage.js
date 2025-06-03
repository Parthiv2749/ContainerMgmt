import { Routes, Route, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from './MenuPanel/Menu';
import ContainerEntry from './Pages/DataEntry/ConatinerEntry';
import LoginPage from './Pages/Login/Login';
import PrivateRoute from './PrivateRoute';
import Dashboard from './Pages/Dashboard/dashboard';
// import Report from "./Pages/Report/Report";
import ContainerForReport from './Pages/Report/Report.js';

export default function MainPage() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/";
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", sidebarVisible);
  }, [sidebarVisible]);

  return (
    <div className="flex min-h-screen bg-slate-100 relative">

      {/* Sidebar for desktop */}
      {!isLoginPage && (
        <aside className="hidden md:block fixed md:relative z-30 bg-slate-950">
          <Sidebar />
        </aside>
      )}

      {/* Sidebar for mobile */}
      {sidebarVisible && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-slate-950">
            <Sidebar onLinkClick={() => setSidebarVisible(false)} />
          </div>
          <div
            className="flex-1 bg-black bg-opacity-50"
            onClick={() => setSidebarVisible(false)}
          />
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 w-full ${!isLoginPage ? " md: transition-all duration-300" : ""}`}>
        
      {/* Mobile Menu Button */}
      {!isLoginPage && (
        <div className="md:hidden px-4 pt-4">
          <button
            className="bg-slate-800 text-white p-2 rounded shadow"
            onClick={() => setSidebarVisible(true)}
            aria-label="Toggle Sidebar"
          >
            ☰
          </button>
        </div>
      )}

        <div class="pt-1 px-4" >
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/viewContainer" element={<PrivateRoute><ContainerEntry /></PrivateRoute>} />
            <Route path="/report" element={<PrivateRoute><ContainerForReport /></PrivateRoute>} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
