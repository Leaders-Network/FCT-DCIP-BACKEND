/**
 * Policy Number Generator Middleware
 * Generates unique policy numbers for insurance policies
 */

/**
 * Generate a random alphanumeric string
 * @param {number} length - Length of the string to generate
 * @returns {string} - Random alphanumeric string
 */
const generateRandomString = (length = 10) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

/**
 * Generate a formatted policy number
 * Format: Builders-Liability-AMMC-YYYY-XXXXXX (e.g., Builders-Liability-AMMC-2024-ABC123)
 * @returns {string} - Formatted policy number
 */
const generatePolicyNumber = () => {
  const currentYear = new Date().getFullYear();
  const randomPart = generateRandomString(6);
  
  return `Builders-Liability-AMMC-${currentYear}-${randomPart}`;
};

/**
 * Generate a building number
 * Format: BLD-XXXXXX (e.g., BLD-ABC123)
 * @returns {string} - Building number
 */
const generateBuildingNumber = () => {
  const randomPart = generateRandomString(6);
  return `BLD-${randomPart}`;
};

/**
 * Generate assignment reference
 * Format: ASN-YYYYMMDD-XXXX (e.g., ASN-20241004-AB12)
 * @returns {string} - Assignment reference
 */
const generateAssignmentReference = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const randomPart = generateRandomString(4);
  
  return `ASN-${year}${month}${day}-${randomPart}`;
};

/**
 * Generate surveyor license number
 * Format: SRV-XXXX-YYYY (e.g., SRV-AB12-2024)
 * @returns {string} - Surveyor license number
 */
const generateSurveyorLicense = () => {
  const currentYear = new Date().getFullYear();
  const randomPart = generateRandomString(4);
  
  return `SRV-${randomPart}-${currentYear}`;
};

module.exports = {
  generateRandomString,
  generatePolicyNumber,
  generateBuildingNumber,
  generateAssignmentReference,
  generateSurveyorLicense
};