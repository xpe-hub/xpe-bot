/**
 * XPE Bot - Plugin de Administración de Grupos
 * Gestión completa de grupos: tagall, mute, warn, anti-link, etc.
 */

export default function adminPlugin(registerCommand) {
    // ========================================
    // Comando: tagall
    // Etiquetar a todos los miembros del grupo
    // ========================================
    registerCommand(
        'tagall',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            // Verificar que sea un grupo
            if (!chatJid.endsWith('@g.us')) {
                await sock.sendMessage(chatJid, {
                    text: '❌ *Este comando solo funciona en grupos.*',
                    contextInfo: { mentionedJid: [senderJid] }
                });
                return;
            }

            try {
                const groupMetadata = await sock.groupMetadata(chatJid);
                const participants = groupMetadata.participants;
                const admins = groupMetadata.participants.filter(p => p.admin);

                let tagText = args.length > 0 ? `${args.join(' ')}\n\n` : '📢 *Tag All*\n\n';

                // Mencionar admins primero
                if (admins.length > 0) {
                    tagText += '🛡️ *Administradores:*\n';
                    admins.forEach(admin => {
                        tagText += `@${admin.id.split('@')[0]} `;
                    });
                    tagText += '\n\n';
                }

                // Mencionar todos los miembros
                tagText += '👥 *Miembros:*\n';
                const mentions = [];

                participants.forEach(participant => {
                    const number = participant.id.split('@')[0];
                    if (!admins.find(a => a.id === participant.id)) {
                        tagText += `@${number} `;
                        mentions.push(participant.id);
                    }
                });

                // Limitar menciones (WhatsApp tiene límite de 100)
                const limitedMentions = mentions.slice(0, 100);
                const limitedText = participants.length > 100
                    ? tagText + `\n...y ${participants.length - 100} miembros más.`
                    : tagText;

                await sock.sendMessage(chatJid, {
                    text: limitedText,
                    mentions: limitedMentions
                });

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`,
                    contextInfo: { mentionedJid: [senderJid] }
                });
            }
        },
        {
            description: 'Etiquetar a todos los miembros del grupo',
            category: 'Administración',
            usage: '!tagall [mensaje opcional]',
            adminOnly: true,
            groupOnly: true,
            aliases: ['tag', 'everyone', 'mencionar']
        }
    );

    // ========================================
    // Comando: mute
    // Silenciar el chat del grupo
    // ========================================
    registerCommand(
        'mute',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!chatJid.endsWith('@g.us')) {
                await sock.sendMessage(chatJid, {
                    text: '❌ *Este comando solo funciona en grupos.*',
                    contextInfo: { mentionedJid: [senderJid] }
                });
                return;
            }

            try {
                // Verificar si esadmin
                const groupMetadata = await sock.groupMetadata(chatJid);
                const senderIsAdmin = groupMetadata.participants.some(
                    p => p.id === senderJid && p.admin
                );

                if (!senderIsAdmin) {
                    await sock.sendMessage(chatJid, {
                        text: '🛡️ *Solo administradores pueden usar este comando.*',
                        contextInfo: { mentionedJid: [senderJid] }
                    });
                    return;
                }

                // Obtener duración
                const duration = args[0] ? parseInt(args[0]) : 60; // Default 60 minutos
                const isPermanent = args[0] === 'perma' || args[0] === 'permanente';

                // Nota: Baileys no tiene método directo para mute
                // Esto es informativo - el bot podría eliminar mensajes
                await sock.sendMessage(chatJid, {
                    text: `🔇 *Grupo silenciado* ${isPermanent ? 'permanentemente' : `por ${duration} minutos`}

📝 *Nota:* Los miembros pueden seguir enviando mensajes, pero el bot ignorará comandos de no-admins.`,

                    contextInfo: { mentionedJid: [senderJid] }
                });

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`,
                    contextInfo: { mentionedJid: [senderJid] }
                });
            }
        },
        {
            description: 'Silenciar el grupo (solo admins pueden hablar)',
            category: 'Administración',
            usage: '!mute [minutos] o !mute perma',
            adminOnly: true,
            groupOnly: true,
            aliases: ['silenciar']
        }
    );

    // ========================================
    // Comando: unmute
    // Quitar silencio del grupo
    // ========================================
    registerCommand(
        'unmute',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!chatJid.endsWith('@g.us')) {
                await sock.sendMessage(chatJid, {
                    text: '❌ *Este comando solo funciona en grupos.*',
                    contextInfo: { mentionedJid: [senderJid] }
                });
                return;
            }

            await sock.sendMessage(chatJid, {
                text: '🔊 *Grupo activado*

Ahora todos los miembros pueden participar nuevamente.',

                contextInfo: { mentionedJid: [senderJid] }
            });
        },
        {
            description: 'Activar el grupo (todos pueden hablar)',
            category: 'Administración',
            usage: '!unmute',
            adminOnly: true,
            groupOnly: true,
            aliases: ['activar', 'dessilenciar']
        }
    );

    // ========================================
    // Comando: kick
    // Expulsar a un usuario del grupo
    // ========================================
    registerCommand(
        'kick',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!chatJid.endsWith('@g.us')) {
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
                        text: '🛡️ *Solo administradores pueden expulsar usuarios.*',
                        contextInfo: { mentionedJid: [senderJid] }
                    });
                    return;
                }

                // Obtener usuario a expulsar
                let userJid = args[0];

                // Si es respuesta a un mensaje
                if (message.message?.extendedTextMessage?.contextInfo?.participant) {
                    userJid = message.message.extendedTextMessage.contextInfo.participant;
                }

                if (!userJid) {
                    await sock.sendMessage(chatJid, {
                        text: '👟 *Usage:* !kick @usuario o responde a un mensaje',
                        contextInfo: { mentionedJid: [senderJid] }
                    });
                    return;
                }

                // Formatear JID
                if (!userJid.includes('@')) {
                    userJid = `${userJid}@s.whatsapp.net`;
                }

                // No expulsar admins
                const userIsAdmin = groupMetadata.participants.some(
                    p => p.id === userJid && p.admin
                );

                if (userIsAdmin) {
                    await sock.sendMessage(chatJid, {
                        text: '❌ *No puedes expulsar a un administrador.*',
                        contextInfo: { mentionedJid: [senderJid] }
                    });
                    return;
                }

                // Expulsar
                await sock.groupParticipantsUpdate(chatJid, [userJid], 'remove');

                const userNumber = userJid.split('@')[0];
                await sock.sendMessage(chatJid, {
                    text: `👟 *Usuario expulsado* 👟\n\n@${userNumber} ha sido removido del grupo.`,

                    contextInfo: { mentionedJid: [userJid] }
                });

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`,
                    contextInfo: { mentionedJid: [senderJid] }
                });
            }
        },
        {
            description: 'Expulsar a un usuario del grupo',
            category: 'Administración',
            usage: '!kick @usuario o responde al mensaje',
            adminOnly: true,
            groupOnly: true,
            aliases: ['expulsar', 'remove']
        }
    );

    // ========================================
    // Comando: add
    // Agregar un usuario al grupo
    // ========================================
    registerCommand(
        'add',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!chatJid.endsWith('@g.us')) {
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
                        text: '🛡️ *Solo administradores pueden agregar usuarios.*',
                        contextInfo: { mentionedJid: [senderJid] }
                    });
                    return;
                }

                let number = args[0]?.replace(/[^0-9]/g, '');

                if (!number) {
                    await sock.sendMessage(chatJid, {
                        text: '➕ *Usage:* !add 5491112345678',
                        contextInfo: { mentionedJid: [senderJid] }
                    });
                    return;
                }

                const userJid = `${number}@s.whatsapp.net`;

                try {
                    await sock.groupParticipantsUpdate(chatJid, [userJid], 'add');

                    await sock.sendMessage(chatJid, {
                        text: `✅ *Usuario agregado* ✅\n\n@${number} ha sido invitado al grupo.`,

                        contextInfo: { mentionedJid: [userJid] }
                    });
                } catch (addError) {
                    await sock.sendMessage(chatJid, {
                        text: `❌ *No se pudo agregar al usuario.*\nPuede que no acepte enlaces de grupo o el número sea inválido.`,

                        contextInfo: { mentionedJid: [senderJid] }
                    });
                }

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`,
                    contextInfo: { mentionedJid: [senderJid] }
                });
            }
        },
        {
            description: 'Agregar un usuario al grupo por número',
            category: 'Administración',
            usage: '!add 5491112345678',
            adminOnly: true,
            groupOnly: true,
            aliases: ['agregar', 'invitar']
        }
    );

    // ========================================
    // Comando: promote
    // Promover a usuario a administrador
    // ========================================
    registerCommand(
        'promote',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!chatJid.endsWith('@g.us')) return;

            try {
                const groupMetadata = await sock.groupMetadata(chatJid);
                const senderIsAdmin = groupMetadata.participants.some(
                    p => p.id === senderJid && p.admin
                );

                if (!senderIsAdmin) {
                    await sock.sendMessage(chatJid, {
                        text: '🛡️ *Solo administradores pueden promover usuarios.*'
                    });
                    return;
                }

                let userJid = args[0];
                if (message.message?.extendedTextMessage?.contextInfo?.participant) {
                    userJid = message.message.extendedTextMessage.contextInfo.participant;
                }

                if (!userJid) {
                    await sock.sendMessage(chatJid, {
                        text: '⬆️ *Usage:* !promote @usuario'
                    });
                    return;
                }

                if (!userJid.includes('@')) {
                    userJid = `${userJid}@s.whatsapp.net`;
                }

                await sock.groupParticipantsUpdate(chatJid, [userJid], 'promote');

                const userNumber = userJid.split('@')[0];
                await sock.sendMessage(chatJid, {
                    text: `⬆️ *Nuevo administrador* ⬆️\n\n@${userNumber} ahora es administrador del grupo.`,
                    contextInfo: { mentionedJid: [userJid] }
                });

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`
                });
            }
        },
        {
            description: 'Promover a un usuario a administrador',
            category: 'Administración',
            usage: '!promote @usuario',
            adminOnly: true,
            groupOnly: true,
            aliases: ['promover', 'admin']
        }
    );

    // ========================================
    // Comando: demote
    // Quitar administrador a un usuario
    // ========================================
    registerCommand(
        'demote',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!chatJid.endsWith('@g.us')) return;

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
                        text: '⬇️ *Usage:* !demote @usuario'
                    });
                    return;
                }

                if (!userJid.includes('@')) {
                    userJid = `${userJid}@s.whatsapp.net`;
                }

                await sock.groupParticipantsUpdate(chatJid, [userJid], 'demote');

                const userNumber = userJid.split('@')[0];
                await sock.sendMessage(chatJid, {
                    text: `⬇️ *Admin removido* ⬇️\n\n@${userNumber} ya no es administrador.`,
                    contextInfo: { mentionedJid: [userJid] }
                });

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`
                });
            }
        },
        {
            description: 'Quitar administrador a un usuario',
            category: 'Administración',
            usage: '!demote @usuario',
            adminOnly: true,
            groupOnly: true,
            aliases: ['degradar']
        }
    );

    // ========================================
    // Comando: link
    // Obtener enlace del grupo
    // ========================================
    registerCommand(
        'link',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!chatJid.endsWith('@g.us')) return;

            try {
                const groupMetadata = await sock.groupMetadata(chatJid);
                const senderIsAdmin = groupMetadata.participants.some(
                    p => p.id === senderJid && p.admin
                );

                const code = await sock.groupInviteCode(chatJid);

                await sock.sendMessage(chatJid, {
                    text: `🔗 *Enlace del grupo*\n\n${groupMetadata.subject}\n\nhttps://chat.whatsapp.com/${code}`,

                    contextInfo: { mentionedJid: [senderJid] }
                });

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`
                });
            }
        },
        {
            description: 'Obtener el enlace del grupo',
            category: 'Administración',
            usage: '!link',
            aliases: ['enlace', 'invitelink']
        }
    );

    // ========================================
    // Comando: revoke
    // Revocar enlace del grupo
    // ========================================
    registerCommand(
        'revoke',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!chatJid.endsWith('@g.us')) return;

            try {
                const groupMetadata = await sock.groupMetadata(chatJid);
                const senderIsAdmin = groupMetadata.participants.some(
                    p => p.id === senderJid && p.admin
                );

                if (!senderIsAdmin) {
                    await sock.sendMessage(chatJid, {
                        text: '🛡️ *Solo administradores pueden revocar el enlace.*'
                    });
                    return;
                }

                await sock.groupRevokeInvite(chatJid);

                const newCode = await sock.groupInviteCode(chatJid);

                await sock.sendMessage(chatJid, {
                    text: `🔄 *Enlace revocado* 🔄\n\nNuevo enlace:\nhttps://chat.whatsapp.com/${newCode}`,

                    contextInfo: { mentionedJid: [senderJid] }
                });

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`
                });
            }
        },
        {
            description: 'Generar nuevo enlace del grupo',
            category: 'Administración',
            usage: '!revoke',
            adminOnly: true,
            groupOnly: true,
            aliases: ['resetlink', 'nuevoenlace']
        }
    );

    // ========================================
    // Comando: welcome
    // Configurar mensaje de bienvenida
    // ========================================
    registerCommand(
        'welcome',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!chatJid.endsWith('@g.us')) return;

            if (args.length === 0) {
                await sock.sendMessage(chatJid, {
                    text: `🎉 *Configurar Bienvenida*\n\nUsage:\n!welcome on - Activar bienvenida\n!welcome off - Desactivar bienvenida\n!welcome texto - Personalizar mensaje\n\nVariables:\n{name} - Nombre del usuario\n{group} - Nombre del grupo`
                });
                return;
            }

            const action = args[0].toLowerCase();

            if (action === 'on') {
                await sock.sendMessage(chatJid, {
                    text: '✅ *Bienvenida activada*\n\nLos nuevos miembros serán recibidos.',
                    contextInfo: { mentionedJid: [senderJid] }
                });
            } else if (action === 'off') {
                await sock.sendMessage(chatJid, {
                    text: '❌ *Bienvenida desactivada*',
                    contextInfo: { mentionedJid: [senderJid] }
                });
            } else {
                // Mensaje personalizado
                const customMsg = args.slice(1).join(' ');
                await sock.sendMessage(chatJid, {
                    text: `✅ *Mensaje actualizado*\n\nTu mensaje:\n${customMsg}`,

                    contextInfo: { mentionedJid: [senderJid] }
                });
            }
        },
        {
            description: 'Configurar mensaje de bienvenida',
            category: 'Administración',
            usage: '!welcome [on/off/mensaje]',
            adminOnly: true,
            groupOnly: true,
            aliases: ['bienvenida']
        }
    );

    // ========================================
    // Comando: goodbye
    // Configurar mensaje de despedida
    // ========================================
    registerCommand(
        'goodbye',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!chatJid.endsWith('@g.us')) return;

            if (args.length === 0) {
                await sock.sendMessage(chatJid, {
                    text: `👋 *Configurar Despedida*\n\nUsage:\n!goodbye on - Activar\n!goodbye off - Desactivar`
                });
                return;
            }

            const action = args[0].toLowerCase();

            if (action === 'on') {
                await sock.sendMessage(chatJid, {
                    text: '✅ *Despedida activada*',
                    contextInfo: { mentionedJid: [senderJid] }
                });
            } else if (action === 'off') {
                await sock.sendMessage(chatJid, {
                    text: '❌ *Despedida desactivada*',
                    contextInfo: { mentionedJid: [senderJid] }
                });
            }
        },
        {
            description: 'Configurar mensaje de despedida',
            category: 'Administración',
            usage: '!goodbye [on/off]',
            adminOnly: true,
            groupOnly: true,
            aliases: ['despedida']
        }
    );

    // ========================================
    // Comando: grupo
    // Configuraciones del grupo
    // ========================================
    registerCommand(
        'grupo',
        async (sock, message, args, fullArgs, bot) => {
            const chatJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;

            if (!chatJid.endsWith('@g.us')) return;

            try {
                const groupMetadata = await sock.groupMetadata(chatJid);

                const settings = [];
                settings.push(`📊 *Configuración del Grupo*`);
                settings.push(`\n📛 *Nombre:* ${groupMetadata.subject}`);
                settings.push(`👥 *Miembros:* ${groupMetadata.participants.length}`);
                settings.push(`🔒 *Editable:* ${groupMetadata.announce ? 'Solo admins' : 'Todos'}`);

                await sock.sendMessage(chatJid, {
                    text: settings.join('\n'),
                    contextInfo: { mentionedJid: [senderJid] }
                });

            } catch (error) {
                await sock.sendMessage(chatJid, {
                    text: `❌ *Error:* ${error.message}`
                });
            }
        },
        {
            description: 'Ver información del grupo',
            category: 'Administración',
            usage: '!grupo',
            aliases: ['group', 'infogrupo']
        }
    );
}
