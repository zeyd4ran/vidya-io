import React from 'react';

export default function SidebarSection({ title, children }) {
  return (
    <section className="sidebar-section">
      <div className="nav-section-title">{title}</div>
      {children}
    </section>
  );
}