import React, { useState } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import ResultsGrid from './components/ResultsGrid';

function App() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileProcessed = (data) => {
    setResults(data);
    setError(null);
  };

  const handleError = (err) => {
    setError(err);
    setResults(null);
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
        {results && !loading && (
          <ResultsGrid results={results.results} totalRows={results.totalRows} />
        )}
      </main>
    </div>
  );
}

export default App;
