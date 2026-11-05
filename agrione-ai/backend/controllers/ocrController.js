// OCR controller for soil report extraction
// Uses Tesseract.js for text extraction

const fs = require('fs/promises');
const os = require('os');
const path = require('path');

exports.extractSoilReport = async (req, res) => {
  let filePath;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a soil report image.' });
    }

    const Tesseract = require('tesseract.js');
    filePath = req.file.path;
    const cachePath = path.join(os.homedir(), '.agrione-ai', 'tesseract');
    await fs.mkdir(cachePath, { recursive: true });

    const worker = await Tesseract.createWorker('eng', 1, {
      logger: () => {},
      cachePath,
    });
    let text;
    try {
      await worker.setParameters({ tessedit_pageseg_mode: '6' });
      ({ data: { text } } = await worker.recognize(filePath));
    } finally {
      await worker.terminate();
    }

    // Parse extracted text for soil values
    const extractedValues = parseSoilValues(text);

    res.json({
      success: true,
      rawText: text,
      extractedValues,
      message: 'Values extracted from soil report. Please verify and correct before saving.',
    });
  } catch (error) {
    console.error(`OCR extraction failed: ${error.message}`);
    res.status(500).json({ success: false, message: 'OCR extraction failed. Try a clearer image.' });
  } finally {
    if (filePath) {
      await fs.unlink(filePath).catch((error) => {
        if (error.code !== 'ENOENT') {
          console.error(`Unable to remove uploaded soil report: ${error.message}`);
        }
      });
    }
  }
};

function parseSoilValues(text) {
  const values = {
    nitrogen: null,
    phosphorus: null,
    potassium: null,
    pH: null,
    ec: null,
    moisture: null,
    organicCarbon: null,
    sulphur: null,
    zinc: null,
    boron: null,
    iron: null,
    manganese: null,
    copper: null,
    units: {},
  };

  const fields = [
    { key: 'pH', label: /\bp\s*\.?\s*h\b/i, abbreviation: /\bph\b/i },
    { key: 'ec', label: /\b(?:electrical\s+conductivity|ec)\b/i, abbreviation: /\bec\b/i },
    { key: 'organicCarbon', label: /\borganic\s+carbon(?:\s*\(\s*oc\s*\))?/i, abbreviation: /\boc\b/i },
    { key: 'nitrogen', label: /\bnitrog(?:en|em)(?:\s*\(\s*n\s*\))?/i, abbreviation: /\bn\b/i },
    { key: 'phosphorus', label: /\bphosph(?:orus|orous|or)?(?:\s*\(\s*p\s*\))?/i, abbreviation: /\bp\b/i },
    { key: 'potassium', label: /\b(?:potassium|potash)(?:\s*\(\s*k\s*\))?/i, abbreviation: /\bk\b/i },
    { key: 'moisture', label: /\bmoisture\b/i, abbreviation: /\bmoist\b/i },
    { key: 'sulphur', label: /\bsulph?ur(?:\s*\(\s*s\s*\))?/i, abbreviation: /\bs\b/i },
    { key: 'zinc', label: /\bzinc(?:\s*\(\s*zn\s*\))?/i, abbreviation: /\bzn\b/i },
    { key: 'boron', label: /\bboron(?:\s*\(\s*b\s*\))?/i, abbreviation: /\bb\b/i },
    { key: 'iron', label: /\biron(?:\s*\(\s*fe\s*\))?/i, abbreviation: /\bfe\b/i },
    { key: 'manganese', label: /\bmanganese(?:\s*\(\s*mn\s*\))?/i, abbreviation: /\bmn\b/i },
    { key: 'copper', label: /\bcopper(?:\s*\(\s*cu\s*\))?/i, abbreviation: /\bcu\b/i },
  ];

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*\d{1,2}\s*(?=[A-Za-z(])/, '').trim();
    if (!line) continue;

    for (const field of fields) {
      if (values[field.key] !== null) continue;
      const labelMatch = field.label.exec(line) || field.abbreviation.exec(line);
      if (!labelMatch) continue;

      let suffix = line.slice(labelMatch.index + labelMatch[0].length);
      suffix = suffix.replace(/^\s*\([A-Za-z]{1,3}\)/, '');
      suffix = suffix.replace(/^\s*\)\s*/, '');
      const numberMatch = suffix.match(/^\s*[:=|-]?\s*([+-]?(?:\d+(?:[.,]\d+)*|\.\d+))/);
      if (!numberMatch) continue;

      const rawNumber = numberMatch[1];
      const normalizedNumber = rawNumber.includes(',') && !rawNumber.includes('.') && /,\d{1,2}$/.test(rawNumber)
        ? rawNumber.replace(',', '.')
        : rawNumber.replace(/,/g, '');
      const value = Number(normalizedNumber);
      if (!Number.isFinite(value)) continue;

      values[field.key] = value;
      const unitMatch = suffix.slice(numberMatch[0].length).match(/^\s*(%|d\s*s\s*[/'’]?\s*m|k(?:g)?\s*a?\s*[/'’]?\s*h[a]?|ppm|mg\s*[/'’]?\s*kg)/i);
      if (unitMatch) {
        const unit = unitMatch[1].replace(/\s+/g, '');
        values.units[field.key] = /^ds/i.test(unit) ? 'dS/m' : /^k/i.test(unit) ? 'kg/ha' : unit;
      }
    }
  }

  return values;
}

exports.parseSoilValues = parseSoilValues;
