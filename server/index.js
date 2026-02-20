// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseCSV, processData, callDVPI, searchSpecies } = require('./dvpiProcessor');

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
    console.log('Serving static files from:', clientBuildPath);
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
    console.error('Species search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// File upload and processing endpoint
app.post('/api/process', upload.single('file'), async (req, res) => {
  try {
    console.log('=== File upload received ===');
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`File uploaded: ${req.file.originalname}, size: ${req.file.size}, path: ${req.file.path}`);
    const filePath = req.file.path;
    const results = await processCSVFile(filePath);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json(results);
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: error.message });
  }
});

async function processCSVFile(filePath) {
  console.log(`processCSVFile: starting to process ${filePath}`);
  // Parse CSV
  const data = await parseCSV(filePath);
  console.log(`processCSVFile: parseCSV returned ${data ? data.length : 0} records`);
  
  // Process data and build SOAP requests
  console.log('processCSVFile: calling processData...');
  const processedData = processData(data);
  console.log(`processCSVFile: processData returned ${processedData.groups.length} groups, ${processedData.totalRows} total rows`);
  
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
      console.error(`Error processing group ${group.sheet}:`, error);
      results.push({
        sheet: group.sheet,
        error: error.message
      });
    }
  }
  
  return {
    results,
    totalRows: processedData.totalRows,
    rawRecords: data
  };
}

// Process from JSON (e.g. grid data) for re-calculate
app.post('/api/process-json', express.json(), async (req, res) => {
  try {
    const { records } = req.body || {};
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Request body must contain a "records" array' });
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
    console.error('Error processing JSON:', error);
    res.status(500).json({ error: error.message });
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV === 'production') {
    console.log('Production mode: serving React app');
  }
});
