const { DEFAULT_WATERMARK_SETTINGS, normalizeWatermarkSettings } = require('./watermarkSettingsService');

function watermarkPositions(width, height, instances) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(instances * (width / Math.max(1, height)))));
  const rows = Math.max(1, Math.ceil(instances / columns));
  return Array.from({ length: instances }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      x: Math.round(((column + 0.5) * width) / columns),
      y: Math.round(((row + 0.5) * height) / rows),
    };
  });
}

function buildWatermarkSvg(width = 960, height = 640, settings = DEFAULT_WATERMARK_SETTINGS) {
  const normalized = normalizeWatermarkSettings(settings);
  const fontSize = Math.max(18, Math.round(Math.min(normalized.height * 0.48, normalized.width / 4.3, 72)));
  const strokeOpacity = Math.min(0.95, Number((normalized.opacity + 0.2).toFixed(2)));
  const positions = watermarkPositions(width, height, normalized.instances);
  const labels = positions.map(({ x, y }) => `
        <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle"
          font-size="${fontSize}" fill="rgba(255,255,255,${normalized.opacity})" stroke="rgba(0,0,0,${strokeOpacity})"
          stroke-width="2" transform="rotate(-35 ${x} ${y})">
          SnapFlow
        </text>`).join('');

  return Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>
          text { font-family: Arial, sans-serif; font-weight: 700; }
        </style>
        <rect width="100%" height="100%" fill="transparent"/>
        ${labels}
      </svg>
    `);
}

function buildImageWatermarkSvg(width = 960, height = 640, assetBuffer, settings = DEFAULT_WATERMARK_SETTINGS) {
  const normalized = normalizeWatermarkSettings(settings);
  const positions = watermarkPositions(width, height, normalized.instances);
  const encodedAsset = assetBuffer.toString('base64');
  const images = positions.map(({ x, y }) => {
    const left = Math.round(x - normalized.width / 2);
    const top = Math.round(y - normalized.height / 2);
    return `
        <image href="data:image/png;base64,${encodedAsset}"
          x="${left}" y="${top}" width="${normalized.width}" height="${normalized.height}"
          opacity="${normalized.opacity}" preserveAspectRatio="xMidYMid meet"
          transform="rotate(-35 ${x} ${y})" />`;
  }).join('');

  return Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="transparent"/>
        ${images}
      </svg>
    `);
}

module.exports = {
  buildImageWatermarkSvg,
  buildWatermarkSvg,
  watermarkPositions,
};
