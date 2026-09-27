const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.txt' || ext === '.md') {
    const buffer = fs.readFileSync(filePath);
    // Detección de BOM (UTF-16LE, UTF-16BE, UTF-8)
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return buffer.toString('utf16le');
    }
    if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return buffer.toString('utf16be');
    }
    return buffer.toString('utf8');
  }
  
  if (ext === '.docx') {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }
  
  if (ext === '.pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    try {
      const data = await pdf(dataBuffer);
      if (data && data.text && data.text.trim().length > 30) {
        return data.text;
      }
    } catch (e) {
      console.warn(`[PDF] Error parseando ${path.basename(filePath)}:`, e.message);
    }

    // Si el PDF es una infografía/imagen (ej: Kings of Juda and Israel), revisar si existe transcripción
    const baseName = path.basename(filePath, ext);
    const txtCompanion = path.join(path.dirname(filePath), `${baseName}.txt`);
    if (fs.existsSync(txtCompanion)) {
      return fs.readFileSync(txtCompanion, 'utf8');
    }
    return '';
  }
  
  throw new Error(`Formato de archivo no soportado: ${ext}. Usa .txt, .md, .docx o .pdf`);
}

function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u0000/g, '') // eliminar caracteres nulos
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = {
  extractTextFromFile,
  cleanText
};
