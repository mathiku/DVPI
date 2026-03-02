import React, { useState } from 'react';
import axios from 'axios';
import './App.css';
import FileUpload from './components/FileUpload';
import ResultsGrid from './components/ResultsGrid';
import DataGrid from './components/DataGrid';

function App() {
  const [results, setResults] = useState(null);
  const [rawRecords, setRawRecords] = useState(null);
  const [stedID, setStedID] = useState(null);
  const [stedtekst, setStedtekst] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState(null);
  const [gridOpen, setGridOpen] = useState(false);

  const handleFileProcessed = (data) => {
    setResults(data);
    setRawRecords(data.rawRecords || null);
    setStedID(data.stedID ?? null);
    setStedtekst(data.stedtekst ?? null);
    setGridOpen(true);
    setError(null);
  };

  const handleError = (err) => {
    setError(err);
    setResults(null);
    setRawRecords(null);
    setStedID(null);
    setStedtekst(null);
  };

  const handleLoading = (isLoading) => {
    setLoading(isLoading);
  };

  const handleDownloadTemplate = () => {
    const templateUrl = '/api/template';
    const a = document.createElement('a');
    a.href = templateUrl;
    a.download = 'Skabelon til DVPI beregner_WSP.xlsx';
    a.click();
  };

  const handleRecalculate = async (rows) => {
    if (!rows || rows.length === 0) return;
    setRecalculating(true);
    setError(null);
    try {
      // Trim payload to only what the backend needs (avoids 413 Payload Too Large)
      const trimmedRecords = rows.map((r) => ({
        'Transektundersøgelse': r['Transektundersøgelse'] ?? '',
        'Kvadrat nummer': r['Kvadrat nummer'] ?? '',
        'Art latin': r['Art latin'] ?? '',
        'Arts tom': r['Arts tom'] ?? '',
      }));
      const response = await axios.post('/api/process-json', { records: trimmedRecords });
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Der opstod en fejl ved beregningen. Prøv venligst igen.');
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
        <p>Upload en CSV-fil eller indtast data i tabellen for at beregne DVPI- og EQR-værdier</p>
      </header>
      <div className="App-body">
        <main className="App-main">
          {results && (
            <ResultsGrid
              results={results.results}
              totalRows={results.totalRows}
              calculating={loading || recalculating}
              stedID={stedID}
              stedtekst={stedtekst}
            />
          )}
          <FileUpload
            onFileProcessed={handleFileProcessed}
            onError={handleError}
            onLoading={handleLoading}
          />
          <button
            type="button"
            className="template-download-button"
            onClick={handleDownloadTemplate}
          >
            Hent skabelon
          </button>
          {!showGrid && (
            <button
              type="button"
              className="open-grid-button"
              onClick={() => setGridOpen(true)}
            >
              Åbn tabel til manuel indtastning
            </button>
          )}
          <div className="vejledning">
            <h3>Vejledning</h3>
            <ul>
              <li>Med knappen "Hent skabelon" kan en excel-skabelon hentes, til indtastning af transekter med kvadrater og plantefund.</li>
              <li>Det er også muligt at indtaste direkte i tabellen på siden, f.eks. hvis man ønsker at undersøge hvilken EQR-værdi, beregneren tildeler de enkelte arter.</li>
              <li>For at beregne den økologiske tilstand i en eksisterende DVPI-undersøgelse, kan CSV-filer hentes direkte fra kemidata.dk, og slippes i ovenstående felt hvorefter den økologiske tilstand angives.</li>
            </ul>
          </div>
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
        </main>
        <aside className="App-sidebar">
          <section className="App-footer-sales">
            <p>WSP udfører vandplanteundersøgelser med henblik på fastlæggelse af fremtidig grødeskæring i forbindelse med regulativrevision, men også generelle tilstandsvurderinger af vandplanter ved brug af DVPI-indekset. Ræk ud til <a href="mailto:anette.alnoe@wsp.com">Anette Baisner</a> for en uforpligtende snak.</p>
            <p>Ved spørgsmål eller forslag til forbedring af beregnerens opsætning, kontakt <a href="mailto:martin.nielsen@wsp.com">Martin Barsøe</a></p>
          </section>
          <section className="App-footer-references">
            <p className="App-footer-dce">Denne side trækker på en tjeneste fremstillet af DCE – Nationalt Center for Miljø og Energi</p>
            <p>Læs mere om beregneren og find øvrig information om Dansk Vandløbsplanteindeks:</p>
            <ul className="App-footer-ref-list">
              <li><strong>DVPI-beregneren:</strong> Larsen, S. E., Nielsen, D. N. og Erfurt, J. 2025. Ny og forbedret operationalisering af Dansk VandløbsPlante Indeks – Teknisk dokumentation. Aarhus Universitet, DCE – Nationalt Center for Miljø og Energi, 17 s. - Fagligt notat nr. 2025|43.{' '}<a href="https://dce.au.dk/fileadmin/dce.au.dk/Udgivelser/Notater_2025/N2025_43.pdf" target="_blank" rel="noopener noreferrer">PDF</a></li>
              <li><strong>Dansk Vandløbsplanteindeks:</strong> Larsen, S.E. 2025. Dansk VandPlante Indeks (DVPI) - udvikling, anvendelse og begrænsninger. Aarhus Universitet, DCE – Nationalt Center for Miljø og Energi, 25 s. - Fagligt notat nr. 2025|32.{' '}<a href="https://dce.au.dk/fileadmin/dce.au.dk/Udgivelser/Notater_2025/N2025_32.pdf" target="_blank" rel="noopener noreferrer">PDF</a></li>
              <li><strong>Tilstandsklasser (EQR):</strong> Larsen, S. E. og Baattrup-Pedersen, A. (2015). Matematisk beskrivelse af Dansk Vandløbsplante Indeks. Aarhus Universitet, DCE – Nationalt Center for Miljø og Energi, 14 s. – notat fra DCE - Nationalt Center for Miljø og Energi.{' '}<a href="http://dce.au.dk/fileadmin/dce.au.dk/Udgivelser/Notater_2015/Matematisk_beskrivelse_af_DVP.pdf" target="_blank" rel="noopener noreferrer">PDF</a></li>
              <li><strong>Teknisk anvisning til feltarbejdet:</strong> Wiberg-Larsen, P. og Baattrup-Pedersen, A. (2017). &quot;Vandplanter&quot; i vandløb. Teknisk anvisning, TA. V17, Version 2.9, Institut for Ecoscience, Aarhus Universitet.{' '}<a href="https://ecos.au.dk/fileadmin/ecos/Fagdatacentre/Ferskvand/V17_Revision2_9.pdf" target="_blank" rel="noopener noreferrer">PDF</a></li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default App;
