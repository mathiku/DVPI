import React from 'react';
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

function ResultsGrid({ results, totalRows, calculating }) {
  const handleDownload = () => {
    const headers = ['Ark', 'DVPI', 'DK', 'EQR', 'Kategori', 'Tilstand'];
    const rows = results.map(r => {
      const eqr = r.error ? null : (r.eqr != null && r.eqr !== '' ? parseFloat(String(r.eqr).replace(',', '.')) : null);
      const cat = eqrToCategory(eqr);
      return [
        r.sheet || '',
        r.dvpi || '',
        r.dk || '',
        r.eqr || '',
        cat ? cat.dvpiClass : '',
        cat ? cat.label : ''
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `dvpi_resultater_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              <th>Ark</th>
              <th>DVPI</th>
              <th>DK</th>
              <th>EQR</th>
              <th>Kategori</th>
              <th>Tilstand</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => {
              const eqr = result.error ? null : (result.eqr != null && result.eqr !== '' ? parseFloat(String(result.eqr).replace(',', '.')) : null);
              const category = eqrToCategory(eqr);
              return (
                <tr key={index} className={result.error ? 'error-row' : ''}>
                  <td>{result.sheet || '(ukendt)'}</td>
                  <td>{result.error ? 'Fejl' : (result.dvpi || '-')}</td>
                  <td>{result.error ? '' : (result.dk || '-')}</td>
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
