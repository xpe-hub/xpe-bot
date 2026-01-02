/**
 * Plugin de Text-to-Speech (TTS) - XPE Bot
 * Convierte texto a voz en múltiples idiomas
 */

export default {
  name: 'tts',
  category: 'utils',
  desc: 'Convierte texto a voz en diferentes idiomas',
  alias: ['voice', 'hablar', 'speech'],
  usage: '[/tts idioma texto]',
  cooldown: 15,
  requirePrefix: true,
  isGroup: false,
  onlyOwner: false,
  onlyAdmin: false,
  
  async execute(ctx, { args, react }) {
    try {
      const idiomas = `
╔══════════════════════════════════════╗
║     🔊 XPE Bot - Text to Speech      ║
╠══════════════════════════════════════╣
║                                      ║
║  Idiomas disponibles:                ║
║                                      ║
║  🇪🇸 *es* - Español                  ║
║  🇺🇸 *en* - Inglés                   ║
║  🇫🇷 *fr* - Francés                  ║
║  🇮🇹 *it* - Italiano                 ║
║  🇵🇹 *pt* - Portugués                ║
║  🇯🇵 *ja* - Japonés                  ║
║  🇩🇪 *de* - Alemán                   ║
║  🇷🇺 *ru* - Ruso                     ║
║  🇰🇷 *ko* - Coreano                  ║
║  🇨🇳 *zh* - Chino                    ║
║                                      ║
║  💡 Uso: /tts es Hola mundo          ║
║  💡 Uso: /tts en Hello world         ║
╚══════════════════════════════════════╝
      `.trim();

      if (args.length === 0) {
        await ctx.sendMessage({ text: idiomas });
        await react('🔊');
        return true;
      }

      const codigo = args[0].toLowerCase();
      const texto = args.slice(1).join(' ');

      if (!texto) {
        await ctx.sendMessage({
          text: `❌ *Error:* Falta el texto a convertir.\n\n*Uso correcto:* /tts [idioma] [texto]\n\n${idiomas}`
        });
        return true;
      }

      // Verificar idioma válido
      const idiomasValidos = ['es', 'en', 'fr', 'it', 'pt', 'ja', 'de', 'ru', 'ko', 'zh'];
      if (!idiomasValidos.includes(codigo)) {
        await ctx.sendMessage({
          text: `❌ *Idioma no válido.*\n\nPor favor selecciona un idioma de la lista:\n\n${idiomas}`
        });
        return true;
      }

      await ctx.sendMessage({
        text: `🔊 *Generando audio...*\n\n📝 Texto: "${texto}"\n🌐 Idioma: ${codigo.toUpperCase()}`
      });

      // Aquí se integraría con un servicio TTS real
      // Por ejemplo: Google TTS, OpenAI TTS, etc.
      const audioUrl = await this.generarAudio(codigo, texto);
      
      if (audioUrl) {
        await ctx.sendMessage({
          audio: { url: audioUrl },
          caption: '🔊 *Audio generado por XPE Bot*'
        });
        await react('✅');
      } else {
        await ctx.sendMessage({
          text: '⚠️ *Servicio de audio temporalmente no disponible.*\n\nPor favor intenta más tarde.'
        });
        await react('⚠️');
      }

      return true;
    } catch (error) {
      console.error('Error en comando TTS:', error);
      await ctx.sendMessage({ text: '❌ Ocurrió un error al generar el audio.' });
      return false;
    }
  }
};

// Función para generar audio (a implementar con servicio TTS real)
export async function generarAudio(idioma, texto) {
  try {
    // Implementación de ejemplo - reemplazar con servicio real
    // Opciones: Google Translate TTS API, OpenAI TTS, etc.
    
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');
    
    // Generar nombre de archivo único
    const nombreArchivo = `tts_${Date.now()}.mp3`;
    const rutaAudio = path.join(__dirname, '../../temp/', nombreArchivo);
    
    // Crear directorio temp si no existe
    if (!fs.existsSync(path.dirname(rutaAudio))) {
      fs.mkdirSync(path.dirname(rutaAudio), { recursive: true });
    }

    // Ejemplo usando Google Translate TTS (requiere curl)
    const comando = `curl -s -o "${rutaAudio}" "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${idioma}&q=${encodeURIComponent(texto)}"`;
    
    try {
      execSync(comando, { timeout: 10000 });
      
      if (fs.existsSync(rutaAudio) && fs.statSync(rutaAudio).size > 0) {
        return rutaAudio;
      }
    } catch (e) {
      console.log('Google TTS no disponible, usando fallback...');
    }

    // Fallback: retorna null si no se puede generar
    return null;
  } catch (error) {
    console.error('Error generando audio:', error);
    return null;
  }
}

// Comandos individuales TTS exportados para uso directo
export const ttsCommands = {
  tts_es: {
    name: 'tts_es',
    category: 'utils',
    desc: 'Convierte texto a voz en español',
    alias: ['vozes'],
    usage: '[/voz_es texto]',
    cooldown: 15,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { args, react }) {
      try {
        const texto = args.join(' ');
        
        if (!texto) {
          await ctx.sendMessage({
            text: '❌ *Error:* Falta el texto.\n\n*Uso:* /voz_es [texto a decir]'
          });
          return true;
        }

        await ctx.sendMessage({ text: `🔊 Generando audio en español...` });
        
        const audioUrl = await generarAudio('es', texto);
        
        if (audioUrl) {
          await ctx.sendMessage({
            audio: { url: audioUrl },
            caption: '🔊 *Audio en Español*'
          });
          await react('✅');
        } else {
          await ctx.sendMessage({ text: '⚠️ No se pudo generar el audio.' });
        }
        
        return true;
      } catch (error) {
        console.error('Error en TTS español:', error);
        await ctx.sendMessage({ text: '❌ Error al generar audio en español.' });
        return false;
      }
    }
  },

  tts_en: {
    name: 'tts_en',
    category: 'utils',
    desc: 'Convierte texto a voz en inglés',
    alias: ['voiceen'],
    usage: '[/voice_en text]',
    cooldown: 15,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { args, react }) {
      try {
        const texto = args.join(' ');
        
        if (!texto) {
          await ctx.sendMessage({
            text: '❌ *Error:* Missing text.\n\n*Usage:* /voice_en [text to say]'
          });
          return true;
        }

        await ctx.sendMessage({ text: `🔊 Generating English audio...` });
        
        const audioUrl = await generarAudio('en', texto);
        
        if (audioUrl) {
          await ctx.sendMessage({
            audio: { url: audioUrl },
            caption: '🔊 *English Audio*'
          });
          await react('✅');
        } else {
          await ctx.sendMessage({ text: '⚠️ Could not generate audio.' });
        }
        
        return true;
      } catch (error) {
        console.error('Error en TTS inglés:', error);
        await ctx.sendMessage({ text: '❌ Error generating English audio.' });
        return false;
      }
    }
  },

  tts_ja: {
    name: 'tts_ja',
    category: 'utils',
    desc: 'Convierte texto a voz en japonés',
    alias: ['voiceja', 'vozjp'],
    usage: '[/voz_ja  texto]',
    cooldown: 15,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { args, react }) {
      try {
        const texto = args.join(' ');
        
        if (!texto) {
          await ctx.sendMessage({
            text: '❌ *エラー:* テキストがありません。\n\n*使用方法:* /voz_ja [話すテキスト]'
          });
          return true;
        }

        await ctx.sendMessage({ text: `🔊 日本語の音声を生成中...` });
        
        const audioUrl = await generarAudio('ja', texto);
        
        if (audioUrl) {
          await ctx.sendMessage({
            audio: { url: audioUrl },
            caption: '🔊 *日本語の音声*'
          });
          await react('✅');
        } else {
          await ctx.sendMessage({ text: '⚠️ 音声を生成できませんでした。' });
        }
        
        return true;
      } catch (error) {
        console.error('Error en TTS japonés:', error);
        await ctx.sendMessage({ text: '❌ 日本語の音声生成エラー。' });
        return false;
      }
    }
  }
};

// Funciones helper para integración con servicios TTS externos
export const ttsService = {
  /**
   * Configuración para diferentes proveedores TTS
   */
  providers: {
    google: {
      name: 'Google Translate TTS',
      url: 'https://translate.google.com/translate_tts',
      formatos: ['mp3'],
      idiomas: ['es', 'en', 'fr', 'it', 'pt', 'de', 'ru', 'ja', 'ko', 'zh']
    },
    openai: {
      name: 'OpenAI TTS',
      url: 'https://api.openai.com/v1/audio/speech',
      formatos: ['mp3', 'opus', 'aac', 'flac'],
      idiomas: ['es', 'en', 'fr', 'de', 'pt', 'zh', 'ja', 'ko'],
      requiereApiKey: true
    },
    elevenlabs: {
      name: 'ElevenLabs',
      url: 'https://api.elevenlabs.io/v1/text-to-speech',
      formatos: ['mp3', 'wav', 'ogg', 'flac'],
      idiomas: ['es', 'en', 'fr', 'it', 'pt', 'de', 'ru', 'ja', 'ko', 'zh'],
      requiereApiKey: true
    }
  },

  /**
   * Obtiene la configuración actual del servicio TTS
   */
  getConfig() {
    // Leer configuración desde settings.js
    try {
      const settings = require('../../config/settings.js');
      return {
        provider: settings.ttsProvider || 'google',
        apiKey: settings.openaiApiKey || '',
        voice: settings.ttsVoice || 'alloy',
        model: settings.ttsModel || 'tts-1'
      };
    } catch (error) {
      return {
        provider: 'google',
        apiKey: '',
        voice: 'alloy',
        model: 'tts-1'
      };
    }
  },

  /**
   * Genera audio usando OpenAI TTS
   */
  async generateWithOpenAI(texto, idioma, voz = 'alloy') {
    const config = this.getConfig();
    
    if (!config.apiKey) {
      throw new Error('API key de OpenAI no configurada');
    }

    // Mapear códigos de idioma a OpenAI
    const idiomaOpenAI = {
      'es': 'spanish',
      'en': 'english',
      'fr': 'french',
      'it': 'italian',
      'pt': 'portuguese',
      'de': 'german',
      'ja': 'japanese',
      'ko': 'korean',
      'zh': 'chinese'
    };

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        input: texto,
        voice: voz,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      throw new Error('Error en la API de OpenAI');
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  },

  /**
   * Genera audio y guarda en archivo temporal
   */
  async generarAudioCompleto(idioma, texto) {
    const fs = require('fs');
    const path = require('path');
    const config = this.getConfig();
    
    // Generar nombre de archivo único
    const nombreArchivo = `tts_${Date.now()}.mp3`;
    const rutaAudio = path.join(__dirname, '../../temp/', nombreArchivo);
    
    // Crear directorio temp si no existe
    if (!fs.existsSync(path.dirname(rutaAudio))) {
      fs.mkdirSync(path.dirname(rotaAudio), { recursive: true });
    }

    let audioBuffer;

    try {
      if (config.provider === 'openai') {
        audioBuffer = await this.generateWithOpenAI(texto, idioma);
      } else {
        // Usar Google TTS como fallback
        const { execSync } = require('child_process');
        const comando = `curl -s -o "${rutaAudio}" "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${idioma}&q=${encodeURIComponent(texto)}"`;
        execSync(comando, { timeout: 10000 });
        
        if (fs.existsSync(rutaAudio)) {
          audioBuffer = fs.readFileSync(rutaAudio);
        }
      }

      if (audioBuffer) {
        fs.writeFileSync(rutaAudio, audioBuffer);
        return rutaAudio;
      }
    } catch (error) {
      console.error('Error generando audio completo:', error);
    }

    return null;
  }
};
