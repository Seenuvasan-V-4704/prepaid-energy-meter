import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import AdminRoute from './components/AdminRoute'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import PublicOnlyRoute from './components/PublicOnlyRoute'

import Admin from './pages/Admin'
import AddMeter from './pages/AddMeter'
import Alerts from './pages/Alerts'
import Dashboard from './pages/Dashboard'
import Meters from './pages/Meters'
import Profile from './pages/Profile'
import Recharge from './pages/Recharge'
import Settings from './pages/Settings'
import Usage from './pages/Usage'

import SignIn from './pages/auth/SignIn'
import SignUp from './pages/auth/SignUp'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      {/* Signed-in users are sent to the dashboard from these pages */}
      <Route element={<PublicOnlyRoute />}>
        <Route
          path="/signin"
          element={<SignIn />}
        />

        <Route
          path="/signup"
          element={<SignUp />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />
      </Route>

      {/* Not wrapped: the reset link signs the user in briefly */}
      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/meters"
            element={<Meters />}
          />

          <Route
            path="/meters/add"
            element={<AddMeter />}
          />

          <Route
            path="/recharge"
            element={<Recharge />}
          />

          <Route
            path="/usage"
            element={<Usage />}
          />

          <Route
            path="/alerts"
            element={<Alerts />}
          />

          <Route
            path="/settings"
            element={<Settings />}
          />

          <Route
            path="/profile"
            element={<Profile />}
          />

          <Route element={<AdminRoute />}>
            <Route
              path="/admin"
              element={<Admin />}
            />
          </Route>
        </Route>
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
  )
}