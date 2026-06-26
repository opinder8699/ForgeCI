import { Routes, Route } from "react-router-dom";

import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import CreatePipeline from "../pages/CreatePipeline";
import PipelineDetails from "../pages/PipelineDetails";
import RunDetails from "../pages/RunDetails";
import ProtectedRoute from "./ProtectedRoute";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pipelines/new"
        element={
          <ProtectedRoute>
            <CreatePipeline />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pipelines/:id"
        element={
          <ProtectedRoute>
            <PipelineDetails />
          </ProtectedRoute>
        }
      />

      <Route
        path="/runs/:id"
        element={
          <ProtectedRoute>
            <RunDetails />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default AppRoutes;
