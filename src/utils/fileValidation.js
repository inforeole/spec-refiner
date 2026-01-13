// Constantes de validation des fichiers
export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
export const MAX_TEXT_CONTENT_SIZE = 200 * 1024 // 200KB de texte extrait
export const MAX_IMAGE_DIMENSION = 1500 // pixels
export const IMAGE_QUALITY = 0.85 // compression JPEG

// Types de fichiers
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
const TEXT_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md']

export function isImageFile(file) {
  return IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/')
}

export function isTextFile(file) {
  const extension = '.' + file.name.split('.').pop().toLowerCase()
  return TEXT_EXTENSIONS.includes(extension)
}

/**
 * Valide la taille d'un fichier
 * @param {File} file
 * @returns {{ valid: boolean, error?: string, sizeFormatted: string }}
 */
export function validateFileSize(file) {
  const sizeInMB = file.size / (1024 * 1024)
  const sizeFormatted = sizeInMB.toFixed(2) + ' MB'

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Le fichier dépasse la limite de 5 MB (${sizeFormatted})`,
      sizeFormatted
    }
  }

  return { valid: true, sizeFormatted }
}

/**
 * Valide le contenu texte extrait
 * @param {string} text
 * @returns {{ valid: boolean, needsTruncation: boolean, sizeFormatted: string }}
 */
export function validateTextContent(text) {
  const textSize = new Blob([text]).size
  const sizeInKB = textSize / 1024
  const sizeFormatted = sizeInKB.toFixed(0) + ' KB'

  if (textSize > MAX_TEXT_CONTENT_SIZE) {
    return {
      valid: true,
      needsTruncation: true,
      sizeFormatted
    }
  }

  return { valid: true, needsTruncation: false, sizeFormatted }
}

/**
 * Estime le nombre de tokens pour un texte
 * @param {number} textLength - Longueur en caractères
 * @returns {number}
 */
export function estimateTokens(textLength) {
  // Approximation : 1 token ≈ 4 caractères en français
  return Math.ceil(textLength / 4)
}

/**
 * Formate une taille en bytes pour l'affichage
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}
