import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "../components/layout/Navbar";
import ThemeToggleButton from "../components/ui/ThemeToggleButton";
import ProtectedRoute from "../auth/ProtectedRoute";

import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import UpdatePasswordPage from "../pages/UpdatePasswordPage";
import StudentDashboardPage from "../pages/StudentDashboardPage";
import TeacherDashboardPage from "../pages/TeacherDashboardPage";
import TeacherFoldersPage from "../pages/TeacherFoldersPage";
import JoinFolderPage from "../pages/JoinFolderPage";
import ReadingDetailPage from '../pages/ReadingDetailPage';
import StudentFlashcardsPage from '../pages/StudentFlashcardsPage';
import StudentAnalyticsPage from '../pages/StudentAnalyticsPage';
import TeacherAnalyticsPage from '../pages/TeacherAnalyticsPage';

function AppRouter() {
  return (
    <BrowserRouter>
      <Navbar />
      <ThemeToggleButton />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/update-password" element={<UpdatePasswordPage />} />

        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher/dashboard"
          element={
            <ProtectedRoute allowedRole="teacher">
              <TeacherDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher/folders"
          element={
            <ProtectedRoute allowedRole="teacher">
              <TeacherFoldersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/join"
          element={
            <ProtectedRoute allowedRole="student">
              <JoinFolderPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/join/:joinCode"
          element={
            <ProtectedRoute allowedRole="student">
              <JoinFolderPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/flashcards"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentFlashcardsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/analytics"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentAnalyticsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher/analytics"
          element={
            <ProtectedRoute allowedRole="teacher">
              <TeacherAnalyticsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reading/:readingId"
          element={
            <ProtectedRoute>
              <ReadingDetailPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;