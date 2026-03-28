import { describe, it, expect } from 'vitest';

// Mock logic for file validation
const SUPPORTED_OCR_TYPES = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];

const validateFileType = (fileType: string, fileName: string) => {
  const isSupported = SUPPORTED_OCR_TYPES.includes(fileType);
  if (!isSupported) {
    const isOffice = fileType.includes("word") || 
                     fileType.includes("excel") || 
                     fileType.includes("officedocument") || 
                     fileName.endsWith(".docx") || 
                     fileName.endsWith(".xlsx");
    return { supported: false, isOffice };
  }
  return { supported: true, isOffice: false };
};

describe('Smart Capture PDF Support Logic', () => {
  describe('File Type Validation', () => {
    it('should accept PDF files', () => {
      const result = validateFileType('application/pdf', 'recibo.pdf');
      expect(result.supported).toBe(true);
    });

    it('should accept JPG/PNG files', () => {
      expect(validateFileType('image/jpeg', 'foto.jpg').supported).toBe(true);
      expect(validateFileType('image/png', 'print.png').supported).toBe(true);
    });

    it('should reject Word files and identify them as Office', () => {
      const result = validateFileType('application/msword', 'documento.docx');
      expect(result.supported).toBe(false);
      expect(result.isOffice).toBe(true);
    });

    it('should reject Excel files and identify them as Office', () => {
      const result = validateFileType('application/vnd.ms-excel', 'planilha.xlsx');
      expect(result.supported).toBe(false);
      expect(result.isOffice).toBe(true);
    });

    it('should reject unknown files and NOT identify them as Office', () => {
      const result = validateFileType('text/plain', 'notas.txt');
      expect(result.supported).toBe(false);
      expect(result.isOffice).toBe(false);
    });
  });
});
