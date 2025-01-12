import puppeteer from 'puppeteer';
import fs from 'fs';
import pdf from 'pdf-parse';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Path to the LinkedIn PDF
    const pdfPath = './Profile.pdf';

    if (!fs.existsSync(pdfPath)) {
        console.error('File not found:', pdfPath);
        // process.exit(1);
    }

    // Read the PDF file
    const pdfData = fs.readFileSync(pdfPath);

    // Use pdf-parse to extract text
    const data = await pdf(pdfData);

    console.log('Extracted Text from PDF:', data.text);

    // If you want to process the text into JSON
    const lines = data.text.split('\n');
    const experience = [];
    let currentRole = null;

    lines.forEach((line) => {
        if (line.includes('SDE') || line.includes('Intern')) {
            // Detect roles
            currentRole = { Role: line, Company: '', Duration: '', Description: '' };
            experience.push(currentRole);
        } else if (currentRole && line.includes('202')) {
            // Detect durations
            currentRole.Duration = line;
        } else if (currentRole) {
            // Add description
            currentRole.Description += ` ${line}`;
        }
    });

    console.log('Parsed Experience:', JSON.stringify(experience, null, 2));

    await browser.close();
})();
