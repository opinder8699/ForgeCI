import { Routes, Route } from "react-router-dom";

import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import CreatePipeline from "../pages/CreatePipeline";
import PipelineDetails from "../pages/PipelineDetails";
import RunDetails from "../pages/RunDetails";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route path="/dashboard" element={<Dashboard />} />

      <Route path="/pipelines/new" element={<CreatePipeline />} />

      <Route path="/pipelines/:id" element={<PipelineDetails />} />

      <Route path="/runs/:id" element={<RunDetails />} />
    </Routes>
  );
}

export default AppRoutes;
