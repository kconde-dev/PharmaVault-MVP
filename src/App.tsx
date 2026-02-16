import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/DashboardLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Transactions from '@/pages/Transactions';
import DailyLedger from '@/pages/DailyLedger';
import Gardes from '@/pages/Gardes';
import Depenses from '@/pages/Depenses';
import Assurances from '@/pages/Assurances';
import InsuranceLedger from '@/pages/InsuranceLedger';
import InsuranceClaimReport from '@/pages/InsuranceClaimReport';
import HelpCenter from '@/pages/HelpCenter';
import About from '@/pages/About';
import OtherApps from '@/pages/OtherApps';
import GoogleMapsSolution from '@/pages/GoogleMapsSolution';
import CustomAppsSolution from '@/pages/CustomAppsSolution';
import SafeGuardSolution from '@/pages/SafeGuardSolution';
import Parametres from '@/pages/Parametres';
import Personnel from '@/pages/Personnel';
import Intelligence from '@/pages/Intelligence';

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
        <Route
          path="transactions"
          element={
            <ProtectedRoute requiredRole="administrator">
              <Transactions />
            </ProtectedRoute>
          }
        />
        <Route path="daily-ledger" element={<DailyLedger />} />
        <Route path="help" element={<HelpCenter />} />
        <Route path="intelligence" element={<Intelligence />} />
        <Route
          path="gardes"
          element={
            <ProtectedRoute requiredRole="administrator">
              <Gardes />
            </ProtectedRoute>
          }
        />
        <Route path="depenses" element={<Depenses />} />
        <Route path="assurances" element={<Assurances />} />
        <Route
          path="assurances/ledger"
          element={
            <ProtectedRoute requiredRole="administrator">
              <InsuranceLedger />
            </ProtectedRoute>
          }
        />
        <Route
          path="assurances/claims"
          element={
            <ProtectedRoute requiredRole="administrator">
              <InsuranceClaimReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="about"
          element={
            <ProtectedRoute requiredRole="administrator">
              <About />
            </ProtectedRoute>
          }
        />
        <Route
          path="other-apps"
          element={
            <ProtectedRoute requiredRole="administrator">
              <OtherApps />
            </ProtectedRoute>
          }
        />
        <Route
          path="solutions/google-maps"
          element={
            <ProtectedRoute requiredRole="administrator">
              <GoogleMapsSolution />
            </ProtectedRoute>
          }
        />
        <Route
          path="solutions/custom-apps"
          element={
            <ProtectedRoute requiredRole="administrator">
              <CustomAppsSolution />
            </ProtectedRoute>
          }
        />
        <Route
          path="solutions/safeguard"
          element={
            <ProtectedRoute requiredRole="administrator">
              <SafeGuardSolution />
            </ProtectedRoute>
          }
        />
        <Route path="parametres" element={<Parametres />} />
        <Route
          path="personnel"
          element={
            <ProtectedRoute requiredRole="administrator">
              <Personnel />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
