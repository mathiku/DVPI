import React from 'react';
import './ResultsGrid.css';

function ResultsGrid({ results, totalRows, calculating }) {
  const handleDownload = () => {
    const headers = ['Ark', 'DVPI', 'DK', 'EQR'];
    const rows = results.map(r => [
      r.sheet || '',
      r.dvpi || '',
      r.dk || '',
      r.eqr || ''
    ]);
    
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
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => (
              <tr key={index} className={result.error ? 'error-row' : ''}>
                <td>{result.sheet || '(ukendt)'}</td>
                <td>{result.error ? 'Fejl' : (result.dvpi || '-')}</td>
                <td>{result.error ? '' : (result.dk || '-')}</td>
                <td>{result.error ? '' : (result.eqr || '-')}</td>
              </tr>
            ))}
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
