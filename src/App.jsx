import { BrowserRouter, Routes, Route } from "react-router-dom";
import PWAUpdatePrompt from "./PWAUpdatePrompt";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DoctorDashboard from "./pages/DoctorDashboard";
import HospitalDashboard from "./pages/HospitalDashboard";
import DoctorLocums from "./pages/DoctorLocums";
import HospitalLocums from "./pages/HospitalLocums";
import Profile from "./pages/Profile";
import AdminPanel from "./pages/AdminPanel";
import AdminLogin from "./pages/AdminLogin";
import AdminRecords from "./pages/AdminRecords";
import ResetPassword from "./pages/ResetPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Support from "./pages/Support";
import Help from "./pages/Help";
import NurseDashboard from "./pages/NurseDashboard";
import NurseLocums from "./pages/NurseLocums";
import TechnicianDashboard from "./pages/TechnicianDashboard";
import TechnicianLocums from "./pages/TechnicianLocums";
import Landing from "./pages/Landing";
import DepartmentLogin from "./pages/DepartmentLogin";
import DepartmentDashboard from "./pages/DepartmentDashboard";
import DepartmentProfile from "./pages/DepartmentProfile";

function App() {
  return (
    <BrowserRouter>
      <PWAUpdatePrompt />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
        <Route path="/doctor/locums" element={<DoctorLocums />} />
        <Route path="/doctor/profile" element={<Profile />} />
        <Route path="/hospital/dashboard" element={<HospitalDashboard />} />
        <Route path="/hospital/locums" element={<HospitalLocums />} />
        <Route path="/hospital/profile" element={<Profile />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/records" element={<AdminRecords />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/support" element={<Support />} />
        <Route path="/nurse/dashboard" element={<NurseDashboard />} />
        <Route path="/nurse/locums" element={<NurseLocums />} />
        <Route path="/nurse/profile" element={<Profile />} />
        <Route path="/technician/dashboard" element={<TechnicianDashboard />} />
        <Route path="/technician/locums" element={<TechnicianLocums />} />
        <Route path="/technician/profile" element={<Profile />} />
        <Route path="/help" element={<Help />} />
        <Route path="/department/login" element={<DepartmentLogin />} />
        <Route path="/department/dashboard" element={<DepartmentDashboard />} />
        <Route path="/department/profile" element={<DepartmentProfile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;