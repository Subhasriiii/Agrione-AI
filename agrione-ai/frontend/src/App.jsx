import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import NotificationModal from './components/NotificationModal';
import { useAuth } from './context/AuthContext';

// Pages
import Dashboard from './pages/Dashboard';
import FarmManagement from './pages/FarmManagement';
import SoilIntelligence from './pages/SoilIntelligence';
import CropRecommendation from './pages/CropRecommendation';
import DiseaseDetection from './pages/DiseaseDetection';
import SmartIrrigation from './pages/SmartIrrigation';
import YieldAndRisk from './pages/YieldAndRisk';
import ProfitCalculator from './pages/ProfitCalculator';
import WhatIfSimulation from './pages/WhatIfSimulation';
import WeatherAdvisory from './pages/WeatherAdvisory';
import MarketMandi from './pages/MarketMandi';
import Marketplace from './pages/Marketplace';
import Orders from './pages/Orders';
import GovernmentSchemes from './pages/GovernmentSchemes';
import AIAssistant from './pages/AIAssistant';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { isAuthenticated, loading } = useAuth();

  const requireAuth = (element) => (isAuthenticated ? element : <div className="page-container"><div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}><h2>Please sign in to access AgriOne AI</h2><p style={{ color: 'var(--text-secondary)' }}>Create an account or log in to view your farms, soil data, and recommendations.</p><button className="btn btn-primary" onClick={() => setAuthModalOpen(true)}>Open login</button></div></div>);

  if (loading) {
    return <div className="page-container"><div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>Loading AgriOne AI...</div></div>;
  }

  if (!isAuthenticated) {
    return <AuthModal isOpen fullScreen onClose={() => setAuthModalOpen(false)} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="app-main">
        <Header
          onOpenAuth={() => setAuthModalOpen(true)}
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/" element={requireAuth(<Dashboard />)} />
            <Route path="/farms" element={requireAuth(<FarmManagement />)} />
            <Route path="/soil" element={requireAuth(<SoilIntelligence />)} />
            <Route path="/crop-recommendation" element={requireAuth(<CropRecommendation />)} />
            <Route path="/disease-detection" element={requireAuth(<DiseaseDetection />)} />
            <Route path="/irrigation" element={requireAuth(<SmartIrrigation />)} />
            <Route path="/yield-risk" element={requireAuth(<YieldAndRisk />)} />
            <Route path="/profit-calculator" element={requireAuth(<ProfitCalculator />)} />
            <Route path="/simulation" element={requireAuth(<WhatIfSimulation />)} />
            <Route path="/weather" element={requireAuth(<WeatherAdvisory />)} />
            <Route path="/market" element={requireAuth(<MarketMandi />)} />
            <Route path="/marketplace" element={requireAuth(<Marketplace />)} />
            <Route path="/orders" element={requireAuth(<Orders />)} />
            <Route path="/schemes" element={requireAuth(<GovernmentSchemes />)} />
            <Route path="/assistant" element={requireAuth(<AIAssistant />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Notification Slide Drawer */}
      <NotificationModal />

      {/* Authentication modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

export default App;
