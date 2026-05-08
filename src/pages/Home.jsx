import { useNavigate } from "react-router-dom";
import "../App.css";
import logo from "../assets/logo.png";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="container">
      <img src={logo} alt="LOCUM" style={{ width: 200, marginBottom: 20 }} />
      <div className="button-group">
        <button onClick={() => navigate("/login")}>Login</button>
        <button onClick={() => navigate("/register")}>Register</button>
      </div>
    </div>
  );
}

export default Home;