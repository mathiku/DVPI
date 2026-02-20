import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import './SpeciesSelect.css';

const MIN_SEARCH_LENGTH = 3;
const DEBOUNCE_MS = 200;

function SpeciesSelect({ value, type, onSelect, disabled, placeholder }) {
  const [query, setQuery] = useState(value || '');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropdownRect, setDropdownRect] = useState(null);
  const debounceRef = useRef(null);
  const listRef = useRef(null);
  const wrapRef = useRef(null);

  const isLatin = type === 'latin';
  // Når dropdown er åben vises query, så backspace/slet virker; ellers vis valgt værdi
  const displayValue = open ? query : (value || query);

  const fetchOptions = useCallback(async (q) => {
    const term = (q || '').trim();
    if (term.length < MIN_SEARCH_LENGTH) {
      setOptions([]);
      setFetchError(null);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const { data } = await axios.get('/api/species', {
        params: { q: term, type: isLatin ? 'latin' : 'dansk' },
      });
      setOptions(Array.isArray(data) ? data : []);
      setHighlightIndex(-1);
    } catch (err) {
      setOptions([]);
      const msg = err.response?.status === 500
        ? (err.response?.data?.error || err.message)
        : 'Kunne ikke hente arter. Er serveren startet på port 4001?';
      setFetchError(msg);
      console.error('Species search failed:', err.message, err.response?.data);
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
    setFetchError(null);
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
    setFetchError(null);
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

  const hasSearched = query.trim().length >= MIN_SEARCH_LENGTH;
  const showDropdown = open && (options.length > 0 || loading || fetchError || (hasSearched && !loading));

  useLayoutEffect(() => {
    if (!showDropdown) {
      setDropdownRect(null);
      return;
    }
    const updateRect = () => {
      if (wrapRef.current) {
        setDropdownRect(wrapRef.current.getBoundingClientRect());
      }
    };
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [showDropdown, options.length, loading]);

  const hint = query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH
    ? `Skriv ${MIN_SEARCH_LENGTH - query.trim().length} tegn mere for at søge`
    : null;

  const dropdownContent = showDropdown && dropdownRect && (
    <ul
      ref={listRef}
      className="species-select-list species-select-list-portal"
      role="listbox"
      style={{
        position: 'fixed',
        top: dropdownRect.bottom,
        left: dropdownRect.left,
        width: Math.max(dropdownRect.width, 200),
        minWidth: 200,
      }}
    >
      {loading ? (
        <li className="species-select-item loading">Indlæser…</li>
      ) : fetchError ? (
        <li className="species-select-item species-select-error">{fetchError}</li>
      ) : options.length === 0 ? (
        <li className="species-select-item species-select-empty">Ingen arter fundet</li>
      ) : (
        options.map((s, i) => (
          <li
            key={`${s.latin}-${s.code}-${i}`}
            role="option"
            aria-selected={i === highlightIndex}
            className={`species-select-item ${i === highlightIndex ? 'highlight' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
            onMouseEnter={() => setHighlightIndex(i)}
          >
            {isLatin ? s.latin : s.danish}
          </li>
        ))
      )}
    </ul>
  );

  return (
    <div ref={wrapRef} className="species-select-wrap">
      <input
        type="text"
        className="species-select-input"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          const close = () => {
            setOpen(false);
            const q = query.trim();
            if (isLatin ? q !== (value || '').trim() : q !== (value || '').trim()) {
              onSelect(isLatin ? { latin: q } : { danish: q });
            }
          };
          setTimeout(close, 150);
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder || (isLatin ? 'Videnskabeligt navn' : 'Art')}
        autoComplete="off"
      />
      {hint && <span className="species-select-hint">{hint}</span>}
      {typeof document !== 'undefined' && dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
}

export default SpeciesSelect;
