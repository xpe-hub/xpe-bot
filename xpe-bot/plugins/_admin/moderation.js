/**
 * XPE Bot - Plugin de Anti-Link y Moderación
 * Detecta y elimina enlaces no deseados en grupos
 */

import { isGroup, extractNumber } from '../src/lib/utils.js';

export default function antiLinkPlugin(registerCommand) {
    // ========================================
    // Comando: antilink
    // Activar/desactivar detector de enlaces
    // ========================================
    registerCommand(
        'antilink',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!isGroup(chatJid)) {
                await sock.sendMessage(chatJid, {
                    text: '❌ *Este comando solo funciona en grupos.*',
                    contextInfo: { mentionedJid: [senderJid] }
                });
                return;
            }

            const action = args[0]?.toLowerCase();

            if (!action || action === 'info') {
                await sock.sendMessage(chatJid, {
                    text: `🔒 *Anti-Link Configuration*\n\n
Usage:
• !antilink on - Activar detector
• !antilink off - Desactivar
• !antilink warn - Advertir solo
• !antilink delete - Eliminar mensaje

🛡️ *Nota:* Solo administradores pueden configurar.`
                });
                return;
            }

            // Verificar permisos de admin
            try {
                const groupMetadata = await sock.groupMetadata(chatJid);
                const senderIsAdmin = groupMetadata.participants.some(
                    p => p.id === senderJid && p.admin
                );

                if (!senderIsAdmin) {
                    await sock.sendMessage(chatJid, {
                        text: '🛡️ *Solo administradores pueden configurar anti-link.*'
                    });
                    return;
                }

                switch (action) {
                    case 'on':
                        await sock.sendMessage(chatJid, {
                            text: '✅ *Anti-Link activado*\n\nLos enlaces serán eliminados y los usuarios expulsados.',
                            contextInfo: { mentionedJid: [senderJid] }
                        });
                        break;

                    case 'off':
                        await sock.sendMessage(chatJid, {
                            text: '❌ *Anti-Link desactivado*',
                            contextInfo: { mentionedJid: [senderJid] }
                        });
                        break;

                    case 'warn':
                        await sock.sendMessage(chatJid, {
                            text: '⚠️ *Anti-Link en modo advertencia*\n\nLos enlaces se advertirán pero no se eliminarán.',
                            contextInfo: { mentionedJid: [senderJid] }
                        });
                        break;

                    case 'delete':
                        await sock.sendMessage(chatJid, {
                            text: '🗑️ *Anti-Link en modo eliminar*\n\nLos enlaces serán eliminados sin expulsión.',
                            contextInfo: { mentionedJid: [senderJid] }
                        });
                        break;

                    default:
                        await sock.sendMessage(chatJid, {
                            text: '❌ *Opción no reconocida.* Usa: on, off, warn, delete'
                        });
                }

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`
                });
            }
        },
        {
            description: 'Configurar detector de enlaces',
            category: 'Administración',
            usage: '!antilink [on/off/warn/delete]',
            adminOnly: true,
            groupOnly: true,
            aliases: ['antilinks', 'noenlaces']
        }
    );

    // ========================================
    // Comando: warn
    // Advertir a un usuario
    // ========================================
    registerCommand(
        'warn',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!isGroup(chatJid)) {
                await sock.sendMessage(chatJid, {
                    text: '❌ *Este comando solo funciona en grupos.*',
                    contextInfo: { mentionedJid: [senderJid] }
                });
                return;
            }

            try {
                const groupMetadata = await sock.groupMetadata(chatJid);
                const senderIsAdmin = groupMetadata.participants.some(
                    p => p.id === senderJid && p.admin
                );

                if (!senderIsAdmin) {
                    await sock.sendMessage(chatJid, {
                        text: '🛡️ *Solo administradores pueden advertir.*'
                    });
                    return;
                }

                let userJid = args[0];
                let reason = args.slice(1).join(' ') || 'Sin razón específica';

                // Si es respuesta a un mensaje
                if (message.message?.extendedTextMessage?.contextInfo?.participant) {
                    userJid = message.message.extendedTextMessage.contextInfo.participant;
                }

                if (!userJid) {
                    await sock.sendMessage(chatJid, {
                        text: '⚠️ *Usage:* !warn @usuario [razón]',
                        contextInfo: { mentionedJid: [senderJid] }
                    });
                    return;
                }

                if (!userJid.includes('@')) {
                    userJid = `${userJid}@s.whatsapp.net`;
                }

                // Verificar que no sea admin
                const userIsAdmin = groupMetadata.participants.some(
                    p => p.id === userJid && p.admin
                );

                if (userIsAdmin) {
                    await sock.sendMessage(chatJid, {
                        text: '❌ *No puedes advertir a un administrador.*'
                    });
                    return;
                }

                const userNumber = userJid.split('@')[0];
                const warningNumber = 3; // 3 advertencias = expulsión

                await sock.sendMessage(chatJid, {
                    text: `⚠️ *ADVERTENCIA* ⚠️\n\n
👤 *Usuario:* @${userNumber}
📝 *Razón:* ${reason}
⚠️ *Advertencias:* 1/${warningNumber}

🚫 *(${warningNumber}) advertencias resultarán en expulsión.*`,

                    contextInfo: { mentionedJid: [userJid] }
                });

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`
                });
            }
        },
        {
            description: 'Advertir a un usuario',
            category: 'Administración',
            usage: '!warn @usuario [razón]',
            adminOnly: true,
            groupOnly: true,
            aliases: ['advertir', 'aviso']
        }
    );

    // ========================================
    // Comando: resetwarn
    // Resetear advertencias de un usuario
    // ========================================
    registerCommand(
        'resetwarn',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!isGroup(chatJid)) return;

            try {
                const groupMetadata = await sock.groupMetadata(chatJid);
                const senderIsAdmin = groupMetadata.participants.some(
                    p => p.id === senderJid && p.admin
                );

                if (!senderIsAdmin) return;

                let userJid = args[0];
                if (message.message?.extendedTextMessage?.contextInfo?.participant) {
                    userJid = message.message.extendedTextMessage.contextInfo.participant;
                }

                if (!userJid) {
                    await sock.sendMessage(chatJid, {
                        text: '🔄 *Usage:* !resetwarn @usuario'
                    });
                    return;
                }

                const userNumber = userJid.split('@')[0];
                await sock.sendMessage(chatJid, {
                    text: `✅ *Advertencias reseteadas*\n\n@${userNumber} ya no tiene advertencias.`,
                    contextInfo: { mentionedJid: [userJid] }
                });

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`
                });
            }
        },
        {
            description: 'Resetear advertencias de un usuario',
            category: 'Administración',
            usage: '!resetwarn @usuario',
            adminOnly: true,
            groupOnly: true,
            aliases: ['clearwarn', 'quitarwarn']
        }
    );

    // ========================================
    // Comando: blacklist
    // Añadir usuario a lista negra
    // ========================================
    registerCommand(
        'blacklist',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!isGroup(chatJid)) return;

            try {
                const groupMetadata = await sock.groupMetadata(chatJid);
                const senderIsAdmin = groupMetadata.participants.some(
                    p => p.id === senderJid && p.admin
                );

                if (!senderIsAdmin) return;

                let userJid = args[0];
                if (message.message?.extendedTextMessage?.contextInfo?.participant) {
                    userJid = message.message.extendedTextMessage.contextInfo.participant;
                }

                if (!userJid) {
                    await sock.sendMessage(chatJid, {
                        text: '🚫 *Usage:* !blacklist @usuario'
                    });
                    return;
                }

                const userNumber = userJid.split('@')[0];

                await sock.sendMessage(chatJid, {
                    text: `🚫 *Usuario bloqueado* 🚫\n\n@${userNumber} ha sido añadido a la lista negra del grupo.\nNo podrá unirse nuevamente.`,

                    contextInfo: { mentionedJid: [userJid] }
                });

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`
                });
            }
        },
        {
            description: 'Bloquear usuario del grupo',
            category: 'Administración',
            usage: '!blacklist @usuario',
            adminOnly: true,
            groupOnly: true,
            aliases: ['block', 'bloquear']
        }
    );

    // ========================================
    // Comando: flood
    // Anti-flood (mensajes repetitivos)
    // ========================================
    registerCommand(
        'flood',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!isGroup(chatJid)) return;

            const action = args[0]?.toLowerCase();

            if (!action || action === 'info') {
                await sock.sendMessage(chatJid, {
                    text: `🌊 *Anti-Flood Configuration*\n\n
• !flood on - Activar detector
• !flood off - Desactivar
• !flood limit [número] - Definir límite (default: 5)

🌊 *Anti-Flood detecta mensajes repetitivos.*`
                });
                return;
            }

            try {
                const groupMetadata = await sock.groupMetadata(chatJid);
                const senderIsAdmin = groupMetadata.participants.some(
                    p => p.id === senderJid && p.admin
                );

                if (!senderIsAdmin) {
                    await sock.sendMessage(chatJid, {
                        text: '🛡️ *Solo administradores.*'
                    });
                    return;
                }

                if (action === 'on') {
                    await sock.sendMessage(chatJid, {
                        text: '✅ *Anti-Flood activado*',
                        contextInfo: { mentionedJid: [senderJid] }
                    });
                } else if (action === 'off') {
                    await sock.sendMessage(chatJid, {
                        text: '❌ *Anti-Flood desactivado*',
                        contextInfo: { mentionedJid: [senderJid] }
                    });
                } else if (action === 'limit' && args[1]) {
                    await sock.sendMessage(chatJid, {
                        text: `📊 *Límite de flood:* ${args[1]} mensajes`,
                        contextInfo: { mentionedJid: [senderJid] }
                    });
                }

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`
                });
            }
        },
        {
            description: 'Configurar anti-flood',
            category: 'Administración',
            usage: '!flood [on/off/limit]',
            adminOnly: true,
            groupOnly: true,
            aliases: ['antiflood', 'spam']
        }
    );
}
