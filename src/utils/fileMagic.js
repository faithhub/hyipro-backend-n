const fs = require('fs');

const SIGNATURES = {
  jpeg: { bytes: [0xFF, 0xD8, 0xFF], offset: 0 },
  png:  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0 },
  gif:  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0 },
  webp: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
};

function readBytes(filePath, count) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(count);
  fs.readSync(fd, buf, 0, count, 0);
  fs.closeSync(fd);
  return buf;
}

function matchesSig(buf, sig) {
  const { bytes, offset } = sig;
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function detectType(filePath) {
  try {
    const buf = readBytes(filePath, 16);
    if (matchesSig(buf, SIGNATURES.jpeg)) return 'jpeg';
    if (matchesSig(buf, SIGNATURES.png))  return 'png';
    if (matchesSig(buf, SIGNATURES.gif))  return 'gif';
    if (matchesSig(buf, SIGNATURES.webp)) return 'webp';
    return null;
  } catch {
    return null;
  }
}

function validateImageFile(filePath, allowed = ['jpeg', 'png', 'gif', 'webp']) {
  const type = detectType(filePath);
  return type !== null && allowed.includes(type);
}

module.exports = { detectType, validateImageFile };
