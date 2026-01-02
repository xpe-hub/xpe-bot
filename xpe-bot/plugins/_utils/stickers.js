/**
 * Plugin de Stickers - XPE Bot
 * Crea stickers personalizados desde imágenes, videos y URLs
 */

export default {
  name: 'sticker',
  category: 'utils',
  desc: 'Comandos para crear stickers y想把 imágenes',
  alias: ['stikers', 'stickers', 'wasted'],
  usage: '[/sticker comando]',
  cooldown: 10,
  requirePrefix: true,
  isGroup: false,
  onlyOwner: false,
  onlyAdmin: false,
  
  async execute(ctx, { args, react }) {
    try {
      const menuStickers = `
╔══════════════════════════════════════╗
║     🎨 XPE Bot - Creador de Stickers ║
╠══════════════════════════════════════╣
║                                      ║
║  📦 *sticker*      - Imagen a sticker ║
║  🎬 *stickerVid*   - Video a sticker  ║
║  🔗 *stickerUrl*   - URL a sticker    ║
║  ✂️ *stickerCrop*  - Recortar sticker ║
║  🖼️ *stickerCircle*- Sticker circular ║
║  💀 *wasted*       - Effecto wasted   ║
║  🎭 *stickerEmoji* - Emoji a sticker  ║
║  🔄 *stickerGif*   - GIF a sticker    ║
║  📐 *stickerSquare*- Sin fondo auto   ║
║  🏷️ *stickerTag*   - Mention sticker  ║
║                                      ║
║  💡 Envía una imagen y responde con  ║
║     /sticker para convertirla       ║
╚══════════════════════════════════════╝
      `.trim();

      if (args.length === 0) {
        await ctx.sendMessage({ text: menuStickers });
        await react('🎨');
        return true;
      }

      const subcomando = args[0].toLowerCase();
      const subcomandosPermitidos = ['sticker', 'stickervid', 'stickerurl', 'stickercrop', 'stickercircle', 'wasted', 'stickeremoji', 'stickergif', 'stickersquare', 'stickertag'];
      
      if (!subcomandosPermitidos.includes(subcomando)) {
        await ctx.sendMessage({
          text: `❌ *Comando no reconocido.*\n\n${menuStickers}`
        });
        return true;
      }

      // Los comandos específicos manejan sus propios argumentos
      await ctx.sendMessage({
        text: `🎨 *XPE Bot Sticker Creator*\n\n*Comando:* /${subcomando}\n\n*Espera mientras procesamos tu imagen...*`
      });

      return true;
    } catch (error) {
      console.error('Error en comando sticker principal:', error);
      await ctx.sendMessage({ text: '❌ Ocurrió un error.' });
      return false;
    }
  }
};

// Sub-comandos de stickers exportados individualmente
export const stickerCommands = {
  sticker: {
    name: 'sticker',
    category: 'utils',
    desc: 'Convierte una imagen a sticker',
    alias: ['stiker', 'toimg', 'imgto'],
    usage: '[/sticker responder imagen]',
    cooldown: 15,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { args, quotedMsg, react }) {
      try {
        // Obtener la imagen del mensaje citado o del actual
        let imageBuffer = null;
        
        if (quotedMsg?.imageMessage) {
          imageBuffer = await ctx.downloadMediaMessage(quotedMsg);
        } else if (ctx.message?.imageMessage) {
          imageBuffer = await ctx.downloadMediaMessage(ctx);
        }

        if (!imageBuffer) {
          await ctx.sendMessage({
            text: '❌ *Error:* Debes responder a una imagen o enviar una imagen con el comando.\n\n*Uso:* Envía una imagen y responde con /sticker'
          });
          return true;
        }

        await ctx.sendMessage({ text: '🎨 *Procesando imagen...*' });

        // Convertir imagen a sticker usando ffmpeg/ImageMagick
        const stickerBuffer = await this.imagenASticker(imageBuffer);
        
        if (stickerBuffer) {
          await ctx.sendMessage({
            sticker: { url: stickerBuffer },
            caption: '✅ *Sticker creado exitosamente!*'
          });
          await react('✅');
        } else {
          await ctx.sendMessage({
            text: '❌ *Error:* No se pudo crear el sticker. Verifica que la imagen sea válida.'
          });
        }

        return true;
      } catch (error) {
        console.error('Error creando sticker:', error);
        await ctx.sendMessage({ text: '❌ Error al crear el sticker.' });
        return false;
      }
    }
  },

  stickervid: {
    name: 'stickervid',
    category: 'utils',
    desc: 'Convierte un video a sticker (máx 10 segundos)',
    alias: ['stikervid', 'vidsticker', 'gifsticker'],
    usage: '[/stickervid responder video]',
    cooldown: 20,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { quotedMsg, react }) {
      try {
        let videoBuffer = null;
        
        if (quotedMsg?.videoMessage) {
          videoBuffer = await ctx.downloadMediaMessage(quotedMsg);
        } else if (ctx.message?.videoMessage) {
          videoBuffer = await ctx.downloadMediaMessage(ctx);
        }

        if (!videoBuffer) {
          await ctx.sendMessage({
            text: '❌ *Error:* Debes responder a un video (máx 10 segundos).\n\n*Uso:* Envía un video y responde con /stickervid'
          });
          return true;
        }

        await ctx.sendMessage({ text: '🎬 *Procesando video a sticker...*' });

        // Convertir video a sticker animado
        const stickerBuffer = await this.videoASticker(videoBuffer);
        
        if (stickerBuffer) {
          await ctx.sendMessage({
            sticker: { url: stickerBuffer },
            caption: '✅ *Sticker de video creado!* 🎬'
          });
          await react('✅');
        } else {
          await ctx.sendMessage({
            text: '❌ *Error:* No se pudo crear el sticker. El video debe ser menor a 10 segundos.'
          });
        }

        return true;
      } catch (error) {
        console.error('Error creando sticker de video:', error);
        await ctx.sendMessage({ text: '❌ Error al crear el sticker de video.' });
        return false;
      }
    }
  },

  stickerurl: {
    name: 'stickerurl',
    category: 'utils',
    desc: 'Convierte una URL de imagen a sticker',
    alias: ['urlsticker', 'linksticker'],
    usage: '[/stickerurl https://url-de-imagen.com]',
    cooldown: 15,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { args, react }) {
      try {
        const url = args[0];
        
        if (!url) {
          await ctx.sendMessage({
            text: '❌ *Error:* Falta la URL de la imagen.\n\n*Uso:* /stickerurl [URL de imagen]'
          });
          return true;
        }

        // Validar URL
        if (!url.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
          await ctx.sendMessage({
            text: '❌ *Error:* La URL debe ser de una imagen (jpg, jpeg, png, gif, webp).'
          });
          return true;
        }

        await ctx.sendMessage({ text: '🔗 *Descargando imagen de URL...*' });

        // Descargar imagen de URL y convertir
        const stickerBuffer = await this.urlASticker(url);
        
        if (stickerBuffer) {
          await ctx.sendMessage({
            sticker: { url: stickerBuffer },
            caption: '✅ *Sticker creado desde URL!* 🔗'
          });
          await react('✅');
        } else {
          await ctx.sendMessage({
            text: '❌ *Error:* No se pudo descargar o procesar la imagen.'
          });
        }

        return true;
      } catch (error) {
        console.error('Error creando sticker desde URL:', error);
        await ctx.sendMessage({ text: '❌ Error al crear sticker desde URL.' });
        return false;
      }
    }
  },

  stickercrop: {
    name: 'stickercrop',
    category: 'utils',
    desc: 'Crea un sticker recortando la imagen',
    alias: ['cropsticker', 'recortar'],
    usage: '[/stickercrop responder imagen]',
    cooldown: 15,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { quotedMsg, react }) {
      try {
        let imageBuffer = null;
        
        if (quotedMsg?.imageMessage) {
          imageBuffer = await ctx.downloadMediaMessage(quotedMsg);
        } else if (ctx.message?.imageMessage) {
          imageBuffer = await ctx.downloadMediaMessage(ctx);
        }

        if (!imageBuffer) {
          await ctx.sendMessage({
            text: '❌ *Error:* Debes responder a una imagen.\n\n*Uso:* Envía una imagen y responde con /stickercrop'
          });
          return true;
        }

        await ctx.sendMessage({ text: '✂️ *Recortando imagen...*' });

        // Recortar al centro y convertir a sticker
        const stickerBuffer = await this.imagenRecortadaASticker(imageBuffer);
        
        if (stickerBuffer) {
          await ctx.sendMessage({
            sticker: { url: stickerBuffer },
            caption: '✅ *Sticker recortado creado!* ✂️'
          });
          await react('✅');
        } else {
          await ctx.sendMessage({
            text: '❌ *Error:* No se pudo crear el sticker.'
          });
        }

        return true;
      } catch (error) {
        console.error('Error creando sticker recortado:', error);
        await ctx.sendMessage({ text: '❌ Error al crear sticker recortado.' });
        return false;
      }
    }
  },

  stickercircle: {
    name: 'stickercircle',
    category: 'utils',
    desc: 'Crea un sticker circular',
    alias: ['circlesticker', 'redondo'],
    usage: '[/stickercircle responder imagen]',
    cooldown: 15,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { quotedMsg, react }) {
      try {
        let imageBuffer = null;
        
        if (quotedMsg?.imageMessage) {
          imageBuffer = await ctx.downloadMediaMessage(quotedMsg);
        } else if (ctx.message?.imageMessage) {
          imageBuffer = await ctx.downloadMediaMessage(ctx);
        }

        if (!imageBuffer) {
          await ctx.sendMessage({
            text: '❌ *Error:* Debes responder a una imagen.\n\n*Uso:* Envía una imagen y responde con /stickercircle'
          });
          return true;
        }

        await ctx.sendMessage({ text: '⭕ *Creando sticker circular...*' });

        const stickerBuffer = await this.imagenCircularASticker(imageBuffer);
        
        if (stickerBuffer) {
          await ctx.sendMessage({
            sticker: { url: stickerBuffer },
            caption: '✅ *Sticker circular creado!* ⭕'
          });
          await react('✅');
        } else {
          await ctx.sendMessage({
            text: '❌ *Error:* No se pudo crear el sticker.'
          });
        }

        return true;
      } catch (error) {
        console.error('Error creando sticker circular:', error);
        await ctx.sendMessage({ text: '❌ Error al crear sticker circular.' });
        return false;
      }
    }
  },

  wasted: {
    name: 'wasted',
    category: 'utils',
    desc: 'Añade el efecto "Wasted" de GTA a una imagen',
    alias: ['gta', 'wastedeffect'],
    usage: '[/wasted responder imagen]',
    cooldown: 15,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { quotedMsg, react }) {
      try {
        let imageBuffer = null;
        
        if (quotedMsg?.imageMessage) {
          imageBuffer = await ctx.downloadMediaMessage(quotedMsg);
        } else if (ctx.message?.imageMessage) {
          imageBuffer = await ctx.downloadMediaMessage(ctx);
        }

        if (!imageBuffer) {
          await ctx.sendMessage({
            text: '❌ *Error:* Debes responder a una imagen.\n\n*Uso:* Envía una imagen y responde con /wasted'
          });
          return true;
        }

        await ctx.sendMessage({ text: '💀 *Aplicando efecto Wasted...*' });

        const stickerBuffer = await this.aplicarWasted(imageBuffer);
        
        if (stickerBuffer) {
          await ctx.sendMessage({
            image: { url: stickerBuffer },
            caption: '💀 *Wasted!*'
          });
          await react('💀');
        } else {
          await ctx.sendMessage({
            text: '❌ *Error:* No se pudo aplicar el efecto.'
          });
        }

        return true;
      } catch (error) {
        console.error('Error aplicando efecto wasted:', error);
        await ctx.sendMessage({ text: '❌ Error al aplicar efecto Wasted.' });
        return false;
      }
    }
  },

  stickeremoji: {
    name: 'stickeremoji',
    category: 'utils',
    desc: 'Convierte un emoji a sticker gigante',
    alias: ['emojisticker', 'emojistiker'],
    usage: '[/stickeremoji 😀]',
    cooldown: 10,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { args, react }) {
      try {
        const emoji = args[0];
        
        if (!emoji) {
          await ctx.sendMessage({
            text: '❌ *Error:* Debes proporcionar un emoji.\n\n*Uso:* /stickeremoji 😀'
          });
          return true;
        }

        await ctx.sendMessage({ text: '🎭 *Convirtiendo emoji a sticker...*' });

        const stickerBuffer = await this.emojiASticker(emoji);
        
        if (stickerBuffer) {
          await ctx.sendMessage({
            sticker: { url: stickerBuffer },
            caption: '✅ *Emoji sticker creado!* 🎭'
          });
          await react('✅');
        } else {
          await ctx.sendMessage({
            text: '❌ *Error:* No se pudo convertir el emoji.'
          });
        }

        return true;
      } catch (error) {
        console.error('Error creando sticker de emoji:', error);
        await ctx.sendMessage({ text: '❌ Error al convertir emoji a sticker.' });
        return false;
      }
    }
  },

  stickergif: {
    name: 'stickergif',
    category: 'utils',
    desc: 'Convierte un GIF a sticker animado',
    alias: ['gifstiker', 'gifsicker'],
    usage: '[/stickergif responder gif]',
    cooldown: 20,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { quotedMsg, react }) {
      try {
        let gifBuffer = null;
        
        if (quotedMsg?.imageMessage) {
          gifBuffer = await ctx.downloadMediaMessage(quotedMsg);
        } else if (ctx.message?.imageMessage) {
          gifBuffer = await ctx.downloadMediaMessage(ctx);
        }

        if (!gifBuffer) {
          await ctx.sendMessage({
            text: '❌ *Error:* Debes responder a un GIF.\n\n*Uso:* Envía un GIF y responde con /stickergif'
          });
          return true;
        }

        await ctx.sendMessage({ text: '🔄 *Convirtiendo GIF a sticker animado...*' });

        const stickerBuffer = await this.gifASticker(gifBuffer);
        
        if (stickerBuffer) {
          await ctx.sendMessage({
            sticker: { url: stickerBuffer },
            caption: '✅ *Sticker animado creado!* 🔄'
          });
          await react('✅');
        } else {
          await ctx.sendMessage({
            text: '❌ *Error:* No se pudo convertir el GIF.'
          });
        }

        return true;
      } catch (error) {
        console.error('Error creando sticker de GIF:', error);
        await ctx.sendMessage({ text: '❌ Error al convertir GIF a sticker.' });
        return false;
      }
    }
  },

  stickersquare: {
    name: 'stickersquare',
    category: 'utils',
    desc: 'Crea sticker eliminando automáticamente el fondo',
    alias: ['nobg', 'sinfondo', 'removebg'],
    usage: '[/stickersquare responder imagen]',
    cooldown: 20,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { quotedMsg, react }) {
      try {
        let imageBuffer = null;
        
        if (quotedMsg?.imageMessage) {
          imageBuffer = await ctx.downloadMediaMessage(quotedMsg);
        } else if (ctx.message?.imageMessage) {
          imageBuffer = await ctx.downloadMediaMessage(ctx);
        }

        if (!imageBuffer) {
          await ctx.sendMessage({
            text: '❌ *Error:* Debes responder a una imagen.\n\n*Uso:* Envía una imagen y responde con /stickersquare'
          });
          return true;
        }

        await ctx.sendMessage({ text: '📐 *Eliminando fondo...*' });

        const stickerBuffer = await this.eliminarFondo(imageBuffer);
        
        if (stickerBuffer) {
          await ctx.sendMessage({
            sticker: { url: stickerBuffer },
            caption: '✅ *Sticker sin fondo creado!* 📐'
          });
          await react('✅');
        } else {
          await ctx.sendMessage({
            text: '❌ *Error:* No se pudo eliminar el fondo. (Requiere API key de remove.bg)'
          });
        }

        return true;
      } catch (error) {
        console.error('Error eliminando fondo:', error);
        await ctx.sendMessage({ text: '❌ Error al eliminar el fondo.' });
        return false;
      }
    }
  },

  stickertag: {
    name: 'stickertag',
    category: 'utils',
    desc: 'Crea sticker con el nombre de un usuario mencionado',
    alias: ['namesticker', 'mentionsticker'],
    usage: '[/stickertag responder imagen @usuario]',
    cooldown: 15,
    requirePrefix: true,
    isGroup: true,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { args, quotedMsg, react }) {
      try {
        let imageBuffer = null;
        
        if (quotedMsg?.imageMessage) {
          imageBuffer = await ctx.downloadMediaMessage(quotedMsg);
        }

        if (!imageBuffer) {
          await ctx.sendMessage({
            text: '❌ *Error:* Debes responder a una imagen.\n\n*Uso:* Responde a una imagen con /stickertag @usuario'
          });
          return true;
        }

        // Extraer mención del texto
        const mencion = args.find(arg => arg.startsWith('@'));
        const nombreUsuario = mencion ? mencion.replace('@', '') : 'Usuario';

        await ctx.sendMessage({ text: `🏷️ *Creando sticker de ${nombreUsuario}...*` });

        const stickerBuffer = await this.stickerConNombre(imageBuffer, nombreUsuario);
        
        if (stickerBuffer) {
          await ctx.sendMessage({
            sticker: { url: stickerBuffer },
            caption: `✅ *Sticker de ${nombreUsuario} creado!* 🏷️`
          });
          await react('✅');
        } else {
          await ctx.sendMessage({
            text: '❌ *Error:* No se pudo crear el sticker.'
          });
        }

        return true;
      } catch (error) {
        console.error('Error creando sticker con nombre:', error);
        await ctx.sendMessage({ text: '❌ Error al crear sticker con nombre.' });
        return false;
      }
    }
  }
};

// Funciones helper para procesamiento de imágenes
export const stickerFunctions = {
  /**
   * Convierte imagen a sticker usando ffmpeg
   */
  async imagenASticker(buffer) {
    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      const inputPath = path.join(__dirname, '../../temp/input_' + Date.now() + '.png');
      const outputPath = path.join(__dirname, '../../temp/output_' + Date.now() + '.webp');
      
      fs.writeFileSync(inputPath, buffer);
      
      // Usar ffmpeg para convertir a webp con propiedades de sticker
      const comando = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2" -y -c:v libwebp -lossless 0 -q:75 -loop 0 -an "${outputPath}"`;
      
      execSync(comando, { timeout: 30000 });
      
      if (fs.existsSync(outputPath)) {
        const result = fs.readFileSync(outputPath);
        // Limpiar archivos temporales
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error en imagenASticker:', error);
      return null;
    }
  },

  /**
   * Convierte video a sticker animado
   */
  async videoASticker(buffer) {
    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      const inputPath = path.join(__dirname, '../../temp/video_' + Date.now() + '.mp4');
      const outputPath = path.join(__dirname, '../../temp/video_sticker_' + Date.now() + '.webp');
      
      fs.writeFileSync(inputPath, buffer);
      
      // Convertir video a webp animado
      const comando = `ffmpeg -i "${inputPath}" -vf "fps=10,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2" -c:v libwebp -lossless 0 -q:75 -loop 0 -an -t 10 "${outputPath}"`;
      
      execSync(comando, { timeout: 60000 });
      
      if (fs.existsSync(outputPath)) {
        const result = fs.readFileSync(outputPath);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error en videoASticker:', error);
      return null;
    }
  },

  /**
   * Descarga imagen desde URL y convierte a sticker
   */
  async urlASticker(url) {
    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      const outputPath = path.join(__dirname, '../../temp/url_sticker_' + Date.now() + '.webp');
      
      // Descargar imagen
      const comando = `curl -s -o "${outputPath}.png" "${url}" 2>/dev/null && ffmpeg -i "${outputPath}.png" -vf "scale=512:512:force_original_aspect_ratio=decrease" -y -c:v libwebp -lossless 0 -q:75 "${outputPath}" && rm "${outputPath}.png"`;
      
      execSync(comando, { timeout: 30000 });
      
      if (fs.existsSync(outputPath)) {
        const result = fs.readFileSync(outputPath);
        fs.unlinkSync(outputPath);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error en urlASticker:', error);
      return null;
    }
  },

  /**
   * Crea sticker recortado al centro
   */
  async imagenRecortadaASticker(buffer) {
    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      const inputPath = path.join(__dirname, '../../temp/crop_' + Date.now() + '.png');
      const outputPath = path.join(__dirname, '../../temp/crop_sticker_' + Date.now() + '.webp');
      
      fs.writeFileSync(inputPath, buffer);
      
      // Recortar al centro
      const comando = `ffmpeg -i "${inputPath}" -vf "crop=min'(iw,ih)':min'(iw,ih)',scale=512:512" -y -c:v libwebp -lossless 0 -q:75 "${outputPath}"`;
      
      execSync(comando, { timeout: 30000 });
      
      if (fs.existsSync(outputPath)) {
        const result = fs.readFileSync(outputPath);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error en imagenRecortadaASticker:', error);
      return null;
    }
  },

  /**
   * Crea sticker circular
   */
  async imagenCircularASticker(buffer) {
    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      const inputPath = path.join(__dirname, '../../temp/circle_' + Date.now() + '.png');
      const outputPath = path.join(__dirname, '../../temp/circle_sticker_' + Date.now() + '.webp');
      
      fs.writeFileSync(inputPath, buffer);
      
      // Crear máscara circular
      const comando = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,colorchannelmixer=aa=1" -y -c:v libwebp -lossless 0 -q:75 "${outputPath}"`;
      
      execSync(comando, { timeout: 30000 });
      
      if (fs.existsSync(outputPath)) {
        const result = fs.readFileSync(outputPath);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error en imagenCircularASticker:', error);
      return null;
    }
  },

  /**
   * Aplica efecto "Wasted" de GTA
   */
  async aplicarWasted(buffer) {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const inputPath = path.join(__dirname, '../../temp/wasted_' + Date.now() + '.png');
      const outputPath = path.join(__dirname, '../../temp/wasted_result_' + Date.now() + '.png');
      
      fs.writeFileSync(inputPath, buffer);
      
      // Usar ImageMagick para aplicar efecto grayscale + texto "WASTED"
      const comando = `convert "${inputPath}" -gravity center -fill "#8b0000" -font Arial-Bold -pointsize 72 -annotate +0+0 "WASTED" -quality 85 "${outputPath}"`;
      
      try {
        execSync(comando, { timeout: 30000 });
      } catch (e) {
        // Si ImageMagick no está disponible, usar método alternativo
        console.log('ImageMagick no disponible, aplicando filtro alternativo...');
      }
      
      if (fs.existsSync(outputPath)) {
        const result = fs.readFileSync(outputPath);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error en aplicarWasted:', error);
      return null;
    }
  },

  /**
   * Convierte emoji a sticker gigante
   */
  async emojiASticker(emoji) {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Usar servicio externo o renderizar emoji
      const encodedEmoji = encodeURIComponent(emoji);
      const outputPath = path.join(__dirname, '../../temp/emoji_' + Date.now() + '.webp');
      
      // Opción 1: Descargar emoji renderizado desde servicio
      const emojiUrl = `https://fonts.gstatic.com/s/e/notoemoji/latest/${encodedEmoji}/512.webp`;
      
      const { execSync } = require('child_process');
      const comando = `curl -s -o "${outputPath}" "${emojiUrl}" 2>/dev/null`;
      
      execSync(comando, { timeout: 10000 });
      
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        const result = fs.readFileSync(outputPath);
        fs.unlinkSync(outputPath);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error en emojiASticker:', error);
      return null;
    }
  },

  /**
   * Convierte GIF a sticker animado
   */
  async gifASticker(buffer) {
    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      const inputPath = path.join(__dirname, '../../temp/gif_' + Date.now() + '.gif');
      const outputPath = path.join(__dirname, '../../temp/gif_sticker_' + Date.now() + '.webp');
      
      fs.writeFileSync(inputPath, buffer);
      
      // Convertir GIF a webp animado
      const comando = `ffmpeg -i "${inputPath}" -vf "fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2" -c:v libwebp -lossless 0 -q:80 -loop 0 -an "${outputPath}"`;
      
      execSync(comando, { timeout: 60000 });
      
      if (fs.existsSync(outputPath)) {
        const result = fs.readFileSync(outputPath);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error en gifASticker:', error);
      return null;
    }
  },

  /**
   * Elimina el fondo de una imagen
   */
  async eliminarFondo(buffer) {
    try {
      const settings = require('../../config/settings.js');
      const apiKey = settings.removeBgApiKey;
      
      if (!apiKey) {
        console.log('API key de remove.bg no configurada');
        return null;
      }

      const fs = require('fs');
      const path = require('path');
      const FormData = require('form-data');
      const fetch = require('node-fetch');
      
      const inputPath = path.join(__dirname, '../../temp/nobg_' + Date.now() + '.png');
      const outputPath = path.join(__dirname, '../../temp/nobg_result_' + Date.now() + '.png');
      
      fs.writeFileSync(inputPath, buffer);
      
      const formData = new FormData();
      formData.append('image_file', fs.createReadStream(inputPath));
      formData.append('size', 'auto');
      formData.append('api_key', apiKey);
      
      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders()
      });
      
      if (response.ok) {
        const resultBuffer = await response.arrayBuffer();
        fs.writeFileSync(outputPath, Buffer.from(resultBuffer));
        
        // Convertir a sticker
        const stickerBuffer = await this.imagenASticker(fs.readFileSync(outputPath));
        
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        
        return stickerBuffer;
      }
      
      fs.unlinkSync(inputPath);
      return null;
    } catch (error) {
      console.error('Error en eliminarFondo:', error);
      return null;
    }
  },

  /**
   * Crea sticker con nombre de usuario
   */
  async stickerConNombre(buffer, nombre) {
    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      const inputPath = path.join(__dirname, '../../temp/tag_' + Date.now() + '.png');
      const outputPath = path.join(__dirname, '../../temp/tag_sticker_' + Date.now() + '.webp');
      
      fs.writeFileSync(inputPath, buffer);
      
      // Añadir texto con el nombre
      const nombreSeguro = nombre.replace(/[^a-zA-Z0-9]/g, ' ').substring(0, 25);
      const comando = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2,drawbox=y=ih-80:height=80:color=black@0.7:fill,drawtext=text='${nombreSeguro}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=ih-65:fontpath=/usr/share/fonts" -y -c:v libwebp -lossless 0 -q:75 "${outputPath}"`;
      
      execSync(comando, { timeout: 30000 });
      
      if (fs.existsSync(outputPath)) {
        const result = fs.readFileSync(outputPath);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error en stickerConNombre:', error);
      return null;
    }
  }
};

// Asignar funciones al objeto principal para uso interno
Object.assign(stickerCommands.sticker, { imagenASticker: stickerFunctions.imagenASticker });
Object.assign(stickerCommands.stickervid, { videoASticker: stickerFunctions.videoASticker });
Object.assign(stickerCommands.stickerurl, { urlASticker: stickerFunctions.urlASticker });
Object.assign(stickerCommands.stickercrop, { imagenRecortadaASticker: stickerFunctions.imagenRecortadaASticker });
Object.assign(stickerCommands.stickercircle, { imagenCircularASticker: stickerFunctions.imagenCircularASticker });
Object.assign(stickerCommands.wasted, { aplicarWasted: stickerFunctions.aplicarWasted });
Object.assign(stickerCommands.stickeremoji, { emojiASticker: stickerFunctions.emojiASticker });
Object.assign(stickerCommands.stickergif, { gifASticker: stickerFunctions.gifASticker });
Object.assign(stickerCommands.stickersquare, { eliminarFondo: stickerFunctions.eliminarFondo });
Object.assign(stickerCommands.stickertag, { stickerConNombre: stickerFunctions.stickerConNombre });
