import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "../components/layout/Navbar";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import StudentDashboardPage from "../pages/StudentDashboardPage";
import TeacherDashboardPage from "../pages/TeacherDashboardPage";

function AppRouter() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/student/dashboard" element={<StudentDashboardPage />} />
        <Route path="/teacher/dashboard" element={<TeacherDashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;