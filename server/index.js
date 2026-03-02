// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseCSV, processData, callDVPI, searchSpecies, rawRecordsToGridRecords, sortGridRecords } = require('./dvpiProcessor');

const app = express();
const PORT = process.env.PORT || 4001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
  if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
  }
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({ 
  dest: uploadsDir,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Template download: serve xlsx from input folder
const templatePath = path.join(__dirname, '..', 'input', 'Skabelon til DVPI beregner_WSP.xlsx');
app.get('/api/template', (req, res) => {
  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({ error: 'Skabelonen kunne ikke findes. Kontakt venligst support.' });
  }
  res.download(templatePath, 'Skabelon til DVPI beregner_WSP.xlsx', (err) => {
    if (err && !res.headersSent) res.status(500).json({ error: 'Skabelonen kunne ikke hentes. Prøv venligst igen.' });
  });
});

// Species search for grid dropdowns (min 3 chars). type=latin søger kun LatinName, type=dansk kun DanishName.
app.get('/api/species', (req, res) => {
  const q = (req.query.q || '').trim();
  const type = (req.query.type || '').toLowerCase();
  if (q.length < 3) {
    return res.json([]);
  }
  try {
    const list = searchSpecies(q, type === 'dansk' ? 'dansk' : type === 'latin' ? 'latin' : undefined);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Artssøgningen fejlede. Prøv venligst igen.' });
  }
});

// File upload and processing endpoint
app.post('/api/process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Ingen fil blev modtaget. Prøv venligst igen.' });
    }

    const filePath = req.file.path;
    const results = await processCSVFile(filePath);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Der opstod en fejl under behandling af filen.' });
  }
});

async function processCSVFile(filePath) {
  const data = await parseCSV(filePath);
  const processedData = processData(data);
  
  // Call DVPI service for each group
  const results = [];
  for (const group of processedData.groups) {
    try {
      const response = await callDVPI(group.soapInput);
      results.push({
        sheet: group.sheet,
        dvpi: response.dvpi,
        dk: response.dk,
        eqr: response.eqr
      });
    } catch (error) {
      results.push({
        sheet: group.sheet,
        error: 'Beregningen kunne ikke gennemføres for denne gruppe.'
      });
    }
  }
  
  const gridRecords = rawRecordsToGridRecords(data);
  const rawRecords = sortGridRecords(gridRecords);

  let stedID = '';
  let stedtekst = '';
  if (data && data.length > 0) {
    const first = data[0];
    const headers = Object.keys(first);
    const norm = (h) => h.toLowerCase().replace(/\s/g, '');
    const colStedID = headers.find(h => norm(h) === 'stedid') || headers.find(h => norm(h) === 'stationsnummer');
    const colStedtekst = headers.find(h => norm(h) === 'stedtekst') || headers.find(h => norm(h) === 'stednavn') || headers.find(h => norm(h) === 'navn');
    if (colStedID && first[colStedID] != null) stedID = String(first[colStedID]).trim();
    if (colStedtekst && first[colStedtekst] != null) stedtekst = String(first[colStedtekst]).trim();
  }
  const sheetLabel = (stedID && stedtekst) ? `${stedID} - ${stedtekst}` : (stedtekst || '(pasted)');
  if (results.length > 0) results[0].sheet = sheetLabel;

  return {
    results,
    totalRows: processedData.totalRows,
    rawRecords,
    stedID,
    stedtekst
  };
}

// Process from JSON (e.g. grid data) for re-calculate
app.post('/api/process-json', express.json(), async (req, res) => {
  try {
    const { records } = req.body || {};
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Ugyldige data. Prøv venligst igen.' });
    }
    const processedData = processData(records);
    const results = [];
    for (const group of processedData.groups) {
      try {
        const response = await callDVPI(group.soapInput);
        results.push({
          sheet: group.sheet,
          dvpi: response.dvpi,
          dk: response.dk,
          eqr: response.eqr
        });
      } catch (error) {
        results.push({ sheet: group.sheet, error: error.message });
      }
    }
    res.json({
      results,
      totalRows: processedData.totalRows
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Der opstod en fejl ved beregningen.' });
  }
});

// API routes must come before the catch-all route
// (already defined above)

// Catch-all handler: send back React's index.html file for client-side routing
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
  if (fs.existsSync(clientBuildPath)) {
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
  }
}

app.listen(PORT);
