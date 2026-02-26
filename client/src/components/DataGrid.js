import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
  'Arts tom': 'Artstom'
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

/** Sort records by Transektundersøgelse, Kvadrat nummer, Art latin (chronological / findable order). */
function sortRecordsForDisplay(records) {
  if (!records || records.length === 0) return records;
  const num = (v) => {
    const n = parseFloat(String(v ?? '').trim());
    return Number.isNaN(n) ? 0 : n;
  };
  return [...records].sort((a, b) => {
    const tA = a['Transektundersøgelse'] ?? '';
    const tB = b['Transektundersøgelse'] ?? '';
    const cmpT = num(tA) - num(tB) || String(tA).localeCompare(String(tB));
    if (cmpT !== 0) return cmpT;
    const kA = a['Kvadrat nummer'] ?? '';
    const kB = b['Kvadrat nummer'] ?? '';
    const cmpK = num(kA) - num(kB) || String(kA).localeCompare(String(kB));
    if (cmpK !== 0) return cmpK;
    const lA = a['Art latin'] ?? '';
    const lB = b['Art latin'] ?? '';
    return lA.localeCompare(lB);
  });
}

function escapeCsvField(val) {
  const s = String(val ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows, columns) {
  const header = columns.map(c => escapeCsvField(COLUMN_LABELS[c] ?? c)).join(',');
  const dataRows = rows.map(row =>
    columns.map(col => escapeCsvField(row[col] ?? '')).join(',')
  );
  return [header, ...dataRows].join('\r\n');
}

function DataGrid({ records = [], onRecordsChange, onCalculate, calculating }) {
  const [rows, setRows] = useState(() =>
    records.length > 0
      ? records.map(r => ensureRecord(r))
      : [ensureRecord({})]
  );

  useEffect(() => {
    if (records && records.length > 0) {
      const sorted = sortRecordsForDisplay(records);
      setRows(sorted.map(r => ensureRecord(r)));
    }
  }, [records]);

  const [artstomModal, setArtstomModal] = useState(null); // { transekt, kvadrat } when asking to clear whole quadrat

  const updateCell = useCallback((rowIndex, col, value) => {
    setRows(prev => {
      let next = prev.map((r, i) =>
        i === rowIndex ? { ...r, [col]: value } : r
      );
      const row = next[rowIndex];
      if (col === 'Arts tom' && isArtsTomTrue(value)) {
        row['Art latin'] = '';
        row['Art dansk'] = '';
        onRecordsChange?.(next);
        const transekt = (row['Transektundersøgelse'] ?? '').trim();
        const kvadrat = (row['Kvadrat nummer'] ?? '').trim();
        const othersInQuadrat = next.filter((r, i) => {
          if (i === rowIndex) return false;
          const sameT = (String(r['Transektundersøgelse'] ?? '').trim() === transekt);
          const sameK = (String(r['Kvadrat nummer'] ?? '').trim() === kvadrat);
          const hasSpecies = !!((r['Art latin'] ?? '').trim() || (r['Art dansk'] ?? '').trim());
          return sameT && sameK && hasSpecies;
        });
        if (othersInQuadrat.length > 0) {
          setArtstomModal({ transekt, kvadrat });
        }
        return next;
      }
      onRecordsChange?.(next);
      return next;
    });
  }, [onRecordsChange]);

  const confirmClearQuadrat = useCallback((doClearQuadrat) => {
    if (!artstomModal) return;
    const { transekt, kvadrat } = artstomModal;
    if (doClearQuadrat) {
      setRows(prev => {
        let keptArtstomInQuadrat = false;
        const next = prev.filter(r => {
          const sameQuadrat =
            (String(r['Transektundersøgelse'] ?? '').trim() === transekt) &&
            (String(r['Kvadrat nummer'] ?? '').trim() === kvadrat;
          if (!sameQuadrat) return true;
          const hasSpecies = !!((r['Art latin'] ?? '').trim() || (r['Art dansk'] ?? '').trim());
          const isArtstom = isArtsTomTrue(r['Arts tom']);
          if (hasSpecies) return false;
          if (isArtstom) {
            if (keptArtstomInQuadrat) return false;
            keptArtstomInQuadrat = true;
            return true;
          }
          return true;
        });
        if (next.length === 0) next.push(ensureRecord({ 'Transektundersøgelse': transekt, 'Kvadrat nummer': kvadrat, 'Arts tom': 'Ja' }));
        onRecordsChange?.(next);
        return next;
      });
    }
    setArtstomModal(null);
  }, [artstomModal, onRecordsChange]);

  const closeArtstomModal = useCallback(() => setArtstomModal(null), []);

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

  const clearGrid = useCallback(() => {
    const next = [ensureRecord({})];
    setRows(next);
    onRecordsChange?.(next);
  }, [onRecordsChange]);

  const downloadGridAsCsv = useCallback(() => {
    const csv = rowsToCsv(rows, DEFAULT_COLUMNS);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indtastningsdata-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  const removeRow = useCallback((rowIndex) => {
    setRows(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== rowIndex);
      onRecordsChange?.(next);
      return next;
    });
  }, [onRecordsChange]);

  const columns = DEFAULT_COLUMNS;

  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  const { displayRows, displayToRowIndex } = useMemo(() => {
    const num = (v) => {
      const n = parseFloat(String(v ?? '').trim());
      return Number.isNaN(n) ? 0 : n;
    };
    if (!sortCol) {
      return {
        displayRows: rows,
        displayToRowIndex: rows.map((_, i) => i)
      };
    }
    const col = sortCol;
    const asc = sortAsc;
    const indexed = rows.map((row, i) => ({ row, i }));
    indexed.sort((a, b) => {
      let va = a.row[col] ?? '';
      let vb = b.row[col] ?? '';
      if (col === 'Transektundersøgelse' || col === 'Kvadrat nummer') {
        const cmp = num(va) - num(vb);
        if (cmp !== 0) return asc ? cmp : -cmp;
        return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      }
      if (col === 'Arts tom') {
        const ta = isArtsTomTrue(va) ? 1 : 0;
        const tb = isArtsTomTrue(vb) ? 1 : 0;
        return asc ? ta - tb : tb - ta;
      }
      va = String(va);
      vb = String(vb);
      const cmp = va.localeCompare(vb, 'da');
      return asc ? cmp : -cmp;
    });
    return {
      displayRows: indexed.map(x => x.row),
      displayToRowIndex: indexed.map(x => x.i)
    };
  }, [rows, sortCol, sortAsc]);

  const handleSort = useCallback((col) => {
    setSortCol(prev => (prev === col ? prev : col));
    setSortAsc(prev => (sortCol === col ? !prev : true));
  }, [sortCol]);

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
            aria-label={checked ? 'Artstom (Ja)' : 'Artstom (Nej)'}
          />
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
      {artstomModal != null && (
        <div className="data-grid-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="artstom-modal-title">
          <div className="data-grid-modal">
            <h3 id="artstom-modal-title">Artstom</h3>
            <p>Vil du rydde hele kvadratet? De andre rækker med arter i dette kvadrat fjernes, så kun én artstom linje står tilbage.</p>
            <div className="data-grid-modal-actions">
              <button type="button" className="btn-modal-primary" onClick={() => confirmClearQuadrat(true)}>
                Ryd hele kvadratet
              </button>
              <button type="button" className="btn-modal-secondary" onClick={() => confirmClearQuadrat(false)}>
                Kun denne linje
              </button>
              <button type="button" className="btn-modal-cancel" onClick={closeArtstomModal}>
                Annuller
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="data-grid-header">
        <h2>Indtastningsdata</h2>
        <p className="data-grid-hint">
          Rediger tabellen nedenfor. Tilføj rækker til manuel indtastning, eller brug data fra en CSV.
          Når &quot;Artstom&quot; er afkrydset, kan du rydde alle arter i kvadratet (bekræft i dialogen).
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
          <button type="button" className="btn-download-csv" onClick={downloadGridAsCsv}>
            Hent CSV
          </button>
          <button type="button" className="btn-reset-grid" onClick={clearGrid}>
            Nulstil ark
          </button>
        </div>
      </div>
      <div className="data-grid-wrapper">
        <table className="data-grid-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col}
                  className="data-grid-table-sortable"
                  onClick={() => handleSort(col)}
                >
                  {COLUMN_LABELS[col] ?? col}
                  {sortCol === col && <span className="data-grid-table-sort-icon" aria-hidden="true">{sortAsc ? ' ↑' : ' ↓'}</span>}
                </th>
              ))}
              <th className="col-actions" aria-label="Fjern række"></th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, displayIndex) => {
              const rowIndex = displayToRowIndex[displayIndex];
              const prev = displayIndex > 0 ? displayRows[displayIndex - 1] : null;
              const isNewTransect = prev !== null && (row['Transektundersøgelse'] ?? '') !== (prev['Transektundersøgelse'] ?? '');
              const isNewKvadrat = prev !== null && (row['Kvadrat nummer'] ?? '') !== (prev['Kvadrat nummer'] ?? '');
              const rowClass = isNewTransect ? 'data-grid-row-new-transect' : (isNewKvadrat ? 'data-grid-row-new-kvadrat' : '');
              return (
              <tr key={rowIndex} className={rowClass}>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataGrid;
export { DEFAULT_COLUMNS, ensureRecord };
