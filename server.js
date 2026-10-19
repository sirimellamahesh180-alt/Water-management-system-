const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 4400;

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const BILLS_FILE = path.join(DATA_DIR, 'bills.json');
const OUTPUT_DIR = path.join(__dirname, 'generated_pdfs');

// Ensure directories exist
[DATA_DIR, OUTPUT_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// JSON Helpers
const readJSON = (filePath, defaultData = []) => {
    if (!fs.existsSync(filePath)) return defaultData;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        return defaultData;
    }
};

const writeJSON = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

// MIME Types for Static Files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.pdf': 'application/pdf'
};

// Create Server
const server = http.createServer((req, res) => {
    // Enable CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // --- API ROUTES ---

    // GET /api/bills
    if (pathname === '/api/bills' && req.method === 'GET') {
        const bills = readJSON(BILLS_FILE, []);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, count: bills.length, data: bills }));
    }

    // POST /api/bills
    if (pathname === '/api/bills' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { name, phone, prev, curr, rate } = data;

                if (!name || !phone || curr === undefined || prev === undefined) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, message: 'Invalid payload' }));
                }

                const litres = curr - prev;
                if (litres < 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, message: 'Current reading must be greater' }));
                }

                const ratePerLitre = parseFloat(rate) || 0.015;
                const total = litres * ratePerLitre;
                const billId = `WM-${Math.floor(1000 + Math.random() * 9000)}`;
                const billDate = new Date().toISOString().split('T')[0];

                const newBill = { id: billId, name, phone, prev, curr, litres, rate: ratePerLitre, total, date: billDate };

                const bills = readJSON(BILLS_FILE, []);
                bills.unshift(newBill);
                writeJSON(BILLS_FILE, bills);

                // Optional PDF call
                spawn('python', [path.join(__dirname, 'bill_generate.py'), JSON.stringify(newBill)]);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, message: 'Bill saved!', pdfUrl: `/download-pdf/${billId}`, data: newBill }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, message: err.message }));
            }
        });
        return;
    }

    // DELETE /api/bills/:id
    if (pathname.startsWith('/api/bills/') && req.method === 'DELETE') {
        const id = pathname.split('/')[3];
        let bills = readJSON(BILLS_FILE, []);
        const filtered = bills.filter(b => b.id !== id);
        writeJSON(BILLS_FILE, filtered);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: 'Bill deleted' }));
    }

    // GET /download-pdf/:id
    if (pathname.startsWith('/download-pdf/') && req.method === 'GET') {
        const billId = pathname.split('/')[2];
        const pdfPath = path.join(OUTPUT_DIR, `Bill_${billId}.pdf`);
        if (fs.existsSync(pdfPath)) {
            res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=Bill_${billId}.pdf` });
            return fs.createReadStream(pdfPath).pipe(res);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('PDF Not Found');
        }
    }

    // --- STATIC FILE SERVING (Serves water.html at http://localhost:4400) ---
    let filePath = path.join(__dirname, pathname === '/' ? 'water.html' : pathname);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Listen on Port 4400
server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` Water Management System Running Natively!`);
    console.log(` Open URL: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
