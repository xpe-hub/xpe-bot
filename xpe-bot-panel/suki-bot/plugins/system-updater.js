/**
 * Sistema de Actualizaciones y Notificaciones
 * Detecta actualizaciones y notifica automáticamente al grupo de owners
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import NodeCache from 'node-cache';

const execAsync = promisify(exec);

class SystemUpdater {
    constructor(conn, panelServer, ownerGroupId) {
        this.conn = conn;
        this.panelServer = panelServer;
        this.ownerGroupId = ownerGroupId;
        this.cache = new NodeCache({ stdTTL: 3600 }); // 1 hora de cache
        this.lastNotifiedVersion = null;
        this.updateCheckInterval = null;
    }

    /**
     * Iniciar el sistema de verificación de actualizaciones
     */
    start(updateIntervalMinutes = 30) {
        console.log(`[Updater] Sistema iniciado. Verificando cada ${updateIntervalMinutes} minutos`);

        // Verificación inicial
        this.checkForUpdates();

        // Verificación periódica
        this.updateCheckInterval = setInterval(() => {
            this.checkForUpdates();
        }, updateIntervalMinutes * 60 * 1000);
    }

    /**
     * Detener el sistema de verificación
     */
    stop() {
        if (this.updateCheckInterval) {
            clearInterval(this.updateCheckInterval);
            this.updateCheckInterval = null;
        }
    }

    /**
     * Verificar si hay actualizaciones disponibles
     */
    async checkForUpdates() {
        try {
            // Obtener commits remotos
            await execAsync('git fetch origin main');
            const { stdout: remoteCommit } = await execAsync('git rev-parse origin/main');
            const { stdout: localCommit } = await execAsync('git rev-parse HEAD');

            const hasUpdates = remoteCommit.trim() !== localCommit.trim();

            if (hasUpdates) {
                const commits = await this.getCommitLog();
                await this.notifyOwners(commits);

                if (this.panelServer) {
                    this.panelServer.setPendingUpdates(commits.length);
                }
            }

            return hasUpdates;
        } catch (error) {
            console.error('[Updater] Error verificando actualizaciones:', error.message);
            return false;
        }
    }

    /**
     * Obtener lista de commits pendientes
     */
    async getCommitLog() {
        try {
            const { stdout } = await execAsync(
                'git log HEAD..origin/main --oneline --pretty=format:"%h|%s|%an|%ad" --date=short -20'
            );

            if (!stdout.trim()) return [];

            return stdout.trim().split('\n').map(line => {
                const [hash, subject, author, date] = line.split('|');
                return { hash, subject, author, date };
            });
        } catch (error) {
            return [];
        }
    }

    /**
     * Notificar al grupo de owners sobre actualizaciones
     */
    async notifyOwners(commits) {
        if (!this.ownerGroupId) {
            console.log('[Updater] No hay ID de grupo de owners configurado');
            return;
        }

        if (commits.length === 0) return;

        // Evitar notificaciones duplicadas
        const latestCommit = commits[0].hash;
        if (this.lastNotifiedVersion === latestCommit) {
            return;
        }
        this.lastNotifiedVersion = latestCommit;

        try {
            let message = `╔══════════════════════════════════════╗\n`;
            message += `║     ⚠️  XPE SYSTEM ALERT  ⚠️        ║\n`;
            message += `╚══════════════════════════════════════╝\n\n`;
            message += `🔄 *Se ha detectado una actualización*\n`;
            message += `📊 *Commits pendientes:* ${commits.length}\n\n`;
            message += `*📝 Cambios recientes:*\n`;

            commits.slice(0, 5).forEach((commit, index) => {
                message += `\n${index + 1}. ${commit.subject}`;
                message += `\n   └─ 👤 ${commit.author} | 📅 ${commit.date}`;
            });

            if (commits.length > 5) {
                message += `\n\n...y ${commits.length - 5} cambios más`;
            }

            message += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            message += `🛠️ Para actualizar el sistema:\n`;
            message += `• Usa el Panel de Control XPE\n`;
            message += `• O ejecuta: bash update.sh\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

            await this.conn.sendMessage(this.ownerGroupId, { text: message });

            console.log(`[Updater] Notificación enviada al grupo de owners`);
        } catch (error) {
            console.error('[Updater] Error enviando notificación:', error.message);
        }
    }

    /**
     * Enviar mensaje personalizado al grupo de owners
     */
    async sendOwnerMessage(text, isUrgent = false) {
        if (!this.ownerGroupId) return false;

        try {
            const prefix = isUrgent ? `🚨 *URGENTE* 🚨\n\n` : '';
            const footer = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✦ Enviado desde XPE Panel`;

            await this.conn.sendMessage(this.ownerGroupId, {
                text: prefix + text + footer
            });

            return true;
        } catch (error) {
            console.error('[Updater] Error enviando mensaje:', error.message);
            return false;
        }
    }

    /**
     * Ejecutar actualización manualmente
     */
    async performUpdate() {
        try {
            await this.sendOwnerMessage('🔄 *Iniciando actualización del sistema...*\nPor favor espera mientras se aplican los cambios.');

            // Notificar inicio
            if (this.panelServer) {
                this.panelServer.io.emit('update:started', { 
                    message: 'Actualizando sistema...' 
                });
            }

            // Ejecutar script de actualización
            const { stdout, stderr } = await execAsync('bash update.sh');

            // Notificar finalización exitosa
            await this.sendOwnerMessage('✅ *Sistema actualizado correctamente*\nEl bot se reiniciará automáticamente.');

            if (this.panelServer) {
                this.panelServer.io.emit('update:completed', {
                    message: 'Actualización completada',
                    output: stdout + stderr
                });
            }

            return true;
        } catch (error) {
            const errorMsg = `❌ *Error en la actualización*\n\nDetalles: ${error.message}`;
            await this.sendOwnerMessage(errorMsg, true);

            if (this.panelServer) {
                this.panelServer.io.emit('update:error', {
                    message: 'Error en actualización',
                    error: error.message
                });
            }

            return false;
        }
    }

    /**
     * Obtener estado del sistema de actualizaciones
     */
    getStatus() {
        return {
            lastCheck: this.cache.get('lastCheck') || null,
            pendingCommits: this.cache.get('pendingCommits') || 0,
            lastNotifiedCommit: this.lastNotifiedVersion,
            isRunning: this.updateCheckInterval !== null
        };
    }
}

export default SystemUpdater;
