const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');

const server = express();
const PORT = 3000;

const DB_PATH = path.join(app.getPath('userData'), 'banco');
if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });

server.use(cors());
server.use(express.json());
server.use(express.static(__dirname));

// --- 1. ROTA DE IMPRESSÃO (DEVE VIR ANTES DA GENÉRICA) ---
server.post('/api/print', (req, res) => {
    const { html } = req.body;
    console.log("=========================================");
    console.log("LOG: COMANDO DE IMPRESSÃO RECEBIDO NA API!");
    console.log("=========================================");

    let winPrint = new BrowserWindow({ show: false });
    winPrint.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    winPrint.webContents.on('did-finish-load', () => {
        winPrint.webContents.print({
            silent: true, // TRUE para sua impressora real física
            printBackground: true,
            deviceName: '' // Vazio = Impressora Padrão
        }, (success, errorType) => {
            console.log("Resultado no Windows:", success ? "SUCESSO" : "FALHA: " + errorType);
            winPrint.close();
        });
    });
    res.json({ status: "Imprimindo..." });
});

// --- 2. ROTAS ESPECÍFICAS ---
server.get('/api/get-server-ip', (req, res) => {
    const interfaces = os.networkInterfaces();
    let ip = 'localhost';
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
                ip = iface.address;
                if (ip.startsWith('192.168.')) break;
            }
        }
    }
    res.json({ ip });
});

server.get('/ping', (req, res) => res.send("PONG"));

// --- 3. ROTAS GENÉRICAS (DEVE VIR POR ÚLTIMO) ---
server.get('/api/:tabela', (req, res) => {
    const file = path.join(DB_PATH, `${req.params.tabela}.json`);
    if (!fs.existsSync(file)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(file, 'utf8') || '[]'));
});

server.post('/api/:tabela', (req, res) => {
    const file = path.join(DB_PATH, `${req.params.tabela}.json`);
    fs.writeFileSync(file, JSON.stringify(req.body, null, 2));
    res.send({ status: 'ok' });
});

app.whenReady().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log("=========================================");
        console.log(`SERVIDOR TRAYOFREE ONLINE NA PORTA ${PORT}`);
        console.log("=========================================");
    });

    const win = new BrowserWindow({
        width: 1250, height: 850,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    win.loadFile('welcome.html');
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });