const opentype = require('opentype.js');
const fs = require('fs');
const path = require('path');
const wawoff2 = require('wawoff2');

// Scramble these characters only
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const ALL_CHARS = LOWERCASE + UPPERCASE + DIGITS;

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateCipher() {
  const lowerShuffled = shuffleArray(LOWERCASE.split('')).join('');
  const upperShuffled = shuffleArray(UPPERCASE.split('')).join('');
  const digitsShuffled = shuffleArray(DIGITS.split('')).join('');

  const cipher = {}; // What’s in HTML → What displays
  const decipher = {}; // What you want to display → What to put in HTML

  for (let i = 0; i < LOWERCASE.length; i++) {
    cipher[lowerShuffled[i]] = LOWERCASE[i];
    decipher[LOWERCASE[i]] = lowerShuffled[i];
  }
  for (let i = 0; i < UPPERCASE.length; i++) {
    cipher[upperShuffled[i]] = UPPERCASE[i];
    decipher[UPPERCASE[i]] = upperShuffled[i];
  }
  for (let i = 0; i < DIGITS.length; i++) {
    cipher[digitsShuffled[i]] = DIGITS[i];
    decipher[DIGITS[i]] = digitsShuffled[i];
  }

  return { cipher, decipher };
}

async function scrambleFont(inputPath, outputDir) {
  console.log(`Loading font from: ${inputPath}`);
  
  const font = opentype.loadSync(inputPath);
  console.log(`Font loaded: ${font.names.fontFamily?.en || 'Unknown'}`);
  console.log(`Total glyphs: ${font.glyphs.length}`);

  const { cipher, decipher } = generateCipher();

  // Building a map: unicode code point to glyph object
  const unicodeToGlyph = {};
  for (let i = 0; i < font.glyphs.length; i++) {
    const glyph = font.glyphs.get(i);
    if (glyph.unicode) {
      unicodeToGlyph[glyph.unicode] = glyph;
    }
  }

  // Now swap unicodes according to cipher
  // cipher[htmlChar] = visualChar means: htmlChar should show visualChar’s glyph
  // So the glyph that LOOKS like visualChar should be assigned to htmlChar’s unicode
  
  // First, collect the glyphs we need to modify
  const glyphsToModify = [];
  
  for (const [htmlChar, visualChar] of Object.entries(cipher)) {
    const htmlCode = htmlChar.charCodeAt(0);
    const visualCode = visualChar.charCodeAt(0);
    
    const visualGlyph = unicodeToGlyph[visualCode];
    if (visualGlyph) {
      glyphsToModify.push({
        glyph: visualGlyph,
        newUnicode: htmlCode,
        oldUnicode: visualCode,
        htmlChar,
        visualChar
      });
    }
  }

  // Clear all unicodes for chars we’re remapping first
  for (const { glyph } of glyphsToModify) {
    glyph.unicode = undefined;
    glyph.unicodes = [];
  }

  // Now assign new unicodes
  for (const { glyph, newUnicode, htmlChar, visualChar } of glyphsToModify) {
    glyph.unicode = newUnicode;
    glyph.unicodes = [newUnicode];
  }

  console.log(`Remapped ${glyphsToModify.length} characters`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const baseName = path.basename(inputPath, path.extname(inputPath));
  const scrambledFontName = `${baseName}-scrambled`;

  // Save as OTF
  const otfPath = path.join(outputDir, `${scrambledFontName}.otf`);
  const arrayBuffer = font.toArrayBuffer();
  const fontBuffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(otfPath, fontBuffer);
  console.log(`Saved: ${otfPath}`);

  // Converting to WOFF2
  const woff2Path = path.join(outputDir, `${scrambledFontName}.woff2`);
  try {
    const woff2Buffer = await wawoff2.compress(fontBuffer);
    fs.writeFileSync(woff2Path, woff2Buffer);
    console.log(`Saved: ${woff2Path}`);
  } catch (err) {
    console.log(`WOFF2 conversion failed: ${err.message}`);
  }

  // Save cipher
  const cipherPath = path.join(outputDir, 'cipher.json');
  fs.writeFileSync(cipherPath, JSON.stringify({ cipher, decipher }, null, 2));
  console.log(`Saved: ${cipherPath}`);

  // Encoder utility
  const encoderPath = path.join(outputDir, 'encoder.js');
  const encoderCode = `// Encoder for scrambled font
const decipher = ${JSON.stringify(decipher)};
const cipher = ${JSON.stringify(cipher)};

/**
 * Encode text for the scrambled font
 * @param {string} text - What you want to DISPLAY (e.g., "support@azupin.glass")
 * @returns {string} - What to put in your HTML
 */
function encode(text) {
  return text.split('').map(char => decipher[char] || char).join('');
}

/**
 * Decode scrambled text back to readable
 */
function decode(encoded) {
  return encoded.split('').map(char => cipher[char] || char).join('');
}

const email = "support@azupin.glass";
const encoded = encode(email);
console.log("Display text:", email);
console.log("HTML source:", encoded);
console.log("Verify decode:", decode(encoded));

module.exports = { encode, decode, cipher, decipher };
`;
  fs.writeFileSync(encoderPath, encoderCode);
  console.log(`Saved: ${encoderPath}`);

  const componentPath = path.join(outputDir, 'ScrambledText.tsx');
  const componentCode = `import React from 'react';

const decipher: Record<string, string> = ${JSON.stringify(decipher)};

function encode(text: string): string {
  return text.split('').map(char => decipher[char] || char).join('');
}

interface ScrambledTextProps {
  children: string;
  className?: string;
}

export function ScrambledText({ children, className = '' }: ScrambledTextProps) {
  return (
    <span 
      className={className}
      style={{ fontFamily: "'${scrambledFontName}', sans-serif" }}
    >
      {encode(children)}
    </span>
  );
}
`;
  fs.writeFileSync(componentPath, componentCode);
  console.log(`Saved: ${componentPath}`);

  const cssPath = path.join(outputDir, 'scrambled-font.css');
  const cssCode = `@font-face {
  font-family: '${scrambledFontName}';
  src: url('./${scrambledFontName}.woff2') format('woff2'),
       url('./${scrambledFontName}.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`;
  fs.writeFileSync(cssPath, cssCode);
  console.log(`Saved: ${cssPath}`);

  console.log('\n✅ Done!');
  console.log('\nTest the cipher:');
  const testEmail = "support@foxomy.com";
  const encoded = testEmail.split('').map(c => decipher[c] || c).join('');
  console.log(`  "${testEmail}" → "${encoded}"`);

  return { cipher, decipher };
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: node scramble.js <input-font> [output-dir]');
  process.exit(1);
}

const inputPath = args[0];
const outputDir = args[1] || './output';

if (!fs.existsSync(inputPath)) {
  console.error(`Font not found: ${inputPath}`);
  process.exit(1);
}

scrambleFont(inputPath, outputDir).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});