import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import SessionNotice from './components/SessionNotice.jsx';
import Layout from './components/Layout.jsx';
import DashboardPage  from './pages/DashboardPage'
import MeetingsPage   from './pages/MeetingsPage'
import ProjectsPage   from './pages/ProjectsPage'
import TasksPage      from './pages/TasksPage'
import MemoryPage     from './pages/MemoryPage'
import DecisionsPage  from './pages/DecisionsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import MeetingDetailPage from './pages/MeetingDetailPage'

function App() {
  return (
    <Routes>
      {/* Routes publiques */}
      <Route path="/login"    element={<><SessionNotice /><LoginPage /></>} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Routes protégées — nécessite d'être connecté */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/"          element={<DashboardPage />} />
          <Route path="meetings"   element={<MeetingsPage />} />
          <Route path="meetings/:id" element={<MeetingDetailPage />} />
          <Route path="projects"   element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="tasks"      element={<TasksPage />} />
          <Route path="decisions"  element={<DecisionsPage />} />
          <Route path="memory"     element={<MemoryPage />} />
        </Route>
      </Route>

      {/* Toute URL inconnue → accueil */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default App;
