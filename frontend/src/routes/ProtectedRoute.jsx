import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
// import "../styles/theme.css";
 
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
 
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Checking your session…</p>
      </div>
    );
  }
 
  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }
 
  return children;
}
 
export default ProtectedRoute;