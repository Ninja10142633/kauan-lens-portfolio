/**
 * Converte um texto em uma URL amigável (Slug)
 */
export function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // Decompõe caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos (acentos)
    .replace(/[^a-z0-9 -]/g, '') // Remove caracteres inválidos
    .replace(/\s+/g, '-') // Substitui espaços por -
    .replace(/-+/g, '-'); // Agrupa múltiplos -
}

/**
 * Escapa strings contra injeção de HTML
 */
export function escapeHtml(text) {
  return String(text || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

/**
 * Formata data de formato AAAA-MM-DD para DD/MM/AAAA
 */
export function formatDate(date) {
  if (!date) return 'Sem data';
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Redimensiona e comprime uma imagem usando HTML5 Canvas
 */
function resizeImageCanvas(img, maxDim, quality) {
  const canvas = document.createElement('canvas');
  let width = img.width;
  let height = img.height;

  if (width > height) {
    if (width > maxDim) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    }
  } else {
    if (height > maxDim) {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  return {
    src: canvas.toDataURL('image/jpeg', quality),
    w: width,
    h: height
  };
}

/**
 * Gera os 3 tiers de resolução necessários para cada arquivo de imagem carregado
 */
export function generateImageTiers(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        try {
          // Geração dos 3 formatos de imagem
          const original = resizeImageCanvas(img, 2048, 0.85); // Resolução alta original
          const optimized = resizeImageCanvas(img, 1200, 0.75); // Resolução otimizada para visualização geral
          const thumbnail = resizeImageCanvas(img, 400, 0.65);  // Resolução miniatura para grid rápido

          resolve({
            name: file.name.replace(/\.[^.]+$/, ''),
            w: img.width,
            h: img.height,
            original,
            optimized,
            thumbnail
          });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
