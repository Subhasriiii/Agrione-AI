// OCR controller for soil report extraction
// Uses Tesseract.js for text extraction

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');

exports.extractSoilReport = async (req, res) => {
  let filePath;
  let processedFilePath;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a soil report image.' });
    }

    const Tesseract = require('tesseract.js');
    filePath = req.file.path;
    const cachePath = path.join(os.homedir(), '.agrione-ai', 'tesseract');
    await fs.mkdir(cachePath, { recursive: true });

    // Preprocess image to improve OCR readability
processedFilePath = path.join(
  os.tmpdir(),
  `agrione-ocr-${crypto.randomUUID()}.png`
);

await sharp(filePath)
  .rotate()
  .resize({ width: 2400 })
  .grayscale()
  .normalize()
  .sharpen()
  .png()
  .toFile(processedFilePath);
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: () => {},
      cachePath,
    });
    let text;
    try {
      await worker.setParameters({ tessedit_pageseg_mode: '11' });
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
    if (processedFilePath) {
  await fs.unlink(processedFilePath).catch((error) => {
    if (error.code !== 'ENOENT') {
      console.error(`Unable to remove processed OCR image: ${error.message}`);
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
    { key: 'pH', label: /\bp\s*\.?\s*h\b/i },
    { key: 'ec', label: /\b(?:electrical\s+conductivity|ec)\b/i },
    { key: 'organicCarbon', label: /\borganic\s+carbon\b/i },
    { key: 'nitrogen', label: /\bnitrogen\b/i },
    { key: 'phosphorus', label: /\bphosphorus\b/i },
    { key: 'potassium', label: /\b(?:potassium|potash)\b/i },
    { key: 'moisture', label: /\bmoisture\b/i },
    { key: 'sulphur', label: /\bsulph?ur\b/i },
    { key: 'zinc', label: /\bzinc\b/i },
    { key: 'boron', label: /\bboron\b/i },
    { key: 'iron', label: /\biron\b/i },
    { key: 'manganese', label: /\bmanganese\b/i },
    { key: 'copper', label: /\bcopper\b/i },
  ];

  const lines = String(text || '')
    .split(/\r?\n/)
    .map(line => line.replace(/[|]/g, ' ').trim())
    .filter(Boolean);

  const isRange = (line) =>
    /[<>]/.test(line) ||
    /\d\s*[-–—]\s*\d/.test(line);

  const getNumber = (line) => {
    if (!line || isRange(line)) return null;

    const match = line.match(
      /^\s*([+-]?\d+(?:[.,]\d+)?)\s*(?:%|kg\/ha|dS\/m)?\s*$/i
    );

    if (!match) return null;

    const number = Number(match[1].replace(',', '.'));
    return Number.isFinite(number) ? number : null;
  };

  for (const field of fields) {
    for (let i = 0; i < lines.length; i++) {
      const match = field.label.exec(lines[i]);

      if (!match) continue;

      // First check for a value after the label on the same line.
      const suffix = lines[i].slice(match.index + match[0].length).trim();

      let value = getNumber(suffix);

      // Otherwise check the next few lines.
      if (value === null) {
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          if (fields.some(other =>
            other.key !== field.key && other.label.test(lines[j])
          )) {
            break;
          }

          value = getNumber(lines[j]);

          if (value !== null) break;
        }
      }

      // Nitrogen may appear immediately before its label in table OCR.
      if (value === null && field.key === 'nitrogen') {
        for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
          value = getNumber(lines[j]);
          if (value !== null) break;
        }
      }

      if (value !== null) {
        values[field.key] = value;
        break;
      }
    }
  }

  return values;
}


exports.parseSoilValues = parseSoilValues;
