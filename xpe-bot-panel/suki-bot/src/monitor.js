/**
 * Monitor de Sistema - Métricas y Estado del Bot
 * Supervisa RAM, CPU, Uptime y Estado de Git
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import NodeCache from 'node-cache';

const execAsync = promisify(exec);

class SystemMonitor {
    constructor(panelServer = null) {
        this.panelServer = panelServer;
        this.cache = new NodeCache({ stdTTL: 60 }); // Cache de 1 minuto
        this.updateInterval = null;
    }

    // Obtener uso de memoria RAM
    async getMemoryUsage() {
        const cacheKey = 'memory';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const { stdout } = await execAsync('free -m | grep Mem');
            const parts = stdout.trim().split(/\s+/);
            const total = parseInt(parts[1]);
            const used = parseInt(parts[2]);
            const percentage = ((used / total) * 100).toFixed(1);

            const result = {
                total: `${total}MB`,
                used: `${used}MB`,
                percentage: parseFloat(percentage)
            };

            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            // Fallback para sistemas sin free
            const usage = process.memoryUsage();
            const total = 4096; // Asumir 4GB si no se puede detectar
            const used = Math.round(usage.heapUsed / 1024 / 1024);
            
            return {
                total: `${total}MB`,
                used: `${used}MB`,
                percentage: ((used / total) * 100).toFixed(1)
            };
        }
    }

    // Obtener uptime del sistema
    getUptime() {
        const seconds = process.uptime();
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    // Obtener información del proceso
    getProcessInfo() {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        return {
            pid: process.pid,
            memory: {
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                rss: Math.round(memoryUsage.rss / 1024 / 1024),
                external: Math.round(memoryUsage.external / 1024 / 1024)
            },
            cpu: {
                user: Math.round(cpuUsage.user / 1000000), // segundos
                system: Math.round(cpuUsage.system / 1000000)
            },
            uptime: this.getUptime(),
            nodeVersion: process.version,
            platform: process.platform
        };
    }

    // Verificar estado de Git
    async checkGitStatus() {
        const cacheKey = 'gitStatus';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Verificar si hay cambios locales
            const { stdout: status } = await execAsync('git status --porcelain');
            const hasChanges = status.trim().length > 0;

            // Obtener branch actual
            const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD');
            
            // Obtener última etiqueta (versión)
            const { stdout: latestTag } = await execAsync('git describe --tags --abbrev=0 2>/dev/null || echo "v1.0.0"');

            // Verificar si hay actualizaciones remotas
            const { stdout: fetchResult } = await execAsync('git fetch --dry-run 2>&1');
            const hasRemoteUpdates = fetchResult.includes('would update');

            const result = {
                branch: branch.trim(),
                latestTag: latestTag.trim(),
                hasChanges,
                hasRemoteUpdates,
                modifiedFiles: hasChanges ? status.trim().split('\n').filter(f => f.trim()) : []
            };

            this.cache.set(cacheKey, result, 300); // Cache 5 minutos
            return result;
        } catch (error) {
            return {
                branch: 'unknown',
                latestTag: 'unknown',
                hasChanges: false,
                hasRemoteUpdates: false,
                error: error.message
            };
        }
    }

    // Obtener commits pendientes
    async getPendingCommits(remote = 'origin', branch = 'main') {
        try {
            const { stdout } = await execAsync(`git rev-list HEAD..${remote}/${branch} --count`);
            return parseInt(stdout.trim()) || 0;
        } catch (error) {
            return 0;
        }
    }

    // Obtener métricas completas
    async getFullMetrics() {
        const [memory, processInfo, gitStatus] = await Promise.all([
            this.getMemoryUsage(),
            Promise.resolve(this.getProcessInfo()),
            this.checkGitStatus()
        ]);

        return {
            memory,
            process: processInfo,
            git: gitStatus,
            timestamp: Date.now()
        };
    }

    // Iniciar monitoreo automático
    startAutoMonitor(intervalMs = 10000) {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(async () => {
            const metrics = await this.getFullMetrics();

            if (this.panelServer) {
                this.panelServer.io.emit('metrics:update', metrics);

                // Verificar actualizaciones pendientes
                const pendingCommits = await this.getPendingCommits();
                if (pendingCommits > 0) {
                    this.panelServer.setPendingUpdates(pendingCommits);
                }
            }
        }, intervalMs);

        console.log(`[Monitor] Monitoreo iniciado cada ${intervalMs / 1000}s`);
    }

    // Detener monitoreo
    stopAutoMonitor() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}

export default SystemMonitor;
