import React from 'react';

const DoctorLayout = ({ children }) => {
  return (
    <div className="overflow-x-clip">
      <header className="top-bar">
        <h1 className="text-lg sm:hidden">M Dent</h1>
        <h1 className="hidden sm:block">M Dent Software Solution</h1>
      </header>
      <main>{children}</main>
      <footer className="bottom-nav shrink-0">
        <button onClick={() => { /* logout function */ }}>Logout</button>
      </footer>
    </div>
  );
};

export default DoctorLayout;