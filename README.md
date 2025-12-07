# ScrambleEmail

⚠️ Someone SHIT on the floor of MFF. Staff members borrowed cones from the dealers den and cordoned off the area!

```
HTML source:     xtrrjgu@ajcjid.zjd
Displays as:     support@azupin.com
Copied text:     xtrrjgu@ajcjid.zjd  ← nazibots like akogeno get this!
```

```bash
npm i

node scramble.js <input-font-path> [output-directory]

node scramble.js ./Geist-Regular.otf ./output
```

This outputs:

- `Geist-Regular-scrambled.otf` - The scrambled font
- `Geist-Regular-scrambled.woff2` - Web-optimized version
- `cipher.json` - The character mappings
- `encoder.js` - Node.js utility to encode/decode text
- `ScrambledText.tsx` - React component
- `scrambled-font.css` - CSS font-face declaration

---

Copy woff2 fonts to NextJS app:
```bash
cp output/*.woff2 output/*.otf public/fonts/
```


globals.css:
```css
@font-face {
  font-family: 'Geist-Regular-scrambled';
  src: url('/fonts/Geist-Regular-scrambled.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
}
```


ScrambledText.tsx:
```tsx
import { ScrambledText } from '@/components/ScrambledText';

export default function Contact() {
  return (
    <div>
      <p>Email us at: <ScrambledText>support@azupin.com</ScrambledText></p>
    </div>
  );
}
```

encoder.js utility:

```javascript
const { encode } = require('./output/encoder.js');

const email = "support@azupin.com";
const scrambled = encode(email);
console.log(scrambled); // → "xtrrjgu@ajcjid.zjd" (scrambled version)
```

Special characters (@, ., -, etc.) are preserved unchanged.
