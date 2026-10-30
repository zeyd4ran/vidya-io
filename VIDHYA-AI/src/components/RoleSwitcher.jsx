import React from 'react';
import { GraduationCap, Presentation, ShieldCheck } from 'lucide-react';

const roleMeta = {
  student: { label: 'Student', Icon: GraduationCap },
  teacher: { label: 'Teacher', Icon: Presentation },
  admin: { label: 'Admin', Icon: ShieldCheck },
};

export default function RoleSwitcher({ options = ['student', 'teacher', 'admin'], activeRole, onRoleChange }) {
  return (
    <div className="role-switcher" aria-label="Choose role">
      {options.map((role) => {
        const { label, Icon } = roleMeta[role] || { label: role, Icon: GraduationCap };
        return (
          <button
            className={`role-switcher-option ${activeRole === role ? 'is-active' : ''}`}
            key={role}
            onClick={() => onRoleChange(role)}
            type="button"
            aria-pressed={activeRole === role}
          >
            <Icon size={14} strokeWidth={1.8} />
            {label}
          </button>
        );
      })}
    </div>
  );
}