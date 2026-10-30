import React from 'react';
import { Check } from 'lucide-react';

export default function TaskCheckbox({ checked, taskId, onToggle, xpValue, children }) {
  return (
    <div className={`dashboard-todo-item ${checked ? 'is-complete' : ''}`} onClick={() => onToggle(taskId)}>
      <div className="dashboard-todo-main">
        <button
          className={`task-checkbox ${checked ? 'is-checked' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(taskId);
          }}
          type="button"
          aria-label={`${checked ? 'Mark incomplete' : 'Mark complete'} task`}
          aria-pressed={checked}
        >
          {checked && <Check size={13} strokeWidth={3} />}
        </button>
        {children}
        <span className="dashboard-todo-status">{checked ? 'Completed' : 'Pending'}</span>
      </div>
      <span className="dashboard-todo-xp">+{xpValue} XP</span>
    </div>
  );
}