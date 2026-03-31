import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/layout/MainLayout';
import CasesPage from './pages/CasesPage';
import WorkflowsPage from './pages/WorkflowsPage';
import GroupsPage from './pages/GroupsPage';
import UsersPage from './pages/UsersPage';
import QueryPage from './pages/QueryPage';
import VerticalsPage from './pages/VerticalsPage';
import InboxPage from './pages/InboxPage';
import MetadataPage from './pages/MetadataPage';
import DelegatePage from './pages/DelegatePage';

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
            <Route path="groups" element={<GroupsPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="verticals" element={<VerticalsPage />} />
            <Route path="metadata" element={<MetadataPage />} />
            <Route path="query" element={<QueryPage />} />
            <Route path="delegate" element={<DelegatePage />} />
        </Route>
        
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
