// Load environment variables from .env file (if it exists)
try {
  require('dotenv').config();
} catch (e) {
  // dotenv is optional, continue without it
  console.log('No .env file found, using environment variables');
}

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseCSV, processData, callDVPI } = require('./dvpiProcessor');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('Starting server...');
console.log('PORT environment variable:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

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
let uploadsDir = path.join(__dirname, '..', 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`Created uploads directory: ${uploadsDir}`);
  } else {
    console.log(`Uploads directory exists: ${uploadsDir}`);
  }
} catch (error) {
  console.error(`Warning: Could not create uploads directory at ${uploadsDir}:`, error.message);
  // Fallback to /tmp if uploads directory can't be created
  const tmpDir = '/tmp/uploads';
  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    console.log(`Using temporary directory for uploads: ${tmpDir}`);
    uploadsDir = tmpDir;
  } catch (tmpError) {
    console.error('Failed to create temporary uploads directory:', tmpError.message);
    throw new Error('Cannot create uploads directory. Please check filesystem permissions.');
  }
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

// File upload and processing endpoint
app.post('/api/process', upload.single('file'), async (req, res) => {
  let filePath = null;
  try {
    console.log('=== File upload received ===');
    console.log('Request body keys:', Object.keys(req.body || {}));
    console.log('Request file:', req.file ? 'present' : 'missing');
    
    if (!req.file) {
      console.error('No file in request. Files:', req.files);
      return res.status(400).json({ error: 'No file uploaded. Please ensure the file field is named "file".' });
    }

    console.log(`File uploaded: ${req.file.originalname}, size: ${req.file.size}, path: ${req.file.path}`);
    filePath = req.file.path;
    const results = await processCSVFile(filePath);

    // Clean up uploaded file
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Cleaned up uploaded file:', filePath);
      }
    } catch (cleanupError) {
      console.warn('Could not delete uploaded file:', cleanupError.message);
      // Don't fail the request if cleanup fails
    }

    res.json(results);
  } catch (error) {
    console.error('Error processing file:', error);
    console.error('Error stack:', error.stack);
    
    // Clean up uploaded file on error
    if (filePath) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupError) {
        console.warn('Could not delete file on error:', cleanupError.message);
      }
    }
    
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

async function processCSVFile(filePath) {
  try {
    console.log(`processCSVFile: starting to process ${filePath}`);
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    console.log(`processCSVFile: file size: ${stats.size} bytes`);
    
    // Parse CSV
    console.log('processCSVFile: calling parseCSV...');
    const data = await parseCSV(filePath);
    console.log(`processCSVFile: parseCSV returned ${data ? data.length : 0} records`);
    
    if (!data || data.length === 0) {
      throw new Error('CSV file appears to be empty or could not be parsed');
    }
    
    // Process data and build SOAP requests
    console.log('processCSVFile: calling processData...');
    const processedData = processData(data);
    console.log(`processCSVFile: processData returned ${processedData.groups.length} groups, ${processedData.totalRows} total rows`);
    
    if (!processedData.groups || processedData.groups.length === 0) {
      throw new Error('No data groups found after processing');
    }
    
    // Call DVPI service for each group
    console.log(`processCSVFile: processing ${processedData.groups.length} groups...`);
    const results = [];
    for (let i = 0; i < processedData.groups.length; i++) {
      const group = processedData.groups[i];
      try {
        console.log(`processCSVFile: calling DVPI service for group ${i + 1}/${processedData.groups.length} (sheet: ${group.sheet})`);
        const response = await callDVPI(group.soapInput);
        results.push({
          sheet: group.sheet,
          dvpi: response.dvpi,
          dk: response.dk,
          eqr: response.eqr
        });
        console.log(`processCSVFile: successfully processed group ${i + 1}`);
      } catch (error) {
        console.error(`Error processing group ${group.sheet}:`, error.message);
        console.error(`Error stack for group ${group.sheet}:`, error.stack);
        results.push({
          sheet: group.sheet,
          error: error.message
        });
      }
    }
    
    console.log(`processCSVFile: completed processing, returning ${results.length} results`);
    return {
      results,
      totalRows: processedData.totalRows
    };
  } catch (error) {
    console.error('processCSVFile: error occurred:', error.message);
    console.error('processCSVFile: error stack:', error.stack);
    throw error;
  }
}

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

// Start server with error handling
try {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Listening on 0.0.0.0:${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    if (process.env.NODE_ENV === 'production') {
      console.log('✓ Production mode: serving React app');
    }
  }).on('error', (err) => {
    console.error('✗ Failed to start server:', err);
    process.exit(1);
  });
} catch (error) {
  console.error('✗ Error starting server:', error);
  process.exit(1);
}
