import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../src/__tests__/fixtures');

async function createTestPdf() {
    // Create fixtures directory if it doesn't exist
    if (!existsSync(fixturesDir)) {
        mkdirSync(fixturesDir, { recursive: true });
    }

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size

    // Add some text
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 14;

    page.drawText('Document PDF de test', {
        x: 50,
        y: 700,
        size: 24,
        font,
    });

    page.drawText('Ceci est un fichier PDF de test pour verifier', {
        x: 50,
        y: 650,
        size: fontSize,
        font,
    });

    page.drawText('que le traitement des fichiers PDF fonctionne', {
        x: 50,
        y: 630,
        size: fontSize,
        font,
    });

    page.drawText('correctement dans l\'application Spec Refiner.', {
        x: 50,
        y: 610,
        size: fontSize,
        font,
    });

    page.drawText('Section 1: Introduction', {
        x: 50,
        y: 560,
        size: 18,
        font,
    });

    page.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit.', {
        x: 50,
        y: 530,
        size: fontSize,
        font,
    });

    page.drawText('Section 2: Contenu', {
        x: 50,
        y: 480,
        size: 18,
        font,
    });

    page.drawText('Sed do eiusmod tempor incididunt ut labore et dolore.', {
        x: 50,
        y: 450,
        size: fontSize,
        font,
    });

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    const outputPath = join(fixturesDir, 'test.pdf');
    writeFileSync(outputPath, pdfBytes);

    console.log(`Test PDF created at: ${outputPath}`);
}

createTestPdf().catch(console.error);
