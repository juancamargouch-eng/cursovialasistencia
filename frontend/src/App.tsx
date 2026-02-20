import { useState } from 'react';
import DashboardLayout from './components/Layout/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import AsociacionesPage from './pages/AsociacionesPage';
import IntegrantesPage from './pages/IntegrantesPage';
import AttendanceControl from './pages/AttendanceControl';
import BulkUploadPage from './pages/BulkUploadPage';
import CoursesPage from './pages/CoursesPage';
import LoginPage from './pages/LoginPage';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { isAuthenticated, loading } = useAuth();

  console.log('AppContent: isAuthenticated =', isAuthenticated, 'loading =', loading);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardHome />;
      case 'asociaciones':
        return <AsociacionesPage />;
      case 'integrantes':
        return <IntegrantesPage />;
      case 'asistencia':
        return <AttendanceControl />;
      case 'bulk-upload':
        return <BulkUploadPage />;
      case 'cursos':
        return <CoursesPage />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </DashboardLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
