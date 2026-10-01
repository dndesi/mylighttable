// exif.js – Notiz als EXIF UserComment einbetten (nur JPEG)
// v1.0
// Nutzt die global geladene piexifjs-Bibliothek (siehe index.html, CDN).
// Einbettung ist best-effort: schlägt irgendetwas fehl, wird der
// Original-Blob unverändert zurückgegeben — ein Download darf nie an
// diesem Zusatz-Feature scheitern.

const ExifNotiz = (() => {

  // EXIF UserComment nach Spec: 8-Byte-Zeichensatz-Präfix + UTF-16LE-Bytes.
  // Das ist der einzige EXIF-Textweg mit korrektem Unicode-Roundtrip
  // (Umlaute etc.) — ImageDescription ist reines ASCII und wurde im
  // Vorab-Test nachweislich beschädigt.
  function encodeUserComment(str) {
    let out = 'UNICODE\0';
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      out += String.fromCharCode(code & 0xff, (code >> 8) & 0xff);
    }
    return out;
  }

  // piexifjs arbeitet mit "binary strings" (ein Zeichen pro Byte), nicht
  // mit ArrayBuffer/Uint8Array — daher die Konvertierung in beide Richtungen.
  // In Chunks umwandeln, um Performance-/Grenzprobleme bei großen Dateien
  // zu vermeiden (String.fromCharCode.apply mit sehr vielen Argumenten).
  async function blobToBinaryString(blob) {
    const buf   = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return binary;
  }

  function binaryStringToBlob(binaryString, mimeType) {
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  async function embedIfApplicable(blob, mimeType, notiz) {
    if (mimeType !== 'image/jpeg' || !notiz) return blob;
    try {
      const binaryString = await blobToBinaryString(blob);

      let exifObj;
      try {
        exifObj = piexif.load(binaryString);
      } catch {
        exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {}, 'thumbnail': null };
      }
      exifObj['Exif'][piexif.ExifIFD.UserComment] = encodeUserComment(notiz);

      const exifBytes        = piexif.dump(exifObj);
      const newBinaryString  = piexif.insert(exifBytes, binaryString);
      return binaryStringToBlob(newBinaryString, mimeType);
    } catch (e) {
      console.warn('EXIF-Notiz konnte nicht eingebettet werden, Original wird verwendet:', e.message);
      return blob;
    }
  }

  return { embedIfApplicable };
})();
