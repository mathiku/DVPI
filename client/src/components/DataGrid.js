import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import './DataGrid.css';

// Columns to display in the grid (only the ones used for calculations)
const DISPLAY_COLUMNS = ['Transektundersøgelse', 'Kvadrat nummer', 'Dækningsgrad', 'Art latin', 'Art', 'Arts tom'];

// Dækningsgrad (coverage) intervals for the select
const DAEKNINGSGRAD_INTERVALS = [
  '0-5', '5-10', '10-15', '15-20', '20-25', '25-30', '30-35', '35-40', '40-45', '45-50',
  '50-55', '55-60', '60-65', '65-70', '70-75', '75-80', '80-85', '85-90', '90-95', '95-100'
];

function createEmptyRow() {
  return DISPLAY_COLUMNS.reduce((acc, col) => ({
    ...acc,
    [col]: col === 'Arts tom' ? 'Nej' : ''
  }), {});
}

// Sort rows by transekt and kvadrat
const sortRows = (rowsToSort) => {
  return [...rowsToSort].sort((a, b) => {
    // First sort by Transektundersøgelse
    const transektA = String(a['Transektundersøgelse'] || '');
    const transektB = String(b['Transektundersøgelse'] || '');
    const transektCompare = transektA.localeCompare(transektB, undefined, { numeric: true });
    
    if (transektCompare !== 0) return transektCompare;
    
    // Then sort by Kvadrat nummer
    const kvadratA = String(a['Kvadrat nummer'] || '');
    const kvadratB = String(b['Kvadrat nummer'] || '');
    return kvadratA.localeCompare(kvadratB, undefined, { numeric: true });
  });
};

function DataGrid({ inputRecords, foundSpecies, onRecalculate, recalculating }) {
  const [rows, setRows] = useState(() =>
    inputRecords && inputRecords.length > 0
      ? sortRows(inputRecords.map(r => ({ ...r })))
      : [createEmptyRow()]
  );
  const [error, setError] = useState(null);
  const [allSpeciesData, setAllSpeciesData] = useState([]);
  const [loadingSpecies, setLoadingSpecies] = useState(true);

  // Load all species data on mount
  useEffect(() => {
    const loadSpecies = async () => {
      try {
        const { data } = await axios.get('/api/species');
        const species = data.species || [];
        console.log(`Loaded ${species.length} species`);
        console.log('Sample species data (first 3):', species.slice(0, 3));
        const withDanish = species.filter(s => s.danishName && s.danishName !== '-');
        console.log(`Species with Danish names: ${withDanish.length}`);
        console.log('Sample Danish species (first 3):', withDanish.slice(0, 3));
        setAllSpeciesData(species);
      } catch (err) {
        console.error('Failed to load species data:', err);
      } finally {
        setLoadingSpecies(false);
      }
    };
    loadSpecies();
  }, []);

  useEffect(() => {
    if (inputRecords && inputRecords.length > 0) {
      setRows(sortRows(inputRecords.map(r => ({ ...r }))));
      setError(null);
    }
  }, [inputRecords]);

  const columns = useMemo(() => {
    if (rows.length === 0) return DISPLAY_COLUMNS;
    const keys = Object.keys(rows[0]);
    return DISPLAY_COLUMNS.filter(col => keys.includes(col));
  }, [rows]);

  // Get filtered species based on search term
  const getFilteredLatinSpecies = (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }
    const term = searchTerm.toLowerCase();
    const filtered = allSpeciesData
      .filter(s => s.latinName && s.latinName.toLowerCase().includes(term))
      .slice(0, 50); // Limit to 50 results
    console.log(`Latin search for "${searchTerm}": found ${filtered.length} matches`);
    return filtered;
  };

  const getFilteredDanishSpecies = (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }
    const term = searchTerm.toLowerCase();
    const filtered = allSpeciesData
      .filter(s => s.danishName && s.danishName !== '-' && s.danishName.toLowerCase().includes(term))
      .slice(0, 50);
    console.log(`Danish search for "${searchTerm}": found ${filtered.length} matches`);
    return filtered;
  };

  const handleCellChange = (rowIndex, key, value) => {
    setRows(prev => {
      const row = prev[rowIndex];
      let updates = { [key]: value };

      if (key === 'Art latin') {
        const trimmed = (value || '').trim();
        if (!trimmed) {
          updates['Art'] = '';
          updates['Arts tom'] = 'Ja';
        } else {
          const species = allSpeciesData.find(
            s => s.latinName && s.latinName.toLowerCase() === trimmed.toLowerCase()
          );
          if (species) {
            updates['Art'] = species.danishName && species.danishName !== '-' ? species.danishName : '';
            updates['Arts tom'] = 'Nej';
          }
        }
      } else if (key === 'Art') {
        const trimmed = (value || '').trim();
        if (!trimmed) {
          updates['Art latin'] = '';
          updates['Arts tom'] = 'Ja';
        } else {
          const species = allSpeciesData.find(
            s => s.danishName && s.danishName !== '-' && s.danishName.toLowerCase() === trimmed.toLowerCase()
          );
          if (species) {
            updates['Art latin'] = species.latinName;
            updates['Arts tom'] = 'Nej';
          }
        }
      } else if (key === 'Arts tom') {
        const isEmpty = ['ja', 'yes', 'true', '1'].includes((value || '').trim().toLowerCase());
        if (isEmpty) {
          updates['Art latin'] = '';
          updates['Art'] = '';
        }
      }

      const next = prev.map((r, i) =>
        i === rowIndex ? { ...r, ...updates } : r
      );
      return next;
    });
    setError(null);
  };

  const handleRecalculate = async () => {
    setError(null);
    try {
      await onRecalculate(rows);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Recalculation failed');
    }
  };

  const addRow = () => {
    if (rows.length === 0) return;
    const emptyRow = {};
    columns.forEach(col => { emptyRow[col] = ''; });
    setRows(prev => [...prev, emptyRow]);
  };

  const removeRow = (index) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="data-grid-container">
      <div className="data-grid-header">
        <h2>Input data (editable)</h2>
        <p className="data-grid-hint">
          Showing key columns for calculations. Edit values and click Recalculate to update DVPI results. Rows with &quot;kvadrat uden plante&quot; checked are skipped.
        </p>
        <div className="data-grid-actions">
          <button
            type="button"
            className="data-grid-button add-row"
            onClick={addRow}
          >
            Add row
          </button>
          <button
            type="button"
            className="data-grid-button recalculate"
            onClick={handleRecalculate}
            disabled={recalculating || rows.length === 0}
          >
            {recalculating ? 'Calculating…' : 'Recalculate'}
          </button>
        </div>
      </div>
      {error && <div className="data-grid-error">{error}</div>}
      <div className="data-grid-wrapper">
        <table className="data-grid-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}>{col === 'Arts tom' ? 'kvadrat uden plante' : col}</th>
              ))}
              <th className="data-grid-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map(col => {
                  // For Art latin column, use text input with filtered datalist
                  if (col === 'Art latin') {
                    const currentValue = row[col] ?? '';
                    const filteredSpecies = getFilteredLatinSpecies(currentValue);
                    
                    return (
                      <td key={col}>
                        <input
                          type="text"
                          value={currentValue}
                          onChange={e => handleCellChange(rowIndex, col, e.target.value)}
                          className="data-grid-input"
                          placeholder="Type to search Latin name..."
                          list={`latin-species-list-${rowIndex}`}
                        />
                        <datalist id={`latin-species-list-${rowIndex}`}>
                          {filteredSpecies.map((species, idx) => (
                            <option key={idx} value={species.latinName} />
                          ))}
                        </datalist>
                      </td>
                    );
                  }
                  
                  // For Art (Danish name) column, use text input with filtered datalist
                  if (col === 'Art') {
                    const currentValue = row[col] ?? '';
                    const filteredSpecies = getFilteredDanishSpecies(currentValue);
                    
                    return (
                      <td key={col}>
                        <input
                          type="text"
                          value={currentValue}
                          onChange={e => handleCellChange(rowIndex, col, e.target.value)}
                          className="data-grid-input"
                          placeholder="Type to search Danish name..."
                          list={`danish-species-list-${rowIndex}`}
                        />
                        <datalist id={`danish-species-list-${rowIndex}`}>
                          {filteredSpecies.map((species, idx) => (
                            <option key={idx} value={species.danishName} />
                          ))}
                        </datalist>
                      </td>
                    );
                  }
                  
                  // For Dækningsgrad, use select with interval options
                  if (col === 'Dækningsgrad') {
                    const currentValue = row[col] ?? '';
                    const valueInList = DAEKNINGSGRAD_INTERVALS.includes(currentValue) ? currentValue : '';
                    return (
                      <td key={col}>
                        <select
                          value={valueInList}
                          onChange={e => handleCellChange(rowIndex, col, e.target.value)}
                          className="data-grid-select"
                        >
                          <option value="">Vælg interval</option>
                          {DAEKNINGSGRAD_INTERVALS.map((interval, idx) => (
                            <option key={idx} value={interval}>{interval}%</option>
                          ))}
                        </select>
                      </td>
                    );
                  }
                  
                  // For Arts tom (kvadrat uden plante), use checkbox
                  if (col === 'Arts tom') {
                    const value = (row[col] ?? '').toString().trim().toLowerCase();
                    const checked = ['ja', 'yes', 'true', '1'].includes(value);
                    return (
                      <td key={col}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => handleCellChange(rowIndex, col, e.target.checked ? 'Ja' : 'Nej')}
                          className="data-grid-checkbox"
                          title="Kvadrat uden plante"
                        />
                      </td>
                    );
                  }
                  
                  // For other columns, use text input
                  return (
                    <td key={col}>
                      <input
                        type="text"
                        value={row[col] ?? ''}
                        onChange={e => handleCellChange(rowIndex, col, e.target.value)}
                        className="data-grid-input"
                        placeholder={col}
                      />
                    </td>
                  );
                })}
                <td className="data-grid-actions-col">
                  <button
                    type="button"
                    className="data-grid-remove"
                    onClick={() => removeRow(rowIndex)}
                    disabled={rows.length <= 1}
                    title="Remove row"
                  >
                    ✕
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
