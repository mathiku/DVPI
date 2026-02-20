import React, { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import './SpeciesSelect.css';

const MIN_SEARCH_LENGTH = 3;
const DEBOUNCE_MS = 200;

function SpeciesSelect({ value, type, onSelect, disabled, placeholder }) {
  const [query, setQuery] = useState(value || '');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const debounceRef = useRef(null);
  const listRef = useRef(null);

  const isLatin = type === 'latin';
  const displayValue = value || query;

  const fetchOptions = useCallback(async (q) => {
    const term = (q || '').trim();
    if (term.length < MIN_SEARCH_LENGTH) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.get('/api/species', { params: { q: term } });
      setOptions(Array.isArray(data) ? data : []);
      setHighlightIndex(-1);
    } catch (err) {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!query || query.length < MIN_SEARCH_LENGTH) {
      setOptions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchOptions(query), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchOptions]);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const handleSelect = (species) => {
    onSelect({ latin: species.latin, danish: species.danish });
    setQuery(isLatin ? species.latin : species.danish);
    setOptions([]);
    setOpen(false);
  };

  const handleInputChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    if (v.trim().length >= MIN_SEARCH_LENGTH) {
      fetchOptions(v);
    } else {
      setOptions([]);
    }
  };

  const handleKeyDown = (e) => {
    if (!open || options.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i < options.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : options.length - 1));
    } else if (e.key === 'Enter' && highlightIndex >= 0 && options[highlightIndex]) {
      e.preventDefault();
      handleSelect(options[highlightIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightIndex(-1);
    }
  };

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIndex];
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const showDropdown = open && (options.length > 0 || loading);
  const hint = query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH
    ? `Type ${MIN_SEARCH_LENGTH - query.trim().length} more to search`
    : null;

  return (
    <div className="species-select-wrap">
      <input
        type="text"
        className="species-select-input"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder || (isLatin ? 'Art latin' : 'Art dansk')}
        autoComplete="off"
      />
      {hint && <span className="species-select-hint">{hint}</span>}
      {showDropdown && (
        <ul ref={listRef} className="species-select-list" role="listbox">
          {loading ? (
            <li className="species-select-item loading">Loading…</li>
          ) : (
            options.map((s, i) => (
              <li
                key={`${s.latin}-${s.code}`}
                role="option"
                aria-selected={i === highlightIndex}
                className={`species-select-item ${i === highlightIndex ? 'highlight' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                {isLatin ? s.latin : s.danish}
                <span className="species-select-item-sub">
                  {isLatin ? s.danish : s.latin}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default SpeciesSelect;
