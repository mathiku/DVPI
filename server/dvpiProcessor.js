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
  
  // Try to find stancode file (foretræk input/stancodesimple.csv)
  const candidates = [
    path.join(__dirname, '..', 'input', 'stancodesimple.csv'),
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
    console.warn('stancode-fil ikke fundet. Artskode-mapping vil være begrænset.');
    speciesCodesLoaded = true;
    return;
  }
  
  const isSimpleFormat = found.endsWith('stancodesimple.csv');
  const delimiter = isSimpleFormat ? ',' : ';';
  
  try {
    let content = fs.readFileSync(found, 'utf-8');
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter,
      bom: true
    });
    
    for (const record of records) {
      if (isSimpleFormat) {
        // stancodesimple.csv: kolonner danish, latin, stancode (små bogstaver; fjern BOM fra første kolonnenavn)
        const raw = record;
        const code = (raw.stancode || '').toString().trim();
        const latin = (raw.latin || raw.LatinName || '').trim();
        let danish = (raw.danish || raw.DanishName || raw['\uFEFFdanish'] || '').trim();
        if (danish === '-') danish = '';
        if (code && latin) {
          latinToCode.set(latin.toLowerCase(), code);
          speciesList.push({ latin, danish, code });
        }
      } else {
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
    }
    
    console.log(`Loaded ${latinToCode.size} species codes from ${found}`);
    speciesCodesLoaded = true;
  } catch (error) {
    console.error('Error loading species codes:', error);
    speciesCodesLoaded = true;
  }
}

/** Returns Danish name for a Latin species name, or '' if not found. */
function getDanishFromLatin(latin) {
  if (!latin || !latin.trim()) return '';
  loadSpeciesCodes();
  const key = latin.trim().toLowerCase();
  const found = speciesList.find(s => s.latin.toLowerCase() === key);
  return found && found.danish ? found.danish : '';
}

/** Returns species matching query (min 3 chars). type=latin: kun LatinName, type=dansk: kun DanishName. */
function searchSpecies(q, type) {
  loadSpeciesCodes();
  const term = (q || '').trim().toLowerCase();
  if (term.length < 3) return [];
  const byLatin = type === 'latin';
  const byDanish = type === 'dansk';
  return speciesList.filter(s => {
    if (byLatin) return s.latin.toLowerCase().includes(term);
    if (byDanish) return (s.danish || '').toLowerCase().includes(term);
    return s.latin.toLowerCase().includes(term) || (s.danish || '').toLowerCase().includes(term);
  }).slice(0, 100);
}

/** Convert raw CSV records to grid-shaped records (Transektundersøgelse, Kvadrat nummer, Art latin, Art dansk, Arts tom) and fill Art dansk from Latin when missing. */
function rawRecordsToGridRecords(records) {
  if (!records || records.length === 0) return [];
  const headers = Object.keys(records[0] || {});
  const findCol = (name) => headers.find(h => h.toLowerCase() === name.toLowerCase());
  const colLatin = findCol('Art latin');
  const colTran = findCol('Transektundersøgelse');
  const colKv = findCol('Kvadrat nummer');
  const colEmpty = findCol('Arts tom');
  const colDanish = findCol('Art dansk') || findCol('Art');
  if (!colLatin) return records.map(r => ({ Transektundersøgelse: '', Kvadrat nummer: '', 'Art latin': '', 'Art dansk': '', Arts tom: '' }));

  const out = [];
  for (const record of records) {
    const val = (key) => (key ? (record[key] || '').trim() : '');
    let latin = val(colLatin);
    let danish = val(colDanish);
    if (latin && !danish) danish = getDanishFromLatin(latin);
    out.push({
      'Transektundersøgelse': val(colTran),
      'Kvadrat nummer': val(colKv),
      'Art latin': latin,
      'Art dansk': danish,
      'Arts tom': val(colEmpty)
    });
  }
  return out;
}

/** Sort grid records by Transektundersøgelse, Kvadrat nummer, Art latin (for display). */
function sortGridRecords(records) {
  if (!records || records.length === 0) return records;
  const num = (v) => {
    const n = parseFloat(String(v).trim());
    return Number.isNaN(n) ? 0 : n;
  };
  return [...records].sort((a, b) => {
    const tA = a['Transektundersøgelse'] ?? '';
    const tB = b['Transektundersøgelse'] ?? '';
    const cmpT = num(tA) - num(tB) || String(tA).localeCompare(String(tB));
    if (cmpT !== 0) return cmpT;
    const kA = a['Kvadrat nummer'] ?? '';
    const kB = b['Kvadrat nummer'] ?? '';
    const cmpK = num(kA) - num(kB) || String(kA).localeCompare(String(kB));
    if (cmpK !== 0) return cmpK;
    const lA = a['Art latin'] ?? '';
    const lB = b['Art latin'] ?? '';
    return lA.localeCompare(lB);
  });
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
  
  if (idxLatin < 0) {
    throw new Error('Missing required column: Art latin (Videnskabeligt navn)');
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
    const cover = idxCover >= 0 && idxCover < values.length ? (values[idxCover] || '').trim() : '';
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
  
  // Build inner XML to match working Postman format: newline after opening tag, each Sc1064 on its own line
  const username = process.env.DVPI_USERNAME || 'sa-feltreg';
  const password = process.env.DVPI_PASSWORD || 'mEGHWppAc+UuFLFiNtq+NQ==';
  const escapeXml = (str) => {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };
  const items = uniqueTriplets
    .map(tr => `<Sc1064 T="${tr.T}" K="${tr.K}" ID="${tr.ID}"/>`)
    .join('\n');
  return `<DVPI_Input UID="${escapeXml(username)}" PW="${escapeXml(password)}">\n${items}\n</DVPI_Input>`;
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
  
  // Log payload sent to API (redact password in logs)
  const payloadForLog = soapEnvelope.replace(/PW="[^"]*"/, 'PW="***REDACTED***"');
  console.log('--- DVPI API request payload ---');
  console.log(payloadForLog);
  console.log('--- end payload ---');
  
  try {
    const response = await axios.post(endpoint, soapEnvelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://tempuri.org/IDCE_DVPI/DVPI"',
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
      },
      timeout: 30000
    });
    
    // Log full response from API
    console.log('--- DVPI API full response ---');
    console.log('Status:', response.status);
    console.log('Data:', response.data);
    console.log('--- end response ---');
    
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
  if (typeof soapResponse !== 'string') {
    return { dvpi: '', dk: '', eqr: '' };
  }
  try {
    // WSDL says response is DVPIResponse.DVPIResult (xs:string). Result may be XML inside that element.
    let toParse = soapResponse;
    const resultMatch = soapResponse.match(/<DVPIResult[^>]*>([\s\S]*?)<\/DVPIResult>/i);
    if (resultMatch && resultMatch[1]) {
      let inner = resultMatch[1];
      if (inner.includes('<![CDATA[')) {
        const cdataMatch = inner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
        if (cdataMatch) inner = cdataMatch[1];
      }
      toParse = inner;
    }
    // Match attribute values (allow various casings and optional namespace)
    const dvpiMatch = toParse.match(/Indeks="([^"]*)"/i);
    const dkMatch = toParse.match(/DKIndeks="([^"]*)"/i);
    const eqrMatch = toParse.match(/EQR="([^"]*)"/i);
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
  searchSpecies,
  rawRecordsToGridRecords,
  sortGridRecords
};
