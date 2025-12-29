import { default as makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BotEngine {
    constructor() {
        this.sock = null;
        this.authFolder = path.join(__dirname, '..', 'auth_info_baileys');
        this.callbacks = {};
    }

    async start() {
        if (this.sock) return;

        if (!fs.existsSync(this.authFolder)) {
            fs.mkdirSync(this.authFolder, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
        const { version } = await fetchLatestBaileysVersion();

        this.sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ['XPE-BOT', 'Chrome', '1.0.0']
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && this.callbacks.onQR) {
                this.callbacks.onQR(qr);
            }

            if (connection === 'open' && this.callbacks.onStatus) {
                this.callbacks.onStatus('connected', 'Bot conectado a WhatsApp');
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect && this.callbacks.onStatus) {
                    this.callbacks.onStatus('connecting', 'Reconectando...');
                    this.start();
                } else if (this.callbacks.onStatus) {
                    this.callbacks.onStatus('disconnected', 'Desconectado');
                }
            }
        });

        this.sock.ev.on('messages.upsert', (m) => {
            if (m.messages.length > 0 && this.callbacks.onMessage) {
                const msg = m.messages[0];
                if (!msg.key.fromMe) {
                    this.callbacks.onMessage(msg);
                }
            }
        });
    }

    stop() {
        if (this.sock) {
            this.sock.end();
            this.sock = null;
        }
    }

    logout() {
        this.stop();
        if (fs.existsSync(this.authFolder)) {
            fs.rmSync(this.authFolder, { recursive: true, force: true });
        }
    }

    async sendMessage(jid, text) {
        if (!this.sock) throw new Error('Bot no conectado');
        await this.sock.sendMessage(jid, { text });
    }

    getStatus() {
        if (!this.sock) return 'disconnected';
        return 'connected';
    }

    on(event, callback) {
        this.callbacks[event] = callback;
    }
}

export default new BotEngine();
