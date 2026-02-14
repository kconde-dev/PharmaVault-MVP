import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/DashboardLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Gardes from '@/pages/Gardes';
import Depenses from '@/pages/Depenses';
import Assurances from '@/pages/Assurances';
import Parametres from '@/pages/Parametres';
import Personnel from '@/pages/Personnel';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="gardes" element={<Gardes />} />
        <Route path="depenses" element={<Depenses />} />
        <Route path="assurances" element={<Assurances />} />
        <Route path="parametres" element={<Parametres />} />
        <Route path="personnel" element={<Personnel />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
