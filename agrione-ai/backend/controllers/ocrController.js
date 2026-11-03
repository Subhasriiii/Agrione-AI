// OCR controller for soil report extraction
// Uses Tesseract.js for text extraction

exports.extractSoilReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a soil report image or PDF.' });
    }

    const Tesseract = require('tesseract.js');
    const filePath = req.file.path;

    // Run OCR
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
      logger: () => {}, // suppress logs
    });

    // Parse extracted text for soil values
    const extractedValues = parseSoilValues(text);

    res.json({
      success: true,
      rawText: text,
      extractedValues,
      message: 'Values extracted from soil report. Please verify and correct before saving.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'OCR extraction failed. Try a clearer image.' });
  }
};

function parseSoilValues(text) {
  const values = {
    nitrogen: null,
    phosphorus: null,
    potassium: null,
    pH: null,
    moisture: null,
    organicCarbon: null,
  };

  const lines = text.toLowerCase();

  // Extract nitrogen (N)
  const nMatch = lines.match(/(?:nitrogen|n\s*[:\-=])\s*[:\-=]?\s*(\d+\.?\d*)/i);
  if (nMatch) values.nitrogen = parseFloat(nMatch[1]);

  // Extract phosphorus (P)
  const pMatch = lines.match(/(?:phosphorus|phosph|p\s*[:\-=])\s*[:\-=]?\s*(\d+\.?\d*)/i);
  if (pMatch) values.phosphorus = parseFloat(pMatch[1]);

  // Extract potassium (K)
  const kMatch = lines.match(/(?:potassium|potash|k\s*[:\-=])\s*[:\-=]?\s*(\d+\.?\d*)/i);
  if (kMatch) values.potassium = parseFloat(kMatch[1]);

  // Extract pH
  const phMatch = lines.match(/(?:ph|p\.h)\s*[:\-=]?\s*(\d+\.?\d*)/i);
  if (phMatch) values.pH = parseFloat(phMatch[1]);

  // Extract moisture
  const moistMatch = lines.match(/(?:moisture|moist)\s*[:\-=]?\s*(\d+\.?\d*)/i);
  if (moistMatch) values.moisture = parseFloat(moistMatch[1]);

  // Extract organic carbon
  const ocMatch = lines.match(/(?:organic\s*carbon|oc)\s*[:\-=]?\s*(\d+\.?\d*)/i);
  if (ocMatch) values.organicCarbon = parseFloat(ocMatch[1]);

  return values;
}
