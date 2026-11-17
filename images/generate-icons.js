const sharp = require('sharp');
const fs = require('fs');

fs.mkdirSync('build/appx', { recursive: true });

const sizes = [
  { name: 'StoreLogo.png', w: 50, h: 50 },
  { name: 'Square44x44Logo.png', w: 44, h: 44 },
  { name: 'Square150x150Logo.png', w: 150, h: 150 },
  { name: 'Wide310x150Logo.png', w: 310, h: 150 }
];

sizes.forEach(({ name, w, h }) => {
  sharp('logo.png')
    .resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(`build/appx/${name}`);
});
