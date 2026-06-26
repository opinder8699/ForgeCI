import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "../styles/Navbar.css";
 
function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
 
  const handleLogout = async () => {
    await logout();
    navigate("/");
  };
 
  return (
    <header className="navbar">
      <Link to="/dashboard" className="navbar-brand">
        <span className="navbar-mark">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M13 2L4.5 14H11L10 22L19 10H12.5L13 2Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </span>
        ForgeCI
      </Link>
 
      <nav className="navbar-links">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/pipelines/new">New Pipeline</Link>
      </nav>
 
      <div className="navbar-user">
        {user?.avatarUrl && <img src={user.avatarUrl} alt="" className="navbar-avatar" />}
        <span className="navbar-username">{user?.username ?? user?.name ?? "Account"}</span>
        <button className="navbar-logout" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}
 
export default Navbar;
