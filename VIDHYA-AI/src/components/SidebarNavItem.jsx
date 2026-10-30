import React from 'react';

export default function SidebarNavItem({ icon: Icon, label, href, isActive, badge, onClick }) {
  return (
    <div
      className={`nav-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
      role="link"
      tabIndex={0}
      data-href={href}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick();
      }}
    >
      <Icon size={18} strokeWidth={1.7} />
      <span>{label}</span>
      {badge && <span className="nav-badge">{badge}</span>}
    </div>
  );
}