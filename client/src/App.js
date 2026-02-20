import React, { useState } from 'react';
import axios from 'axios';
import './App.css';
import FileUpload from './components/FileUpload';
import ResultsGrid from './components/ResultsGrid';
import DataGrid from './components/DataGrid';

function App() {
  const [results, setResults] = useState(null);
  const [rawRecords, setRawRecords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState(null);
  const [gridOpen, setGridOpen] = useState(false);

  const handleFileProcessed = (data) => {
    setResults(data);
    setRawRecords(data.rawRecords || null);
    setGridOpen(true);
    setError(null);
  };

  const handleError = (err) => {
    setError(err);
    setResults(null);
    setRawRecords(null);
  };

  const handleLoading = (isLoading) => {
    setLoading(isLoading);
  };

  const handleRecalculate = async (rows) => {
    if (!rows || rows.length === 0) return;
    setRecalculating(true);
    setError(null);
    try {
      const response = await axios.post('/api/process-json', { records: rows });
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setRecalculating(false);
    }
  };

  const showGrid = gridOpen || (rawRecords && rawRecords.length > 0);

  return (
    <div className="App">
      <header className="App-header">
        <img src={process.env.PUBLIC_URL + '/wsplogo.png'} alt="WSP" className="App-logo" />
        <h1>DVPI-beregner</h1>
        <p>Upload en CSV-fil eller indtast data i tabellen for at beregne DVPI-, DK- og EQR-værdier</p>
      </header>
      <main className="App-main">
        <FileUpload
          onFileProcessed={handleFileProcessed}
          onError={handleError}
          onLoading={handleLoading}
        />
        {!showGrid && (
          <button
            type="button"
            className="open-grid-button"
            onClick={() => setGridOpen(true)}
          >
            Åbn tabel til manuel indtastning
          </button>
        )}
        {loading && (
          <div className="loading">
            <p>Behandler fil og beregner DVPI-værdier…</p>
          </div>
        )}
        {error && (
          <div className="error">
            <p>Fejl: {error}</p>
          </div>
        )}
        {showGrid && (
          <DataGrid
            records={rawRecords || []}
            onCalculate={handleRecalculate}
            calculating={recalculating}
          />
        )}
        {results && !loading && (
          <ResultsGrid results={results.results} totalRows={results.totalRows} />
        )}
      </main>
    </div>
  );
}

export default App;
