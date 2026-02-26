import React, { useState, useMemo } from 'react';
import './ResultsGrid.css';

/** EQR to DVPI class (1-5) and Danish tilstand. Rules from DCE tilstandsklasser. */
function eqrToCategory(eqrValue) {
  if (eqrValue == null || eqrValue === '' || Number.isNaN(eqrValue)) return null;
  const n = typeof eqrValue === 'number' ? eqrValue : parseFloat(String(eqrValue).replace(',', '.'));
  if (Number.isNaN(n)) return null;
  if (n < 0.20) return { dvpiClass: 1, label: 'dårlig økologisk tilstand' };
  if (n < 0.35) return { dvpiClass: 2, label: 'ringe økologisk tilstand' };
  if (n < 0.50) return { dvpiClass: 3, label: 'moderat økologisk tilstand' };
  if (n < 0.70) return { dvpiClass: 4, label: 'god økologisk tilstand' };
  return { dvpiClass: 5, label: 'høj økologisk tilstand' };
}

const RESULT_HEADERS = [
  { key: 'sheet', label: 'Ark' },
  { key: 'eqr', label: 'EQR' },
  { key: 'dvpi', label: 'DVPI-værdi' },
  { key: 'tilstand', label: 'Tilstand' }
];

function ResultsGrid({ results, totalRows, calculating, stedID, stedtekst }) {
  const [sortKey, setSortKey] = useState('sheet');
  const [sortAsc, setSortAsc] = useState(true);

  const sortedResults = useMemo(() => {
    if (!results || results.length === 0) return results;
    const key = sortKey;
    const asc = sortAsc;
    return [...results].sort((a, b) => {
      let va = a[key];
      let vb = b[key];
      if (key === 'eqr') {
        va = va != null && va !== '' ? parseFloat(String(va).replace(',', '.')) : null;
        vb = vb != null && vb !== '' ? parseFloat(String(vb).replace(',', '.')) : null;
        if (va == null && vb == null) return 0;
        if (va == null) return asc ? 1 : -1;
        if (vb == null) return asc ? -1 : 1;
        return asc ? va - vb : vb - va;
      }
      if (key === 'dvpi') {
        const eqrA = a.eqr != null && a.eqr !== '' ? parseFloat(String(a.eqr).replace(',', '.')) : null;
        const eqrB = b.eqr != null && b.eqr !== '' ? parseFloat(String(b.eqr).replace(',', '.')) : null;
        const catA = eqrToCategory(eqrA);
        const catB = eqrToCategory(eqrB);
        va = catA ? catA.dvpiClass : '';
        vb = catB ? catB.dvpiClass : '';
        if (va === vb) return 0;
        return asc ? (va - vb) : (vb - va);
      }
      if (key === 'tilstand') {
        const eqrA = a.eqr != null && a.eqr !== '' ? parseFloat(String(a.eqr).replace(',', '.')) : null;
        const eqrB = b.eqr != null && b.eqr !== '' ? parseFloat(String(b.eqr).replace(',', '.')) : null;
        va = (eqrToCategory(eqrA) || {}).label || '';
        vb = (eqrToCategory(eqrB) || {}).label || '';
      }
      va = String(va ?? '');
      vb = String(vb ?? '');
      const cmp = va.localeCompare(vb, 'da');
      return asc ? cmp : -cmp;
    });
  }, [results, sortKey, sortAsc]);

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(prev => !prev);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleDownload = () => {
    const headers = ['Ark', 'EQR', 'DVPI-værdi', 'Tilstand'];
    const source = sortedResults || results || [];
    const rows = source.map(r => {
      const eqr = r.error ? null : (r.eqr != null && r.eqr !== '' ? parseFloat(String(r.eqr).replace(',', '.')) : null);
      const cat = eqrToCategory(eqr);
      return [
        r.sheet || '',
        r.eqr || '',
        cat ? cat.dvpiClass : '',
        cat ? cat.label : ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const safe = (s) => String(s ?? '').replace(/[/\\:*?"<>|]/g, '-').trim() || '';
    const hasPlace = stedID != null && stedtekst != null && (String(stedID).trim() || String(stedtekst).trim());
    const baseName = hasPlace ? `WSP DVPIberegner - ${safe(stedID)} - ${safe(stedtekst)}` : 'WSP DVPIberegner - manuelt indtastet';
    const filename = `${baseName}.csv`;

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className={`results-container${calculating ? ' results-container--calculating' : ''}`}>
      <div className="results-header">
        <h2>Resultater</h2>
        <p className="results-summary">
          Behandlet {totalRows} rækker fra {results.length} ark
        </p>
        <button
          onClick={handleDownload}
          className="download-button"
          disabled={calculating}
          aria-busy={calculating}
        >
          Download resultater som CSV
        </button>
      </div>
      <div className="results-table-wrapper">
        <table className="results-table">
          <thead>
            <tr>
              {RESULT_HEADERS.map(({ key, label }) => (
                <th key={key} className="results-table-sortable" onClick={() => handleSort(key)}>
                  {label}
                  {sortKey === key && <span className="results-table-sort-icon" aria-hidden="true">{sortAsc ? ' ↑' : ' ↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(sortedResults || results || []).map((result, index) => {
              const eqr = result.error ? null : (result.eqr != null && result.eqr !== '' ? parseFloat(String(result.eqr).replace(',', '.')) : null);
              const category = eqrToCategory(eqr);
              return (
                <tr key={index} className={result.error ? 'error-row' : ''}>
                  <td>{result.sheet || '(ukendt)'}</td>
                  <td>{result.error ? '' : (result.eqr || '-')}</td>
                  <td>{result.error ? '' : (category ? category.dvpiClass : '-')}</td>
                  <td>{result.error ? '' : (category ? category.label : '-')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {results.some(r => r.error) && (
          <div className="error-details">
            {results
              .filter(r => r.error)
              .map((r, idx) => (
                <p key={idx} className="error-message">
                  <strong>{r.sheet}:</strong> {r.error}
                </p>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResultsGrid;
