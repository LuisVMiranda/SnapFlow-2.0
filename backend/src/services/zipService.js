const fs = require('fs/promises');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[index] = crc >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function localHeader({ crc, nameBuffer, size }) {
  const { dosDate, dosTime } = dosDateTime();
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(dosTime, 10);
  header.writeUInt16LE(dosDate, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  return Buffer.concat([header, nameBuffer]);
}

function centralHeader(entry) {
  const { dosDate, dosTime } = dosDateTime();
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(dosTime, 12);
  header.writeUInt16LE(dosDate, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.size, 20);
  header.writeUInt32LE(entry.size, 24);
  header.writeUInt16LE(entry.nameBuffer.length, 28);
  header.writeUInt32LE(entry.offset, 42);
  return Buffer.concat([header, entry.nameBuffer]);
}

function endRecord({ centralOffset, centralSize, count }) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(count, 8);
  header.writeUInt16LE(count, 10);
  header.writeUInt32LE(centralSize, 12);
  header.writeUInt32LE(centralOffset, 16);
  return header;
}

async function sendStoredZip(res, entries, fileName) {
  res.set({
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Type': 'application/zip',
    'X-Content-Type-Options': 'nosniff',
  });

  let offset = 0;
  const centralEntries = [];
  for (const entry of entries) {
    const data = await fs.readFile(entry.path);
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const crc = crc32(data);
    const size = data.length;
    const header = localHeader({ crc, nameBuffer, size });
    centralEntries.push({ crc, nameBuffer, offset, size });
    res.write(header);
    res.write(data);
    offset += header.length + size;
  }

  const centralOffset = offset;
  const centralBuffers = centralEntries.map(centralHeader);
  const centralSize = centralBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
  for (const buffer of centralBuffers) res.write(buffer);
  res.end(endRecord({ centralOffset, centralSize, count: centralEntries.length }));
}

module.exports = { crc32, sendStoredZip };
