import React from 'react';
import { PlannerProvider } from './context/PlannerContext';
import { MainLayout } from './components/Layout/MainLayout';
import { EmployeeList } from './components/Setup/EmployeeList';
import { RosterManager } from './components/Setup/RosterManager';
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
        {(activeTab) => (
          <>
            {activeTab === 'setup' && <div className="space-y-8">
              <RosterManager />
              <EmployeeList />
            </div>}
            {activeTab === 'rules' && <div className="space-y-8">
              <RoleColorConfig />
              <BreakRuleConfig />
              <CoverageRuleConfig />
            </div>}
            {activeTab === 'profile' && <UserProfile />}
            {activeTab === 'schedule' && <TimelineView />}
          </>
        )}
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
