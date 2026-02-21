import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/Layout/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import AsociacionesPage from './pages/AsociacionesPage';
import IntegrantesPage from './pages/IntegrantesPage';
import AttendanceControl from './pages/AttendanceControl';
import BulkUploadPage from './pages/BulkUploadPage';
import CoursesPage from './pages/CoursesPage';
import LoginPage from './pages/LoginPage';
import PublicCheckInPage from './pages/PublicCheckInPage';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route path="/" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardHome />} />
        <Route path="asociaciones" element={<AsociacionesPage />} />
        <Route path="integrantes" element={<IntegrantesPage />} />
        <Route path="asistencia" element={<AttendanceControl />} />
        <Route path="bulk-upload" element={<BulkUploadPage />} />
        <Route path="cursos" element={<CoursesPage />} />
      </Route>

      <Route path="/public-check-in" element={
        <ProtectedRoute>
          <PublicCheckInPage />
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
