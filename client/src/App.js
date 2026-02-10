import React, { useState } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import DataGrid from './components/DataGrid';
import ResultsGrid from './components/ResultsGrid';
import axios from 'axios';

function App() {
  const [results, setResults] = useState(null);
  const [inputRecords, setInputRecords] = useState(null);
  const [foundSpecies, setFoundSpecies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState(null);

  const handleFileProcessed = (data) => {
    setResults(data);
    setInputRecords(data.inputRecords || null);
    setFoundSpecies(data.foundSpecies || []);
    setError(null);
  };

  const handleRecalculate = async (editedRecords) => {
    setRecalculating(true);
    try {
      const { data } = await axios.post('/api/process-data', {
        inputRecords: editedRecords,
      });
      setResults(data);
      setFoundSpecies(data.foundSpecies || []);
    } finally {
      setRecalculating(false);
    }
  };

  const handleError = (err) => {
    setError(err);
    setResults(null);
    setInputRecords(null);
    setFoundSpecies([]);
  };

  const handleLoading = (isLoading) => {
    setLoading(isLoading);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>DVPI Calculator</h1>
        <p>Upload a CSV file to calculate DVPI, DK, and EQR values</p>
      </header>
      <main className="App-main">
        <FileUpload
          onFileProcessed={handleFileProcessed}
          onError={handleError}
          onLoading={handleLoading}
        />
        {loading && (
          <div className="loading">
            <p>Processing file and calculating DVPI values...</p>
          </div>
        )}
        {error && (
          <div className="error">
            <p>Error: {error}</p>
          </div>
        )}
        {!loading && (
          <DataGrid
            inputRecords={inputRecords}
            foundSpecies={foundSpecies || []}
            onRecalculate={handleRecalculate}
            recalculating={recalculating}
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
