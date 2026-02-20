import React, { useState, useCallback, useEffect } from 'react';
import './DataGrid.css';
import SpeciesSelect from './SpeciesSelect';

// Kolonner backend forventer (dansk vegetationsformat). Rækkefølge: transekt, kvadrat, art, videnskabeligt, uden art.
const DEFAULT_COLUMNS = [
  'Transektundersøgelse',
  'Kvadrat nummer',
  'Art dansk',
  'Art latin',
  'Arts tom'
];

const COLUMN_LABELS = {
  'Transektundersøgelse': 'Transektnr.',
  'Kvadrat nummer': 'Kvadratnr.',
  'Art dansk': 'Art',
  'Art latin': 'Videnskabeligt navn',
  'Arts tom': 'Uden art'
};

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
      }
      onRecordsChange?.(next);
      return next;
    });
  }, [onRecordsChange]);

  const updateSpecies = useCallback((rowIndex, payload) => {
    setRows(prev => {
      const updates = {};
      if (payload.latin !== undefined) updates['Art latin'] = payload.latin;
      if (payload.danish !== undefined) updates['Art dansk'] = payload.danish;
      const next = prev.map((r, i) =>
        i === rowIndex ? { ...r, ...updates } : r
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
      const checked = isArtsTomTrue(value);
      return (
        <label className="data-grid-checkbox-wrap">
          <input
            type="checkbox"
            checked={checked}
            onChange={e => updateCell(rowIndex, col, e.target.checked ? 'Ja' : 'Nej')}
            className="data-grid-checkbox"
          />
          <span className="data-grid-checkbox-label">{checked ? 'Ja' : 'Nej'}</span>
        </label>
      );
    }
    if (col === 'Art latin') {
      return (
        <SpeciesSelect
          value={value}
          type="latin"
          onSelect={payload => updateSpecies(rowIndex, payload)}
          disabled={disabledSpecies}
          placeholder="Videnskabeligt navn"
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
          placeholder="Art"
        />
      );
    }
    return (
      <input
        type="text"
        value={value}
        onChange={e => updateCell(rowIndex, col, e.target.value)}
        placeholder={COLUMN_LABELS[col] ?? col}
      />
    );
  };

  return (
    <div className="data-grid-container">
      <div className="data-grid-header">
        <h2>Indtastningsdata</h2>
        <p className="data-grid-hint">
          Rediger tabellen nedenfor. Tilføj rækker til manuel indtastning, eller brug data fra en CSV.
          Når &quot;Uden art&quot; er afkrydset, tømmes og deaktiveres art-felterne.
          Skriv mindst 3 tegn i Videnskabeligt navn eller Art for at søge; valg opdaterer begge.
        </p>
        <div className="data-grid-actions">
          <button type="button" className="btn-add-row" onClick={addRow}>
            + Tilføj række
          </button>
          <button
            type="button"
            className="btn-calculate"
            onClick={() => onCalculate?.(rows)}
            disabled={calculating || rows.length === 0}
          >
            {calculating ? 'Beregner…' : 'Genberegn DVPI'}
          </button>
        </div>
      </div>
      <div className="data-grid-wrapper">
        <table className="data-grid-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}>{COLUMN_LABELS[col] ?? col}</th>
              ))}
              <th className="col-actions" aria-label="Fjern række"></th>
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
                    title="Fjern række"
                  >
                    Fjern
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
