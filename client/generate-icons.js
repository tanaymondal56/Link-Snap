import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const svgPath = join(__dirname, 'public', 'favicon.svg');
const svg = readFileSync(svgPath);

const sizes = [
    { name: 'pwa-192x192.png', size: 192 },
    { name: 'pwa-512x512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-16x16.png', size: 16 },
];

async function generateIcons() {
    console.log('Generating PWA icons...');

    for (const { name, size } of sizes) {
        const outputPath = join(__dirname, 'public', name);
        await sharp(svg)
            .resize(size, size)
            .png()
            .toFile(outputPath);
        console.log(`✓ Generated ${name} (${size}x${size})`);
    }

    console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
