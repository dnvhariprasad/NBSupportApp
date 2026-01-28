import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/layout/MainLayout';
import WorkflowsPage from './pages/WorkflowsPage';
import UsersPage from './pages/UsersPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected Dashboard Routes */}
        <Route path="/dashboard" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard/workflows" replace />} />
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route path="users" element={<UsersPage />} />
        </Route>
        
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
