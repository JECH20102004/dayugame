import React from 'react';
import Desktop from './components/Desktop';

const App: React.FC = () => {
  return (
    <div className="antialiased text-slate-200 selection:bg-nexus-accent selection:text-nexus-dark">
      <Desktop />
    </div>
  );
};

export default App;
