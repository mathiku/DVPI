import React, { useState, useCallback, useEffect } from 'react';
import './DataGrid.css';
import SpeciesSelect from './SpeciesSelect';

// Columns the backend expects (Danish vegetation format). Art dansk syncs with Art latin.
const DEFAULT_COLUMNS = [
  'Transektundersøgelse',
  'Kvadrat nummer',
  'Arts tom',
  'Art latin',
  'Art dansk',
  'Dækningsgrad'
];

const ARTS_TOM_VALUES = ['', 'Nej', 'Ja'];
const SPECIES_DISABLED_VALUES = ['ja', 'yes', 'true', '1'];

function isArtsTomTrue(val) {
  return SPECIES_DISABLED_VALUES.includes((val || '').trim().toLowerCase());
}

function ensureRecord(row) {
  const r = { ...row };
  DEFAULT_COLUMNS.forEach(col => {
    if (r[col] === undefined) r[col] = '';
  });
  if (r['Art dansk'] === undefined && r['Art'] !== undefined) r['Art dansk'] = r['Art'];
  return r;
}

function DataGrid({ records = [], onRecordsChange, onCalculate, calculating }) {
  const [rows, setRows] = useState(() =>
    records.length > 0
      ? records.map(r => ensureRecord(r))
      : [ensureRecord({})]
  );

  useEffect(() => {
    if (records && records.length > 0) {
      setRows(records.map(r => ensureRecord(r)));
    }
  }, [records]);

  const updateCell = useCallback((rowIndex, col, value) => {
    setRows(prev => {
      let next = prev.map((r, i) =>
        i === rowIndex ? { ...r, [col]: value } : r
      );
      const row = next[rowIndex];
      if (col === 'Arts tom' && isArtsTomTrue(value)) {
        row['Art latin'] = '';
        row['Art dansk'] = '';
        row['Dækningsgrad'] = '';
      }
      onRecordsChange?.(next);
      return next;
    });
  }, [onRecordsChange]);

  const updateSpecies = useCallback((rowIndex, { latin, danish }) => {
    setRows(prev => {
      const next = prev.map((r, i) =>
        i === rowIndex ? { ...r, 'Art latin': latin, 'Art dansk': danish } : r
      );
      onRecordsChange?.(next);
      return next;
    });
  }, [onRecordsChange]);

  const addRow = useCallback(() => {
    setRows(prev => {
      const next = [...prev, ensureRecord({})];
      onRecordsChange?.(next);
      return next;
    });
  }, [onRecordsChange]);

  const removeRow = useCallback((rowIndex) => {
    setRows(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== rowIndex);
      onRecordsChange?.(next);
      return next;
    });
  }, [onRecordsChange]);

  const columns = DEFAULT_COLUMNS;

  const renderCell = (row, rowIndex, col) => {
    const disabledSpecies = isArtsTomTrue(row['Arts tom']);
    const value = row[col] ?? '';

    if (col === 'Arts tom') {
      return (
        <select
          value={value}
          onChange={e => updateCell(rowIndex, col, e.target.value)}
          className="data-grid-select"
        >
          {ARTS_TOM_VALUES.map(opt => (
            <option key={opt || 'empty'} value={opt}>{opt || '—'}</option>
          ))}
        </select>
      );
    }
    if (col === 'Art latin') {
      return (
        <SpeciesSelect
          value={value}
          type="latin"
          onSelect={payload => updateSpecies(rowIndex, payload)}
          disabled={disabledSpecies}
          placeholder="Art latin"
        />
      );
    }
    if (col === 'Art dansk') {
      return (
        <SpeciesSelect
          value={value}
          type="dansk"
          onSelect={payload => updateSpecies(rowIndex, payload)}
          disabled={disabledSpecies}
          placeholder="Art dansk"
        />
      );
    }
    if (col === 'Dækningsgrad') {
      return (
        <input
          type="text"
          value={value}
          onChange={e => updateCell(rowIndex, col, e.target.value)}
          placeholder={col}
          disabled={disabledSpecies}
        />
      );
    }
    return (
      <input
        type="text"
        value={value}
        onChange={e => updateCell(rowIndex, col, e.target.value)}
        placeholder={col}
      />
    );
  };

  return (
    <div className="data-grid-container">
      <div className="data-grid-header">
        <h2>Input data</h2>
        <p className="data-grid-hint">
          Edit the table below. Add rows for manual entry, or use data loaded from a CSV.
          When &quot;Arts tom&quot; is Ja, species and Dækningsgrad are cleared and disabled.
          Type at least 3 characters in Art latin or Art dansk to search; selecting one updates the other.
        </p>
        <div className="data-grid-actions">
          <button type="button" className="btn-add-row" onClick={addRow}>
            + Add row
          </button>
          <button
            type="button"
            className="btn-calculate"
            onClick={() => onCalculate?.(rows)}
            disabled={calculating || rows.length === 0}
          >
            {calculating ? 'Calculating…' : 'Re-calculate DVPI'}
          </button>
        </div>
      </div>
      <div className="data-grid-wrapper">
        <table className="data-grid-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}>{col}</th>
              ))}
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map(col => (
                  <td key={col}>
                    {renderCell(row, rowIndex, col)}
                  </td>
                ))}
                <td className="col-actions">
                  <button
                    type="button"
                    className="btn-remove-row"
                    onClick={() => removeRow(rowIndex)}
                    disabled={rows.length <= 1}
                    title="Remove row"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataGrid;
export { DEFAULT_COLUMNS, ensureRecord };
