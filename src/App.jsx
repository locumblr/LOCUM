import { BrowserRouter, Routes, Route } from "react-router-dom";

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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
        <Route path="/doctor/locums" element={<DoctorLocums />} />
        <Route path="/doctor/profile" element={<Profile />} />
        <Route path="/hospital/dashboard" element={<HospitalDashboard />} />
        <Route path="/hospital/locums" element={<HospitalLocums />} />
        <Route path="/hospital/profile" element={<Profile />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/records" element={<AdminRecords />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;