import React from 'react';
import { PlannerProvider } from './context/PlannerContext';
import { MainLayout } from './components/Layout/MainLayout';
import { EmployeeList } from './components/Setup/EmployeeList';
import { EmployeeManager } from './components/Employees/EmployeeManager';
import { RosterManager } from './components/Setup/RosterManager';
import { StoreHoursConfig } from './components/Setup/StoreHoursConfig';
import { BreakRuleConfig } from './components/Setup/BreakRuleConfig';
import { CoverageRuleConfig } from './components/Setup/CoverageRuleConfig';
import { RoleColorConfig } from './components/Setup/RoleColorConfig';
import { TimelineView } from './components/Schedule/TimelineView';
import { UserProfile } from './components/Auth/UserProfile';

import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/Auth/LoginScreen';

const ProtectedApp = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <PlannerProvider>
      <MainLayout>
        {children => {
          switch (children) {
            case 'schedule':
              return (
                <div className="space-y-6">
                  {/* Timeline Config / View */}
                  <TimelineView />
                </div>
              );
            case 'employees':
              return <EmployeeManager />;
            case 'rules':
              return (
                <div className="space-y-6">
                  <StoreHoursConfig />
                  <BreakRuleConfig />
                  <CoverageRuleConfig />
                  <RoleColorConfig />
                </div>
              );
            case 'profile':
              return <UserProfile />;
            default:
              return (
                <div className="text-center py-12">
                  <h2 className="text-xl text-slate-400">Section Under Construction</h2>
                </div>
              );
          }
        }}
      </MainLayout>
    </PlannerProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <ProtectedApp />
    </AuthProvider>
  );
}

export default App;
