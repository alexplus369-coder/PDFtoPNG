// Synthetic pages and stored RAR fixtures, generated in memory without WinRAR.
// RAR5 field definitions: https://www.rarlab.com/technote.htm
const zlib = require('node:zlib');

const crcTable = Array.from({ length: 256 }, (_, value) => {
    for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
});
function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}
function uint32(value, bigEndian = false) {
    const bytes = Buffer.alloc(4);
    if (bigEndian) bytes.writeUInt32BE(value);
    else bytes.writeUInt32LE(value);
    return bytes;
}
function png(width, height, color) {
    const chunk = (name, data) => {
        const bytes = Buffer.concat([Buffer.from(name), data]);
        return Buffer.concat([uint32(data.length, true), bytes, uint32(crc32(bytes), true)]);
    };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 2;
    const pixels = Buffer.alloc((width * 3 + 1) * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            for (let c = 0; c < 3; c++) pixels[y * (width * 3 + 1) + 1 + x * 3 + c] = color[c];
        }
    }
    return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
function entries() {
    return [
        { name: 'pages/10.png', bytes: png(240, 120, [0, 180, 0]) },
        { name: 'pages/2.png', bytes: png(120, 180, [0, 0, 180]) },
        { name: 'pages/1.PNG', bytes: png(120, 180, [180, 0, 0]) },
        { name: '__MACOSX/pages/._1.PNG', bytes: Buffer.from('ignored') },
        { name: 'ComicInfo.xml', bytes: Buffer.from('<ComicInfo/>') }
    ];
}
function rar4(items = entries()) {
    function block(type, flags, content) {
        const header = Buffer.alloc(7);
        header[2] = type;
        header.writeUInt16LE(flags, 3);
        header.writeUInt16LE(7 + content.length, 5);
        const bytes = Buffer.concat([header, content]);
        bytes.writeUInt16LE(crc32(bytes.subarray(2)) & 0xffff);
        return bytes;
    }
    const blocks = [Buffer.from('526172211a0700', 'hex'), block(0x73, 0, Buffer.alloc(6))];
    for (const item of items) {
        const name = Buffer.from(item.name);
        const fields = Buffer.alloc(25);
        fields.writeUInt32LE(item.bytes.length);
        fields.writeUInt32LE(item.bytes.length, 4);
        fields[8] = 3;
        fields.writeUInt32LE(crc32(item.bytes), 9);
        fields[17] = 20;
        fields[18] = 0x30;
        fields.writeUInt16LE(name.length, 19);
        fields.writeUInt32LE(0o100644, 21);
        blocks.push(block(0x74, 0x8000, Buffer.concat([fields, name])), item.bytes);
    }
    blocks.push(block(0x7b, 0, Buffer.alloc(0)));
    return Buffer.concat(blocks);
}
function vint(value) {
    const bytes = [];
    do { bytes.push((value & 0x7f) | (value > 0x7f ? 0x80 : 0)); value = Math.floor(value / 128); } while (value);
    return Buffer.from(bytes);
}
function rar5(items = entries()) {
    const block = data => {
        const header = Buffer.concat([vint(data.length), data]);
        return Buffer.concat([uint32(crc32(header)), header]);
    };
    const blocks = [Buffer.from('526172211a070100', 'hex'), block(Buffer.from([1, 0, 0]))];
    for (const item of items) {
        const name = Buffer.from(item.name);
        const header = Buffer.concat([
            vint(2), vint(2), vint(item.bytes.length), vint(4), vint(item.bytes.length), vint(0o100644),
            uint32(crc32(item.bytes)), vint(0), vint(1), vint(name.length), name
        ]);
        blocks.push(block(header), item.bytes);
    }
    blocks.push(block(Buffer.from([5, 0, 0])));
    return Buffer.concat(blocks);
}
module.exports = { png, entries, rar4, rar5 };
