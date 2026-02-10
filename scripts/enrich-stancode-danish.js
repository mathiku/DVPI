/**
 * Enriches stancodesimple.csv with a Danish species name column (DanishName)
 * by extracting Latin → Danish mappings from vegetation CSV files that have
 * "Art latin" and "Art" columns (e.g. Vandplanter export).
 */
const fs = require('fs');
const path = require('path');

const INPUT_DIR = path.join(__dirname, '..', 'input');
const STANCODE_FILE = path.join(INPUT_DIR, 'stancodesimple.csv');
const VANDPLANTER_FILE = path.join(INPUT_DIR, 'Vandplanter -  Vandl_b_20260126_075433.csv');

function buildLatinToDanishMap(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return new Map();

  const header = lines[0].split(';');
  const idxLatin = header.findIndex(h => (h || '').trim() === 'Art latin');
  const idxArt = header.findIndex(h => (h || '').trim() === 'Art');
  if (idxLatin < 0 || idxArt < 0) {
    console.warn('Vandplanter CSV: "Art latin" or "Art" column not found');
    return new Map();
  }

  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    const latin = (cols[idxLatin] || '').trim();
    const danish = (cols[idxArt] || '').trim();
    if (latin && danish && !map.has(latin.toLowerCase())) {
      map.set(latin.toLowerCase(), danish);
    }
  }
  return map;
}

function enrichStancode(stancodePath, latinToDanish) {
  const content = fs.readFileSync(stancodePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) return;

  const header = lines[0].split(';');
  const latinIdx = header.findIndex(h => (h || '').trim() === 'LatinName');
  if (latinIdx < 0) {
    throw new Error('stancode CSV: LatinName column not found');
  }

  // Insert "DanskNavn" right after "LatinName"
  const newHeader = [...header];
  newHeader.splice(latinIdx + 1, 0, 'DanskNavn');
  const outLines = [newHeader.join(';')];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    const latin = (cols[latinIdx] || '').trim();
    const danish = latinToDanish.get(latin.toLowerCase()) || '';
    const newCols = [...cols];
    newCols.splice(latinIdx + 1, 0, danish);
    outLines.push(newCols.join(';'));
  }

  fs.writeFileSync(stancodePath, outLines.join('\n'), 'utf-8');
  console.log(`Enriched ${stancodePath}: added DanskNavn, ${latinToDanish.size} Latin→Danish mappings applied.`);
}

// Run
const latinToDanish = buildLatinToDanishMap(VANDPLANTER_FILE);
console.log(`Loaded ${latinToDanish.size} Latin→Danish pairs from ${path.basename(VANDPLANTER_FILE)}`);
enrichStancode(STANCODE_FILE, latinToDanish);
