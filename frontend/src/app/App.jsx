// src/app/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AnimatePresence } from 'framer-motion';
import { useLenis } from '@shared/lib/useLenis';
import { useUIStore } from '@app/state/uiStore';

import PageTransition from '@shared/ui/PageTransition';

import AuthAwareHomeRoute from '@features/auth/components/AuthAwareHomeRoute';
import ProtectedRoute from '@features/auth/components/ProtectedRoute';
import PublicOnlyRoute from '@features/auth/components/PublicOnlyRoute';

import Dashboard from '@features/dashboard/page/DashboardPage';
import Room from '@features/room/page/RoomPage';

import LoginPage from '@features/auth/page/LoginPage';
import RegisterPage from '@features/auth/page/RegisterPage';
import ForgotPasswordPage from '@features/auth/page/ForgotPasswordPage';
import ResetPasswordPage from '@features/auth/page/ResetPasswordPage';
import VerifyOtpPage from '@features/auth/page/VerifyOtpPage';
import AuthCallbackPage from '@features/auth/page/AuthCallbackPage';

import AboutPage from '@features/about/page/AboutPage';
import ContactPage from '@features/contact/page/ContactPage';
import FeaturesPage from '@features/features/page/FeaturesPage';

import Error403Page from '@features/errors/page/Error403Page';
import Error404Page from '@features/errors/page/Error404Page';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>

        {/* Home */}
        <Route
          path="/"
          element={
            <PageTransition>
              <AuthAwareHomeRoute />
            </PageTransition>
          }
        />

        {/* Public only routes */}
        <Route element={<PublicOnlyRoute />}>
          <Route
            path="/login"
            element={
              <PageTransition>
                <LoginPage />
              </PageTransition>
            }
          />
          <Route
            path="/register"
            element={
              <PageTransition>
                <RegisterPage />
              </PageTransition>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PageTransition>
                <ForgotPasswordPage />
              </PageTransition>
            }
          />
        </Route>

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
        <Route
          path="/dashboard"
          element={
            <PageTransition>
              <Dashboard />
            </PageTransition>
          }
        />
          <Route
            path="/room/:roomId"
            element={
              <PageTransition>
                <Room />
              </PageTransition>
            }
          />
        </Route>

        {/* Auth flows */}
        <Route
          path="/auth/callback"
          element={
            <PageTransition>
              <AuthCallbackPage />
            </PageTransition>
          }
        />

        <Route
          path="/verify-otp"
          element={
            <PageTransition>
              <VerifyOtpPage />
            </PageTransition>
          }
        />

        <Route
          path="/update-password"
          element={
            <PageTransition>
              <ResetPasswordPage />
            </PageTransition>
          }
        />

        {/* Static pages */}
        <Route
          path="/about"
          element={
            <PageTransition>
              <AboutPage />
            </PageTransition>
          }
        />

        <Route
          path="/contact"
          element={
            <PageTransition>
              <ContactPage />
            </PageTransition>
          }
        />

        <Route
          path="/features"
          element={
            <PageTransition>
              <FeaturesPage />
            </PageTransition>
          }
        />

        {/* Error pages */}
        <Route
          path="/403"
          element={
            <PageTransition>
              <Error403Page />
            </PageTransition>
          }
        />

        <Route
          path="*"
          element={
            <PageTransition>
              <Error404Page />
            </PageTransition>
          }
        />

      </Routes>
    </AnimatePresence>
  );
}

function App() {
  useLenis();
  const theme = useUIStore((s) => s.theme);

  return (
    <Router>
      <AnimatedRoutes />

      <ToastContainer
        position="top-right"
        autoClose={4000}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={theme === 'dark' ? 'dark' : 'light'}
      />
    </Router>
  );
}

export default App;