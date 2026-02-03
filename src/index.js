import React from 'react';
import ReactDOM from 'react-dom/client';
import Round2 from './Round2';

// Demo wrapper to test R2 standalone
function App() {
  const handleComplete = (schedule) => {
    console.log('R2 Complete! Schedule:', schedule);
    alert('R2 Complete! Check console for schedule data.');
  };
  
  return <Round2 onComplete={handleComplete} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
