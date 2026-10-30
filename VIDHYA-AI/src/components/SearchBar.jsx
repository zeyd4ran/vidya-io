import React from 'react';
import { Search } from 'lucide-react';

export default function SearchBar({ value = '', onChange, placeholder = 'Search concepts, notes, tests...', onSubmit }) {
  return (
    <form className="search-bar-global" onSubmit={onSubmit}>
      <Search size={16} strokeWidth={1.8} />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </form>
  );
}