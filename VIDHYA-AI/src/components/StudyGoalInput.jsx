import React from 'react';
import { Plus } from 'lucide-react';

export default function StudyGoalInput({ value, onChange, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="dashboard-add-todo">
      <input
        type="text"
        placeholder="Add new study goal..."
        value={value}
        onChange={onChange}
        aria-label="New study goal"
      />
      <button className="btn btn-sm" type="submit" aria-label="Add study goal">
        <Plus size={14} />
        Add
      </button>
    </form>
  );
}