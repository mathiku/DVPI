const fs = require('fs');
const { parse } = require('csv-parse/sync');
const axios = require('axios');
const { parseString } = require('xml2js');
const path = require('path');

// Load species code mapping
let latinToCode = new Map();
let speciesList = []; // { latin, danish, code } for API
let speciesCodesLoaded = false;

function loadSpeciesCodes() {
  if (speciesCodesLoaded) return;
  
  // Try to find stancode file
  const candidates = [
    path.join(__dirname, '..', '..', 'DVPImaster', 'bin', 'Debug', 'net8.0-windows', 'stancode_utf8.csv'),
    path.join(__dirname, '..', '..', 'DVPIClientApp', 'dvpi_app', 'data', 'stancode_utf8.csv'),
    path.join(__dirname, 'stancode_utf8.csv')
  ];
  
  let found = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      found = candidate;
      break;
    }
  }
  
  if (!found) {
    console.warn('stancode_utf8.csv not found. Species code mapping will be limited.');
    speciesCodesLoaded = true;
    return;
  }
  
  try {
    const content = fs.readFileSync(found, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';'
    });
    
    for (const record of records) {
      const listId = record.CodeListIdentifier || '';
      if (listId !== '1064') continue;
      
      const scCode = record.ScCode || '';
      const latinName = record.LatinName || '';
      const danishName = (record.DanishName || record.Art || record.Navn || record.VernacularName || '').trim() || latinName;
      
      if (scCode && latinName) {
        latinToCode.set(latinName.toLowerCase(), scCode);
        speciesList.push({ latin: latinName, danish: danishName, code: scCode });
      }
    }
    
    console.log(`Loaded ${latinToCode.size} species codes from ${found}`);
    speciesCodesLoaded = true;
  } catch (error) {
    console.error('Error loading species codes:', error);
    speciesCodesLoaded = true;
  }
}

/** Returns species matching query (min 3 chars). Search on both latin and danish. */
function searchSpecies(q) {
  loadSpeciesCodes();
  const term = (q || '').trim().toLowerCase();
  if (term.length < 3) return [];
  return speciesList.filter(
    s =>
      s.latin.toLowerCase().includes(term) ||
      s.danish.toLowerCase().includes(term)
  ).slice(0, 100);
}

// Initialize on module load
loadSpeciesCodes();

function splitColumns(line) {
  let delimiter = 'unknown';
  let result;
  
  if (line.includes('\t')) {
    delimiter = 'TAB';
    result = line.split('\t');
  } else if (line.includes(';')) {
    delimiter = 'SEMICOLON';
    result = line.split(';');
  } else if (line.includes(',')) {
    delimiter = 'COMMA';
    result = line.split(',');
  } else {
    delimiter = '>=2 SPACES';
    result = line.split(/\s{2,}/).filter(s => s.length > 0);
  }
  
  console.log(`splitColumns: detected delimiter="${delimiter}", columns=${result.length}`);
  return result;
}

function getSpeciesCode(latinName) {
  if (!latinName) return '0';
  
  // If already numeric, return as-is
  if (/^\d+$/.test(latinName.trim())) {
    return latinName.trim();
  }
  
  // Look up in mapping
  const code = latinToCode.get(latinName.trim().toLowerCase());
  return code || '0';
}

async function parseCSV(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
    console.log('parseCSV: removed BOM from file');
  }
  
  // Try to detect delimiter
  const firstLine = content.split('\n')[0];
  let delimiter = ';';
  
  console.log(`parseCSV: detected delimiter="${delimiter === '\t' ? 'TAB' : delimiter === ',' ? 'COMMA' : 'SEMICOLON'}", firstLine length=${firstLine.length}`);
  console.log(`parseCSV: first 200 chars of first line: "${firstLine.substring(0, 200)}"`);
  
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: delimiter,
    relax_column_count: true,
    trim: true,
    bom: true  // Handle BOM automatically
  });
  
  if (records.length > 0) {
    const headers = Object.keys(records[0]);
    console.log(`parseCSV: parsed ${records.length} records, found ${headers.length} columns`);
    console.log(`parseCSV: all headers=[${headers.join(', ')}]`);
    
    // Check for the specific columns we need
    const hasArtLatin = headers.some(h => h.toLowerCase().includes('art latin'));
    const hasDaekningsgrad = headers.some(h => h.toLowerCase().includes('dækningsgrad'));
    console.log(`parseCSV: has "Art latin"=${hasArtLatin}, has "Dækningsgrad"=${hasDaekningsgrad}`);
    
    // Show exact matches
    const artLatinHeader = headers.find(h => h.toLowerCase().includes('art latin'));
    const daekningsgradHeader = headers.find(h => h.toLowerCase().includes('dækningsgrad'));
    console.log(`parseCSV: "Art latin" header found as: "${artLatinHeader || 'NOT FOUND'}"`);
    console.log(`parseCSV: "Dækningsgrad" header found as: "${daekningsgradHeader || 'NOT FOUND'}"`);
  } else {
    console.log('parseCSV: no records parsed');
  }
  
  return records;
}

function processData(records) {
  if (!records || records.length === 0) {
    return { groups: [], totalRows: 0 };
  }
  
  // Detect Danish header format
  const headers = Object.keys(records[0] || {});
  console.log(`processData: checking ${headers.length} headers for Danish format`);
  console.log(`processData: all headers=[${headers.join(', ')}]`);
  
  const hasDanishHeader = headers.some(h => 
    h.toLowerCase().includes('art latin') || 
    h.toLowerCase().includes('dækningsgrad') ||
    h.toLowerCase().includes('arts tom')
  );
  
  console.log(`processData: hasDanishHeader=${hasDanishHeader}`);
  
  if (!hasDanishHeader) {
    throw new Error('CSV does not appear to have Danish vegetation data format');
  }
  
  // Find column indices
  const findColumn = (name) => {
    const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
    console.log(`processData: findColumn("${name}") = ${idx >= 0 ? idx : 'NOT FOUND'}`);
    return idx;
  };
  
  const idxLatin = findColumn('Art latin');
  const idxCover = findColumn('Dækningsgrad');
  const idxEmpty = findColumn('Arts tom');
  const idxTran = findColumn('Transektundersøgelse');
  const idxKv = findColumn('Kvadrat nummer');
  
  if (idxLatin < 0 || idxCover < 0) {
    throw new Error('Missing required columns: Art latin or Dækningsgrad');
  }
  
  // Process rows
  const rows = [];
  for (const record of records) {
    const values = Object.values(record);
    
    const isEmpty = idxEmpty >= 0 && idxEmpty < values.length 
      ? (values[idxEmpty] || '').trim().toLowerCase() 
      : '';
    
    if (isEmpty === 'ja' || isEmpty === 'yes' || isEmpty === 'true' || isEmpty === '1') {
      continue;
    }
    
    const latin = idxLatin < values.length ? (values[idxLatin] || '').trim() : '';
    const cover = idxCover < values.length ? (values[idxCover] || '').trim() : '';
    const tran = idxTran >= 0 && idxTran < values.length ? (values[idxTran] || '').trim() : '';
    const kv = idxKv >= 0 && idxKv < values.length ? (values[idxKv] || '').trim() : '';
    
    if (!latin && !cover) continue;
    
    rows.push({
      transect: tran,
      quadrat: kv,
      species: latin,
      code: getSpeciesCode(latin),
      coverage: cover
    });
  }
  
  // Group by sheet (for now, all go to "(pasted)" since CSV doesn't have sheets)
  const groups = [{
    sheet: '(pasted)',
    rows: rows
  }];
  
  return {
    groups: groups.map(g => ({
      ...g,
      soapInput: buildSoapInput(g.rows)
    })),
    totalRows: rows.length
  };
}

function buildSoapInput(rows) {
  // Map transect labels to sequential T=1..N
  const transectOrder = new Map();
  let nextT = 1;
  
  // First pass: collect all transect labels
  for (const row of rows) {
    const tLabel = parseInt(row.transect);
    if (!isNaN(tLabel) && !transectOrder.has(tLabel)) {
      transectOrder.set(tLabel, nextT++);
    }
  }
  
  // Build triplets (T, K, ID)
  const triplets = [];
  for (const row of rows) {
    const tLabel = parseInt(row.transect);
    const k = parseInt(row.quadrat);
    
    if (isNaN(tLabel) || isNaN(k) || !row.species) continue;
    
    const t = transectOrder.get(tLabel) || 1;
    const code = row.code || '0';
    triplets.push({ T: t, K: k, ID: code });
  }
  
  // Backfill missing quadrats per transect
  const byT = new Map();
  for (const tr of triplets) {
    if (!byT.has(tr.T)) {
      byT.set(tr.T, new Set());
    }
    byT.get(tr.T).add(tr.K);
  }
  
  for (const [t, presentKs] of byT.entries()) {
    if (presentKs.size === 0) continue;
    const maxK = Math.max(...Array.from(presentKs));
    for (let k = 1; k <= maxK; k++) {
      if (!presentKs.has(k)) {
        triplets.push({ T: t, K: k, ID: '0' });
      }
    }
  }
  
  // Deduplicate
  const seen = new Set();
  const uniqueTriplets = [];
  for (const tr of triplets) {
    const key = `T=${tr.T};K=${tr.K};C=${tr.ID}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueTriplets.push(tr);
    }
  }
  
  // Sort
  uniqueTriplets.sort((a, b) => {
    if (a.T !== b.T) return a.T - b.T;
    if (a.K !== b.K) return a.K - b.K;
    return a.ID.localeCompare(b.ID);
  });
  
  // Build XML
  const items = uniqueTriplets.map(tr => 
    `<Sc1064 T="${tr.T}" K="${tr.K}" ID="${tr.ID}"/>`
  ).join('');
  
  const username = process.env.DVPI_USERNAME || 'sa-feltreg';
  const password = process.env.DVPI_PASSWORD || 'mEGHWppAc+UuFLFiNtq+NQ==';
  
  // Escape XML
  const escapeXml = (str) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };
  
  return `<DVPI_Input UID="${escapeXml(username)}" PW="${escapeXml(password)}">${items}</DVPI_Input>`;
}

async function callDVPI(requestXml) {
  const username = process.env.DVPI_USERNAME || 'sa-feltreg';
  const password = process.env.DVPI_PASSWORD || 'mEGHWppAc+UuFLFiNtq+NQ==';
  
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
<soap:Header/>
<soap:Body>
  <tem:DVPI>
    <tem:DVPI_Input><![CDATA[${requestXml}]]></tem:DVPI_Input>
  </tem:DVPI>
</soap:Body>
</soap:Envelope>`;
  
  const endpoint = 'http://service.dvpi.au.dk/1.0.0/DCE_DVPI.svc';
  
  try {
    const response = await axios.post(endpoint, soapEnvelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://tempuri.org/IDCE_DVPI/DVPI"',
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
      },
      timeout: 30000
    });
    
    return parseDVPIResponse(response.data);
  } catch (error) {
    console.error('DVPI service error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

function parseDVPIResponse(soapResponse) {
  try {
    // Simple regex parsing (more robust than XML parsing for this use case)
    const dvpiMatch = soapResponse.match(/Indeks="([^"]+)"/);
    const dkMatch = soapResponse.match(/DKIndeks="([^"]+)"/);
    const eqrMatch = soapResponse.match(/EQR="([^"]+)"/);
    
    return {
      dvpi: dvpiMatch ? dvpiMatch[1] : '',
      dk: dkMatch ? dkMatch[1] : '',
      eqr: eqrMatch ? eqrMatch[1] : ''
    };
  } catch (error) {
    console.error('Error parsing DVPI response:', error);
    return { dvpi: '', dk: '', eqr: '' };
  }
}

module.exports = {
  parseCSV,
  processData,
  callDVPI,
  loadSpeciesCodes,
  searchSpecies
};
