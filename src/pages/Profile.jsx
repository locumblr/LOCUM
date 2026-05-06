import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./Profile.css";

function Profile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("personal");
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [personal, setPersonal] = useState({
    firstName: "", lastName: "", email: "",
    phone: "", idNumber: "", hospitalName: "",
    address: "", registrationNumber: "", contactPerson: "",
  });

  const [qualification, setQualification] = useState({
    degree: "", experience: "",
  });

  const [password, setPassword] = useState({
    newPass: "", confirm: "",
  });

  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const userRole = user.user_metadata?.role;
    setRole(userRole);

    if (userRole === "doctor") {
      const { data } = await supabase
        .from("doctors")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) {
        setPersonal({
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          email: data.email || "",
          phone: data.phone || "",
          idNumber: data.id_number || "",
        });
        setQualification({
          degree: data.qualification || "",
          experience: data.experience || "",
        });
      }
    } else if (userRole === "hospital") {
      const { data } = await supabase
        .from("hospitals")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) {
        setPersonal({
          hospitalName: data.hospital_name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          registrationNumber: data.registration_number || "",
          contactPerson: data.contact_person || "",
        });
      }
    }
    setLoading(false);
  };

  const savePersonal = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();

    if (role === "doctor") {
      const { error } = await supabase.from("doctors").update({
        first_name: personal.firstName,
        last_name: personal.lastName,
        phone: personal.phone,
        id_number: personal.idNumber,
      }).eq("id", user.id);
      if (error) { alert("Error: " + error.message); return; }
    } else {
      const { error } = await supabase.from("hospitals").update({
        hospital_name: personal.hospitalName,
        phone: personal.phone,
        address: personal.address,
        contact_person: personal.contactPerson,
      }).eq("id", user.id);
      if (error) { alert("Error: " + error.message); return; }
    }
    alert("Personal details updated successfully!");
  };

  const saveQualification = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("doctors").update({
      qualification: qualification.degree,
      experience: parseInt(qualification.experience),
    }).eq("id", user.id);
    if (error) { alert("Error: " + error.message); return; }
    alert("Qualification updated successfully!");
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (password.newPass !== password.confirm) {
      alert("Passwords do not match!");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: password.newPass });
    if (error) { alert("Error: " + error.message); return; }
    alert("Password changed successfully!");
    setPassword({ newPass: "", confirm: "" });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return <p style={{ textAlign: "center", padding: 40, color: "#888" }}>Loading...</p>;

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>My Profile</h1>
        <div className="header-buttons">
          <button onClick={() => navigate(-1)}>← Back</button>
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="profile-card">
        <div className="photo-section">
          <div className="photo-circle">
            {photo ? (
              <img src={URL.createObjectURL(photo)} alt="Profile" />
            ) : (
              <span>👤</span>
            )}
          </div>
          <label className="photo-upload-btn">
            Change Photo
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => setPhoto(e.target.files[0])}
            />
          </label>
        </div>
        <div className="profile-name">
          <h2>
            {role === "doctor"
              ? `Dr. ${personal.firstName} ${personal.lastName}`
              : personal.hospitalName}
          </h2>
          <p>{role === "doctor" ? qualification.degree : personal.email}</p>
        </div>
      </div>

      <div className="tabs">
        <button
          className={activeTab === "personal" ? "active" : ""}
          onClick={() => setActiveTab("personal")}
        >
          Personal Details
        </button>
        {role === "doctor" && (
          <button
            className={activeTab === "qualification" ? "active" : ""}
            onClick={() => setActiveTab("qualification")}
          >
            Qualification
          </button>
        )}
        <button
          className={activeTab === "password" ? "active" : ""}
          onClick={() => setActiveTab("password")}
        >
          Change Password
        </button>
      </div>

      {activeTab === "personal" && (
        <form onSubmit={savePersonal} className="profile-form">
          {role === "doctor" ? (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input value={personal.firstName} onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input value={personal.lastName} onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={personal.email} disabled style={{ background: "#f5f5f5" }} />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>ID / Passport Number</label>
                <input value={personal.idNumber} onChange={(e) => setPersonal({ ...personal, idNumber: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Hospital Name</label>
                <input value={personal.hospitalName} onChange={(e) => setPersonal({ ...personal, hospitalName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={personal.email} disabled style={{ background: "#f5f5f5" }} />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input value={personal.address} onChange={(e) => setPersonal({ ...personal, address: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Contact Person</label>
                <input value={personal.contactPerson} onChange={(e) => setPersonal({ ...personal, contactPerson: e.target.value })} />
              </div>
            </>
          )}
          <button type="submit" className="save-btn">Save Changes</button>
        </form>
      )}

      {activeTab === "qualification" && role === "doctor" && (
        <form onSubmit={saveQualification} className="profile-form">
          <div className="form-group">
            <label>Qualification</label>
            <input value={qualification.degree} onChange={(e) => setQualification({ ...qualification, degree: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Years of Experience</label>
            <input type="number" value={qualification.experience} onChange={(e) => setQualification({ ...qualification, experience: e.target.value })} required />
          </div>
          <button type="submit" className="save-btn">Save Changes</button>
        </form>
      )}

      {activeTab === "password" && (
        <form onSubmit={savePassword} className="profile-form">
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={password.newPass} onChange={(e) => setPassword({ ...password, newPass: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input type="password" value={password.confirm} onChange={(e) => setPassword({ ...password, confirm: e.target.value })} required />
          </div>
          <button type="submit" className="save-btn">Change Password</button>
        </form>
      )}
    </div>
  );
}

export default Profile;