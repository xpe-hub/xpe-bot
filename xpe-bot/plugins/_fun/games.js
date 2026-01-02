/**
 * Plugin de Juegos - XPE Bot
 * Comandos de entretenimiento y juegos
 */

export default {
  name: 'juegos',
  category: 'fun',
  desc: 'Muestra los comandos de juegos disponibles',
  alias: ['game', 'games'],
  usage: '[]',
  cooldown: 5,
  requirePrefix: true,
  isGroup: false,
  onlyOwner: false,
  onlyAdmin: false,
  
  async execute(ctx, { args, react }) {
    try {
      const juegosMenu = `
╔══════════════════════════════════════╗
║     🎮 XPE Bot - Juegos Disponibles  ║
╠══════════════════════════════════════╣
║                                      ║
║  🎲 *dado*     - Lanzar un dado      ║
║  🎰 *tragam    - Jugar tragamuelas   ║
║  ⚽ *penales*  - Penalty shootout     ║
║  🏃 *carrera*  - Carrera de velocidad║
║  🧩 *acertijo* - Resolver acertijo   ║
║  🎯 *adivina*  - Adivina el número   ║
║  🎭 *chiste*   - Contar un chiste    ║
║  🖼️ *meme*     - Obtener un meme    ║
║  💬 *frase*    - Frase aleatoria     ║
║  🎤 *rap*      - Batalla de rap      ║
║                                      ║
║  💡 Uso: /comando                    ║
╚══════════════════════════════════════╝
      `.trim();

      await ctx.sendMessage({ text: juegosMenu });
      await react('🎮');
      return true;
    } catch (error) {
      console.error('Error en comando juegos:', error);
      await ctx.sendMessage({ text: '❌ Ocurrió un error al mostrar los juegos.' });
      return false;
    }
  }
};

// Sub-comandos de juegos exportados individualmente
export const subCommands = {
  dado: {
    name: 'dado',
    category: 'fun',
    desc: 'Lanza un dado de 6 caras',
    alias: ['dice'],
    usage: '[]',
    cooldown: 3,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { react }) {
      try {
        const resultado = Math.floor(Math.random() * 6) + 1;
        const dados = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        
        await ctx.sendMessage({
          text: `🎲 *Lanzaste el dado...*\n\nResultó en: *${resultado}* ${dados[resultado - 1]}`
        });
        await react('🎲');
        return true;
      } catch (error) {
        console.error('Error en comando dado:', error);
        await ctx.sendMessage({ text: '❌ Error al lanzar el dado.' });
        return false;
      }
    }
  },

  tragam: {
    name: 'tragam',
    category: 'fun',
    desc: 'Juega la tragamuelas',
    alias: ['slot', 'tragamueblas'],
    usage: '[]',
    cooldown: 5,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { react }) {
      try {
        const emojis = ['🍒', '🍋', '🍊', '🍇', '⭐', '🔔'];
        const rod1 = emojis[Math.floor(Math.random() * emojis.length)];
        const rod2 = emojis[Math.floor(Math.random() * emojis.length)];
        const rod3 = emojis[Math.floor(Math.random() * emojis.length)];
        
        let mensaje = `
🎰 *TRAGAMUELAS XPE* 🎰
╔═══════════════════╗
║  ${rod1} │ ${rod2} │ ${rod3}  ║
╚═══════════════════╝
      `.trim();

        // Verificar ganancia
        if (rod1 === rod2 && rod2 === rod3) {
          mensaje += '\n\n🎉 *¡JACKPOT!* ¡Felicidades!';
          await react('🎉');
        } else if (rod1 === rod2 || rod2 === rod3 || rod1 === rod3) {
          mensaje += '\n\n✨ *¡Casi lo Logras!* inténtalo de nuevo.';
          await react('✨');
        } else {
          mensaje += '\n\n😢 *Mejor suerte la próxima vez.*';
          await react('😢');
        }

        await ctx.sendMessage({ text: mensaje });
        return true;
      } catch (error) {
        console.error('Error en comando tragam:', error);
        await ctx.sendMessage({ text: '❌ Error en la tragamuela.' });
        return false;
      }
    }
  },

  penales: {
    name: 'penales',
    category: 'fun',
    desc: 'Dispara o ataja un penalty',
    alias: ['penalty', 'shootout'],
    usage: '[/penales tirer|atar]',
    cooldown: 10,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { args, react }) {
      try {
        const opcion = args[0]?.toLowerCase();
        const zonas = ['esquina_superior_izquierda', 'esquina_superior_derecha', 'centro_superior', 'esquina_inferior_izquierda', 'esquina_inferior_derecha', 'centro_inferior'];
        
        if (!opcion || (opcion !== 'tirar' && opcion !== 'atar')) {
          await ctx.sendMessage({
            text: `⚽ *PENALES*\n\n*Uso:* /penales tirar - Para disparar\n       /penales atar - Para atajar\n\n*Zonas disponibles:* Esquina arriba, Centro arriba, Esquina abajo`
          });
          return true;
        }

        const zonaPortero = zonas[Math.floor(Math.random() * zonas.length)];
        const zonaTiro = zonas[Math.floor(Math.random() * zonas.length)];
        
        let resultado = '';
        
        if (opcion === 'tirar') {
          if (zonaTiro === zonaPortero) {
            resultado = '🧤 ¡El portero atajó tu penalty! 😢';
            await react('🧤');
          } else {
            resultado = '⚽ ¡GOLAZO! ¡Anotaste! 🎉';
            await react('⚽');
          }
        } else {
          if (zonaTiro === zonaPortero) {
            resultado = '🧤 ¡Atajaste el penalty! ¡Eres un crack! 🎉';
            await react('🧤');
          } else {
            resultado = '⚽ ¡Te engañaron! ¡Te anotaron! 😢';
            await react('😢');
          }
        }

        await ctx.sendMessage({
          text: `⚽ *PENALES* ⚽\n\nTu tiro: ${zonaTiro.replace(/_/g, ' ')}\nMovimiento del portero: ${zonaPortero.replace(/_/g, ' ')}\n\n${resultado}`
        });
        return true;
      } catch (error) {
        console.error('Error en comando penales:', error);
        await ctx.sendMessage({ text: '❌ Error en el penalty.' });
        return false;
      }
    }
  },

  carrera: {
    name: 'carrera',
    category: 'fun',
    desc: 'Inicia una carrera contra el bot',
    alias: ['race', 'correr'],
    usage: '[]',
    cooldown: 15,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { react }) {
      try {
        const mensajes = [
          '🏃‍♂️ ¡LISTOS!',
          '🛑 ¡PREPARADOS!',
          '💥 ¡YA!'
        ];
        
        await ctx.sendMessage({ text: mensajes[0] });
        await new Promise(r => setTimeout(r, 1000));
        await ctx.sendMessage({ text: mensajes[1] });
        await new Promise(r => setTimeout(r, 1000));
        
        const pista = [
          '🏃', '🏃', '🏃', '🏃', '🏃', '🏃', '🏃', '🏃', '🏃', '🏁'
        ];
        const distancia = 10;
        let posJugador = 0;
        let posBot = 0;
        
        await ctx.sendMessage({ text: mensajes[2] });
        
        while (posJugador < distancia && posBot < distancia) {
          if (Math.random() > 0.5) posJugador++;
          if (Math.random() > 0.5) posBot++;
        }

        let resultado = '';
        if (posJugador >= distancia && posBot >= distancia) {
          resultado = '🤝 ¡EMPATE! ¡Qué carrera tan increíble!';
          await react('🤝');
        } else if (posJugador >= distancia) {
          resultado = '🏆 ¡GANASTE! ¡Eres rapidísimo!';
          await react('🏆');
        } else {
          resultado = '😅 ¡TE GANE! ¡Sigue intentándolo!';
          await react('😜');
        }

        const pistaJugador = '🏃'.repeat(Math.min(posJugador, 10)) + '·'.repeat(Math.max(0, 10 - posJugador));
        const pistaBot = '🤖'.repeat(Math.min(posBot, 10)) + '·'.repeat(Math.max(0, 10 - posBot));

        await ctx.sendMessage({
          text: `🏁 *CARRERA XPE* 🏁\n\nTú: ${pistaJugador} 🏁\nBot:  ${pistaBot} 🏁\n\n${resultado}`
        });
        return true;
      } catch (error) {
        console.error('Error en comando carrera:', error);
        await ctx.sendMessage({ text: '❌ Error en la carrera.' });
        return false;
      }
    }
  },

  acertijo: {
    name: 'acertijo',
    category: 'fun',
    desc: 'Responde un acertijo',
    alias: ['riddle', 'trivia'],
    usage: '[/acertijo responder respuesta]',
    cooldown: 30,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { args, react }) {
      try {
        const acertijos = [
          { pregunta: '¿Qué tiene ciudades pero no casas, montañas pero no árboles, y agua pero no peces?', respuesta: 'un mapa' },
          { pregunta: '¿Qué es lo que siempre viene pero nunca llega?', respuesta: 'mañana' },
          { pregunta: 'Tengo ciudades pero no casas. Tengo montañas pero no árboles. Tengo agua pero no peces. ¿Qué soy?', respuesta: 'un mapa' },
          { pregunta: '¿Qué tiene un ojo pero no puede ver?', respuesta: 'una aguja' },
          { pregunta: 'Mientras más secas, más húmedas. ¿Qué son?', respuesta: 'toallas' },
          { pregunta: '¿Qué sube pero nunca baja?', respuesta: 'la edad' },
          { pregunta: 'Tengo folhas pero no soy árvore. ¿Qué soy?', resposta: 'un libro' },
          { pregunta: '¿Qué pasa por todas las ciudades pero nunca se mueve?', respuesta: 'el camino' },
          { pregunta: '¿Qué tiene cuello pero no tiene cabeza?', respuesta: 'una camisa' },
          { pregunta: '¿Qué puede llenar una habitación pero no ocupa espacio?', respuesta: 'la luz' }
        ];

        const opcion = args[0]?.toLowerCase();
        
        if (opcion === 'responder' && args[1]) {
          const respuestaUsuario = args.slice(1).join(' ').toLowerCase();
          // Implementación simplificada para este ejemplo
          await ctx.sendMessage({
            text: `🧩 *ACERTIJO*\n\n¡Buen intento! La respuesta correcta era: "${acertijos[0].respuesta}"\n\nUsa /acertijo para uno nuevo.`
          });
          await react('🤔');
          return true;
        }

        const acertijo = acertijos[Math.floor(Math.random() * acertijos.length)];
        
        await ctx.sendMessage({
          text: `🧩 *ACERTIJO* 🧩\n\n${acertijo.pregunta}\n\n*Usa:* /acertijo responder [tu respuesta]`
        });
        await react('🧩');
        return true;
      } catch (error) {
        console.error('Error en comando acertijo:', error);
        await ctx.sendMessage({ text: '❌ Error con el acertijo.' });
        return false;
      }
    }
  },

  adivina: {
    name: 'adivina',
    category: 'fun',
    desc: 'Adivina un número del 1 al 100',
    alias: ['guess', 'adivinanumero'],
    usage: '[/adivina numero]',
    cooldown: 10,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { args, react }) {
      try {
        const numeroSecreto = Math.floor(Math.random() * 100) + 1;
        
        if (args[0]) {
          const intento = parseInt(args[0]);
          
          if (isNaN(intento) || intento < 1 || intento > 100) {
            await ctx.sendMessage({
              text: '❌ *Número inválido.* Ingresa un número del 1 al 100.'
            });
            return true;
          }

          let mensaje = '';
          if (intento === numeroSecreto) {
            mensaje = '🎉 *¡FELICIDADES!* ¡Adivinaste el número!';
            await react('🎉');
          } else if (intento < numeroSecreto) {
            mensaje = '📈 *Muy bajo.* Intenta con un número más alto.';
            await react('📈');
          } else {
            mensaje = '📉 *Muy alto.* Intenta con un número más bajo.';
            await react('📉');
          }

          await ctx.sendMessage({
            text: `🎯 *ADIVINA EL NÚMERO* 🎯\n\nTu número: ${intento}\n${mensaje}\n\n(El número secreto era: ${numeroSecreto})`
          });
          return true;
        }

        await ctx.sendMessage({
          text: `🎯 *ADIVINA EL NÚMERO* 🎯\n\n*XPE Bot* pensó en un número del 1 al 100.\n\n*Usa:* /adivina [número]`
        });
        await react('🎯');
        return true;
      } catch (error) {
        console.error('Error en comando adivina:', error);
        await ctx.sendMessage({ text: '❌ Error en el juego.' });
        return false;
      }
    }
  },

  chiste: {
    name: 'chiste',
    category: 'fun',
    desc: 'Cuenta un chiste aleatorio',
    alias: ['joke', 'chistes'],
    usage: '[]',
    cooldown: 15,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { react }) {
      try {
        const chistes = [
          { setup: '¿Por qué el libro de matemáticas estaba triste?', punchline: 'Porque tenía muchos problemas. 📚' },
          { setup: '¿Qué le dice un jaguar a otro?', punchline: 'Jaguar you? 🐆' },
          { setup: '¿Cómo se dice pañuelo en japonés?', punchline: 'Saka-moko. 🤧' },
          { setup: '¿Qué hace una abeja en el gimnasio?', punchline: 'Zum-ba. 🐝' },
          { setup: '¿Por qué el programador dejó el trabajo?', punchline: 'Porque no get arrays. 💻' },
          { setup: '¿Qué le dijo el 0 al 8?', punchline: '¡Bonito cinturón! 🎀' },
          { setup: '¿Cómo se llama el pan del boyfriend?', punchline: 'Novio bread. 🍞' },
          { setup: '¿Qué hace un perro con un taladro?', punchline: 'Taladrando. 🐕' },
          { setup: '¿Cuál es el cereal más musculoso?', punchline: 'El güeraaaa. 🥣' },
          { setup: '¿Qué le dijo el router al técnico?', punchline: 'Ya me canse de este pedo, necesito un descanso. 📶' }
        ];

        const chiste = chistes[Math.floor(Math.random() * chistes.length)];
        
        await ctx.sendMessage({
          text: `😂 *CHISTE DEL DÍA* 😂\n\n${chiste.setup}\n\n${chiste.punchline}`
        });
        await react('😂');
        return true;
      } catch (error) {
        console.error('Error en comando chiste:', error);
        await ctx.sendMessage({ text: '❌ Error al contar el chiste.' });
        return false;
      }
    }
  },

  meme: {
    name: 'meme',
    category: 'fun',
    desc: 'Envía un meme aleatorio',
    alias: ['memes'],
    usage: '[]',
    cooldown: 10,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { react }) {
      try {
        const memes = [
          'https://i.imgflip.com/1g8my4.jpg',
          'https://i.imgflip.com/1h7in3.jpg',
          'https://i.imgflip.com/261o3j.jpg',
          'https://i.imgflip.com/1ur9b0.jpg',
          'https://i.imgflip.com/30b1gx.jpg'
        ];

        const memeAleatorio = memes[Math.floor(Math.random() * memes.length)];
        
        await ctx.sendMessage({
          image: { url: memeAleatorio },
          caption: '😂 *MEME ALEATORIO* 😂'
        });
        await react('😂');
        return true;
      } catch (error) {
        console.error('Error en comando meme:', error);
        await ctx.sendMessage({ text: '❌ Error al obtener el meme.' });
        return false;
      }
    }
  },

  frase: {
    name: 'frase',
    category: 'fun',
    desc: 'Envía una frase motivacional',
    alias: ['quote', 'frases'],
    usage: '[]',
    cooldown: 10,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { react }) {
      try {
        const frases = [
          { texto: 'El éxito es la suma de pequeños esfuerzos repetidos día tras día.', autor: 'Robert Collier' },
          { texto: 'No importa cuán lento vayas, siempre y cuando no te detengas.', autor: 'Confucio' },
          { texto: 'El futuro pertenece a quienes creen en la belleza de sus sueños.', autor: 'Eleanor Roosevelt' },
          { texto: 'La única forma de hacer un trabajo genial es amar lo que haces.', autor: 'Steve Jobs' },
          { texto: 'No tienes que ser grande para empezar, pero tienes que empezar para ser grande.', autor: 'Les Brown' },
          { texto: 'Los límites solo existen si tú los permites.', autor: 'Anónimo' },
          { texto: 'Cada día es una nueva oportunidad para cambiar tu vida.', autor: 'Anónimo' },
          { texto: 'No te des por vencido, ni aun mal, pues en las más crudas dificultades nacen las más sutiles soluciones.', autor: 'Anónimo' }
        ];

        const frase = frases[Math.floor(Math.random() * frases.length)];
        
        await ctx.sendMessage({
          text: `💬 *FRASE DEL DÍA* 💬\n\n"${frase.texto}"\n\n— *${frase.autor}*`
        });
        await react('💬');
        return true;
      } catch (error) {
        console.error('Error en comando frase:', error);
        await ctx.sendMessage({ text: '❌ Error al obtener la frase.' });
        return false;
      }
    }
  },

  rap: {
    name: 'rap',
    category: 'fun',
    desc: 'Inicia una batalla de rap',
    alias: ['battle', 'freestyle'],
    usage: '[/rap empezar]',
    cooldown: 20,
    requirePrefix: true,
    isGroup: false,
    onlyOwner: false,
    onlyAdmin: false,
    
    async execute(ctx, { args, react }) {
      try {
        const opcion = args[0]?.toLowerCase();
        
        if (opcion === 'empezar') {
          const versosBot = [
            'Ey, soy XPE Bot, el king del chat, respondo más rápido que un rayo, sin ningún estrés.',
            'Tengo la inteligencia, el flow y la chispa, soy el mejor bot que hayas visto en tu vida.',
            'Puedo hacer stickers, responder preguntas, y hasta contar chistes, soy multi-tareas.',
            'En este grupo soy el amo y señor, XPE Bot ruling, no hay discusión.'
          ];

          const versoAleatorio = versosBot[Math.floor(Math.random() * versosBot.length)];
          
          await ctx.sendMessage({
            text: `🎤 *BATALLA DE RAP - XPE BOT* 🎤\n\n${versoAleatorio}\n\n🔥 *¡Es tu turno! Responde con un verso.*`
          });
          await react('🔥');
          return true;
        }

        await ctx.sendMessage({
          text: `🎤 *BATALLA DE RAP* 🎤\n\n*XPE Bot* te reta a un freestyle.\n\n*Usa:* /rap empezar - Para comenzar la batalla`
        });
        await react('🎤');
        return true;
      } catch (error) {
        console.error('Error en comando rap:', error);
        await ctx.sendMessage({ text: '❌ Error en la batalla de rap.' });
        return false;
      }
    }
  }
};
