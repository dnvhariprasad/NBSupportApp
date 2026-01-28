import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/layout/MainLayout';
import CasesPage from './pages/CasesPage';
import WorkflowsPage from './pages/WorkflowsPage';
import UsersPage from './pages/UsersPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected Dashboard Routes */}
        <Route path="/dashboard" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard/cases" replace />} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route path="users" element={<UsersPage />} />
        </Route>
        
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
