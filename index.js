const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, PermissionFlagsBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const dotenv = require('dotenv');
const storage = require('./server/storage');
const { searchItemByPartialName, searchItemByPartialNameSync } = require('./utils/itemSearch');

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const PREFIX = '*';
const DEFAULT_TICKET_ROLE = 'Ticket';
const DEFAULT_PULL_TIMER = 11500;

const pendingConfirmations = new Map();
const spinCooldowns = new Map();

client.on('clientReady', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  await storage.ensureDataFiles();

  const commands = [
    new SlashCommandBuilder()
      .setName('oye')
      .setDescription('Oye')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('spin')
      .setDescription('🎰 Realizar una tirada del gacha')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('spin10')
      .setDescription('🎰 Realizar 10 tiradas del gacha')
      .toJSON()
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('🔄 Registrando comandos slash...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Comandos slash registrados: /oye, /spin, /spin10');
  } catch (error) {
    console.error('❌ Error registrando comandos slash:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'oye') {
      await interaction.reply({
        content: 'https://tenor.com/view/bokunorhythem-otama-eyecomova-gif-23829255'
      });
    } else if (interaction.commandName === 'spin') {
      await handleGirarSlash(interaction);
    } else if (interaction.commandName === 'spin10') {
      await handleGirar10Slash(interaction);
    }
  } catch (error) {
    console.error('Error en slash command:', error);
    const errorMsg = '❌ Ocurrió un error al ejecutar el comando.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMsg, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMsg, ephemeral: true });
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  try {
    if (command === 'spin') {
      await handleGirar(message);
    } else if (command === 'spin10') {
      await handleGirar10(message);
    } else if (command === 'banner') {
      await handleBanner(message);
    } else if (command === 'createitem') {
      await handleCreateItem(message, args);
    } else if (command === 'edititem') {
      await handleEditItem(message, args);
    } else if (command === 'deleteitem') {
      await handleDeleteItem(message, args);
    } else if (command === 'resetitems') {
      await handleResetItems(message);
    } else if (command === 'iteminfo') {
      await handleItemInfo(message, args);
    } else if (command === 'canjear') {
      await handleExchange(message, args);
    } else if (command === 'tokens') {
      await handleTokens(message);
    } else if (command === 'createexchange') {
      await handleCreateExchange(message, args);
    } else if (command === 'listexchanges') {
      await handleListExchanges(message);
    } else if (command === 'setticketrole') {
      await handleSetTicketRole(message, args);
    } else if (command === 'setticketrole10') {
      await handleSetTicketRole10(message, args);
    } else if (command === 'editpull') {
      await handleEditPull(message, args);
    } else if (command === 'editpullssr') {
      await handleEditPullSSR(message, args);
    } else if (command === 'editpulltimer') {
      await handleEditPullTimer(message, args);
    } else if (command === 'help') {
      await handleHelp(message);
    } else if (command === 'fixhelp') {
      await handleFixHelp(message);
    } else if (command === 'editexchange') {
      await handleEditExchange(message, args);
    } else if (command === 'resetexchanges') {
      await handleResetExchanges(message);
    } else if (command === 'addtokens') {
      await handleAddTokens(message, args);
    } else if (command === 'removetokens') {
      await handleRemoveTokens(message, args);
    } else if (command === 'resettokens') {
      await handleResetTokens(message);
    } else if (command === 'confirmar' || command === 'confirm') {
      await handleConfirm(message);
    } else if (command === 'cancelar' || command === 'cancel') {
      await handleCancel(message);
    } else if (command === 'pity') {
      await handlePityInfo(message);
    } else if (command === 'setcurrency') {
      await handleSetCurrency(message, args);
    } else if (command === 'createitemsecret') {
      await handleCreateItemSecret(message, args);
    } else if (command === 'secretbanner') {
      await handleSecretBanner(message);
    } else if (command === 'inventory') {
      await handleInventory(message);
    } else if (command === 'resetcollectable') {
      await handleResetCollectable(message, args);
    } else if (command === 'editpity') {
      await handleEditPity(message, args);
    }
  } catch (error) {
    console.error('Error:', error);
    message.reply('❌ Ocurrió un error al ejecutar el comando.');
  }
});

async function handleGirar(message) {
  const member = message.member;
  const guildId = message.guild?.id;
  if (!member || !guildId) return;

  // Verificar si hay una tirada en curso
  const cooldownKey = `${guildId}-${message.author.id}`;
  if (spinCooldowns.has(cooldownKey)) {
    const timeLeft = spinCooldowns.get(cooldownKey) - Date.now();
    if (timeLeft > 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎰 Tirada en Curso')
        .setDescription(`Ya tienes una tirada activa.\n\n⏱️ Podrás hacer otra tirada en **${Math.ceil(timeLeft / 1000)}** segundos.`)
        .setFooter({ text: 'Espera a que termine tu tirada actual' });
      return message.reply({ embeds: [embed] });
    }
    spinCooldowns.delete(cooldownKey);
  }

  let ticketRole = await storage.getConfig(guildId, 'ticket_role') || DEFAULT_TICKET_ROLE;

  const mentionMatch = ticketRole.match(/<@&(\d+)>/);
  if (mentionMatch) {
    ticketRole = mentionMatch[1];
  }

  const hasTicket = member.roles.cache.some((role) =>
    role.name.toLowerCase() === ticketRole.toLowerCase() || role.id === ticketRole
  );

  if (!hasTicket) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Sin Ticket')
      .setDescription(`No tienes el ticket necesario para hacer un spin.\n\nCompra un ticket en <@292953664492929025> para poder jugar.`);
    return message.reply({ embeds: [embed] });
  }

  // Activar cooldown de 5 segundos
  const cooldownTime = 5000; // 5 segundos fijos
  spinCooldowns.set(cooldownKey, Date.now() + cooldownTime);
  setTimeout(() => spinCooldowns.delete(cooldownKey), cooldownTime);

  // Esperar 1 segundo antes de quitar el rol (para evitar errores)
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Quitar el rol después de 1 segundo
  const ticketRoleToRemove = member.roles.cache.find((role) =>
    role.name.toLowerCase() === ticketRole.toLowerCase() || role.id === ticketRole
  );

  if (ticketRoleToRemove) {
    try {
      await member.roles.remove(ticketRoleToRemove);
      console.log(`✅ Ticket "${ticketRoleToRemove.name}" removido (con delay de 1s)`);
    } catch (error) {
      console.error(`❌ Error al remover ticket "${ticketRoleToRemove.name}":`, error.message);
      
      if (error.code === 50001) {
        const warningEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('⚠️ No se pudo remover el ticket')
          .setDescription(`El bot no tiene permisos para remover el rol **${ticketRoleToRemove.name}**.\n\n**Solución:** Asegúrate de que el rol del bot esté por encima de este rol en la jerarquía del servidor.`);
        await message.reply({ embeds: [warningEmbed] });
        return; // Detener el spin si no se puede quitar el ticket
      }
    }
  }

  const item = await storage.getRandomItemWithPity(guildId, message.author.id);

  if (!item) {
    return message.reply('❌ No hay premios configurados en el gacha.');
  }

  const isSSRorPromo = item.rarity.toUpperCase() === 'SSR' || item.promo;
  const gifToShow = isSSRorPromo
    ? await storage.getConfig(guildId, 'ssr_gif')
    : await storage.getConfig(guildId, 'pity_gif');

  if (gifToShow) {
    const pullTimer = await storage.getConfig(guildId, 'pull_timer') || DEFAULT_PULL_TIMER;

    const loadingEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🌟 Realizando tirada...')
      .setImage(gifToShow);

    const loadingMessage = await message.reply({ embeds: [loadingEmbed] });

    await new Promise(resolve => setTimeout(resolve, pullTimer));

    await loadingMessage.delete();
  }

  let hasRoleGiven = false;

  if (item.roleGiven) {
    let roleToCheck = message.guild?.roles.cache.find((r) => r.name === item.roleGiven);

    if (!roleToCheck) {
      const roleMentionMatch = item.roleGiven?.match(/<@&(\d+)>/);
      if (roleMentionMatch) {
        roleToCheck = message.guild?.roles.cache.get(roleMentionMatch[1]);
      }
    }

    if (!roleToCheck && item.roleGiven) {
      roleToCheck = message.guild?.roles.cache.get(item.roleGiven);
    }

    if (roleToCheck) {
      hasRoleGiven = member.roles.cache.has(roleToCheck.id);
    }
  }

  const isDuplicate = hasRoleGiven;
  const embedColor = item.secret ? 0x8B0000 : storage.getRarityColor(item.rarity);
  const objectType = item.objectType || 'personaje';

  const collectables = await storage.getUserCollectables(guildId, message.author.id);
  const currentCount = collectables[item.name] || 0;
  const isCollectable = item.collectable && item.collectable > 0;

  let replyToUse = item.reply;
  if (isCollectable && (item.replyCollectable1 || item.replyCollectable2 || item.replyCollectable3)) {
    const collectableReplies = [item.replyCollectable1, item.replyCollectable2, item.replyCollectable3].filter(r => r);
    if (collectableReplies.length > 0) {
      replyToUse = collectableReplies[Math.floor(Math.random() * collectableReplies.length)];
    }
  }

  const isUrl = replyToUse?.match(/^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i);

  if ((isDuplicate && item.giveTokens) || (objectType === 'persona' && item.giveTokens)) {
    const tokenEmoji = await storage.getTokenEmoji(item.rarity);
    const tokenType = `Token ${item.rarity.toUpperCase()}`;
    await storage.addTokens(guildId, message.author.id, tokenType, 1);

    const rarityStars = storage.getRarityStars(item.rarity);

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle(`🔄 ¡${objectType.charAt(0).toUpperCase() + objectType.slice(1)} Duplicado!`)
      .addFields(
        { name: objectType.charAt(0).toUpperCase() + objectType.slice(1), value: item.name, inline: true },
        { name: 'Rareza', value: rarityStars, inline: true },
        { name: '<:Dupe:1425315638959673384> Tokens', value: `+1 ${tokenEmoji}`, inline: true }
      )
      .setFooter({ text: `Ya tenías este ${objectType}, recibiste Tokens` });

    if (isUrl) {
      embed.setImage(replyToUse);
    }

    await message.reply({ embeds: [embed] });
  } else {
    const rarityStars = storage.getRarityStars(item.rarity);

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(item.secret ? `🔒 ¡${objectType.charAt(0).toUpperCase() + objectType.slice(1)} Secreto Obtenido!` : `🎉 ¡Nuevo ${objectType.charAt(0).toUpperCase() + objectType.slice(1)} Obtenido!`)
      .addFields(
        { name: objectType.charAt(0).toUpperCase() + objectType.slice(1), value: item.name, inline: true },
        { name: 'Rareza', value: rarityStars, inline: true }
      );

    if (item.secret) {
      embed.setDescription('🔒 ¡Has conseguido un personaje secreto!');
    }

    if (isCollectable) {
      const remaining = item.collectable - currentCount;
      embed.addFields({ name: '📦 Coleccionable', value: `${currentCount}/${item.collectable} (Faltan ${remaining})`, inline: false });

      if (currentCount >= item.collectable && item.roleGiven) {
        embed.addFields({ name: '✅ Completado', value: `Rol asignado: ${item.roleGiven}`, inline: false });
      }
    }

    embed.setFooter({ text: item.secret ? '¡Has desbloqueado un secreto!' : `¡Felicidades por tu nuevo ${objectType}!` });

    if (isUrl) {
      embed.setImage(replyToUse);
    }

    await message.reply({ embeds: [embed] });

    if (item.roleGiven) {
      const shouldGiveRole = !isCollectable || currentCount >= item.collectable;

      if (shouldGiveRole) {
        let roleToGive = message.guild?.roles.cache.find((r) => r.name === item.roleGiven);

        if (!roleToGive) {
          const roleMentionMatch = item.roleGiven?.match(/<@&(\d+)>/);
          if (roleMentionMatch) {
            roleToGive = message.guild?.roles.cache.get(roleMentionMatch[1]);
          }
        }

        if (!roleToGive && item.roleGiven) {
          roleToGive = message.guild?.roles.cache.get(item.roleGiven);
        }

        if (roleToGive) {
          try {
            await member.roles.add(roleToGive);
            console.log(`✅ Rol "${roleToGive.name}" asignado exitosamente a ${message.author.tag}`);
          } catch (error) {
            console.error(`❌ Error al asignar rol "${roleToGive.name}":`, error.message);
          }
        } else {
          console.log(`⚠️ No se encontró el rol "${item.roleGiven}" en el servidor`);
        }
      }
    }
  }
}

async function handleGirar10(message) {
  const member = message.member;
  const guildId = message.guild?.id;
  if (!member || !guildId) return;

  let ticketRole10 = await storage.getConfig(guildId, 'ticket_role_10') || 'Ticket x10';

  const mentionMatch = ticketRole10.match(/<@&(\d+)>/);
  if (mentionMatch) {
    ticketRole10 = mentionMatch[1];
  }

  const hasTicket10 = member.roles.cache.some((role) =>
    role.name.toLowerCase() === ticketRole10.toLowerCase() || role.id === ticketRole10
  );

  if (!hasTicket10) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Sin Ticket x10')
      .setDescription(`No tienes el ticket necesario para hacer 10 spins.\n\nCompra un ticket x10 en <@292953664492929025> para poder jugar.`);
    return message.reply({ embeds: [embed] });
  }

  // Esperar 1 segundo antes de quitar el rol (para evitar errores)
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Quitar el rol después de 1 segundo
  const ticketRoleToRemove = member.roles.cache.find((role) =>
    role.name.toLowerCase() === ticketRole10.toLowerCase() || role.id === ticketRole10
  );

  if (ticketRoleToRemove) {
    try {
      await member.roles.remove(ticketRoleToRemove);
      console.log(`✅ Ticket x10 "${ticketRoleToRemove.name}" removido (con delay de 1s)`);
    } catch (error) {
      console.error(`❌ Error al remover ticket x10:`, error.message);
      
      if (error.code === 50001) {
        const warningEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('⚠️ No se pudo remover el ticket')
          .setDescription(`El bot no tiene permisos para remover el rol **${ticketRoleToRemove.name}**.\n\n**Solución:** Asegúrate de que el rol del bot esté por encima de este rol en la jerarquía del servidor.`);
        await message.reply({ embeds: [warningEmbed] });
        return; // Detener el spin si no se puede quitar el ticket
      }
    }
  }

  const results = [];

  for (let i = 0; i < 10; i++) {
    const item = await storage.getRandomItemWithPity(guildId, message.author.id);
    if (!item) continue;

    let hasRoleGiven = false;

    if (item.roleGiven) {
      let roleToCheck = message.guild?.roles.cache.find((r) => r.name === item.roleGiven);

      if (!roleToCheck) {
        const roleMentionMatch = item.roleGiven?.match(/<@&(\d+)>/);
        if (roleMentionMatch) {
          roleToCheck = message.guild?.roles.cache.get(roleMentionMatch[1]);
        }
      }

      if (!roleToCheck && item.roleGiven) {
        roleToCheck = message.guild?.roles.cache.get(item.roleGiven);
      }

      if (roleToCheck) {
        hasRoleGiven = member.roles.cache.has(roleToCheck.id);
      }
    }

    const isDuplicate = hasRoleGiven;
    const objectType = item.objectType || 'personaje';

    if (isDuplicate || (objectType === 'persona' && item.giveTokens)) {
      const tokenType = `Token ${item.rarity.toUpperCase()}`;
      await storage.addTokens(guildId, message.author.id, tokenType, 1);
    } else if (!isDuplicate && item.roleGiven) {
      let roleToGive = message.guild?.roles.cache.find((r) => r.name === item.roleGiven);

      if (!roleToGive) {
        const roleMentionMatch = item.roleGiven?.match(/<@&(\d+)>/);
        if (roleMentionMatch) {
          roleToGive = message.guild?.roles.cache.get(roleMentionMatch[1]);
        }
      }

      if (!roleToGive && item.roleGiven) {
        roleToGive = message.guild?.roles.cache.get(item.roleGiven);
      }

      if (roleToGive && !member.roles.cache.has(roleToGive.id)) {
        try {
          await member.roles.add(roleToGive);
        } catch (error) {
          console.error(`❌ Error al asignar rol "${roleToGive.name}":`, error.message);
        }
      }
    }

    results.push({ item, isDuplicate });
  }

  const rarityPriority = { 'SSR': 1, 'SR': 2, 'UR': 3, 'R': 4 };
  const hasPromo = results.some(r => r.item.promo);
  const highestRarity = results.reduce((highest, current) => {
    const currentPriority = rarityPriority[current.item.rarity.toUpperCase()] || 999;
    const highestPriority = rarityPriority[highest.toUpperCase()] || 999;
    return currentPriority < highestPriority ? current.item.rarity : highest;
  }, 'R');

  const isSSRorPromo = highestRarity.toUpperCase() === 'SSR' || hasPromo;
  const gifToShow = isSSRorPromo
    ? await storage.getConfig(guildId, 'ssr_gif')
    : await storage.getConfig(guildId, 'pity_gif');

  if (gifToShow) {
    const pullTimer = await storage.getConfig(guildId, 'pull_timer') || DEFAULT_PULL_TIMER;

    const loadingEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🌟 Realizando 10 tiradas...')
      .setImage(gifToShow);

    const loadingMessage = await message.reply({ embeds: [loadingEmbed] });
    await new Promise(resolve => setTimeout(resolve, pullTimer));
    await loadingMessage.delete();
  }

  const groupedResults = {};

  results.forEach(({ item, isDuplicate }) => {
    if (!groupedResults[item.name]) {
      groupedResults[item.name] = { count: 0, isDuplicate, rarity: item.rarity };
    }
    groupedResults[item.name].count++;
  });

  const bestItems = results.filter(r => r.item.rarity === highestRarity);
  const randomBestItem = bestItems[Math.floor(Math.random() * bestItems.length)].item;

  const isUrl = randomBestItem.reply.match(/^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i);

  if (isUrl) {
    const bestItemEmbed = new EmbedBuilder()
      .setColor(storage.getRarityColor(randomBestItem.rarity))
      .setTitle(`✨ ¡${randomBestItem.name}!`)
      .setDescription(`${storage.getRarityStars(randomBestItem.rarity)} - Tu mejor premio de estas 10 tiradas`)
      .setImage(randomBestItem.reply);

    await message.reply({ embeds: [bestItemEmbed] });

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎉 Resultados de 10 Giros')
    .setDescription(`${message.author.username}, aquí están tus resultados:`);

  Object.entries(groupedResults).forEach(([name, data]) => {
    const rarityStars = storage.getRarityStars(data.rarity);
    const status = data.isDuplicate ? '🔄 Duplicado' : '✨ Nuevo';
    embed.addFields({
      name: `${rarityStars} ${name}`,
      value: `${status} - Obtenido **${data.count}x**`,
      inline: false
    });
  });

  await message.reply({ embeds: [embed] });
}

async function handleBanner(message) {
  const guildId = message.guild?.id;
  if (!guildId) return;
  const allItems = await storage.getAllItems(guildId);

  const items = allItems.filter(item => !item.secret);

  if (items.length === 0) {
    if (message.channel.isSendable()) {
      return message.channel.send('❌ No hay premios configurados en el gacha.');
    }
    return;
  }

  const totalChance = items.reduce((sum, item) => sum + item.chance, 0);
  const guild = message.guild;

  const rarityOrder = ['SSR', 'SR', 'UR', 'R'];
  const sortedItems = [...items].sort((a, b) => {
    const rarityDiff = rarityOrder.indexOf(a.rarity.toUpperCase()) - rarityOrder.indexOf(b.rarity.toUpperCase());
    if (rarityDiff !== 0) return rarityDiff;
    return a.name.localeCompare(b.name);
  });

  const rarityConfig = {
    'SSR': { stars: storage.getRarityStars('SSR'), name: await storage.getTokenEmoji('SSR'), color: 0xFFD700 },
    'SR': { stars: storage.getRarityStars('SR'), name: await storage.getTokenEmoji('SR'), color: 0xA020F0 },
    'UR': { stars: storage.getRarityStars('UR'), name: await storage.getTokenEmoji('UR'), color: 0x3498DB },
    'R': { stars: storage.getRarityStars('R'), name: await storage.getTokenEmoji('R'), color: 0x2ECC71 }
  };

  const itemsByRarity = {
    'SSR': [],
    'SR': [],
    'UR': [],
    'R': []
  };

  sortedItems.forEach(item => {
    const rarity = item.rarity.toUpperCase();
    if (itemsByRarity[rarity]) {
      itemsByRarity[rarity].push(item);
    }
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name: `${guild?.name || 'Server'} Banner`,
      iconURL: guild?.iconURL() || undefined
    })
    .setTitle('<:dogsuke:1425324917854834708> Premios del Banner <:dogsuke:1425324917854834708>')
    .setDescription('◆━━━━━━━━━✪━━━━━━━━━◆');

  let totalPercentageCheck = 0;

  rarityOrder.forEach(rarityKey => {
    const itemsInRarity = itemsByRarity[rarityKey];
    if (itemsInRarity.length === 0) return;

    const config = rarityConfig[rarityKey];
    let rarityList = '';
    let rarityTotal = 0;

    itemsInRarity.forEach((item) => {
      const percentage = ((item.chance / totalChance) * 100).toFixed(2);
      rarityTotal += parseFloat(percentage);
      const promoMarker = item.promo ? '⭐' : '';
      rarityList += `${percentage}% — **${item.name}** ${promoMarker}\n`;
    });

    totalPercentageCheck += rarityTotal;

    embed.addFields({
      name: `${config.stars} ${config.name} (${rarityTotal.toFixed(2)}%)`,
      value: rarityList || 'Sin items',
      inline: false
    });
  });

  if (message.channel.isSendable()) {
    await message.channel.send({ embeds: [embed] });
  }
}

async function handleCreateItem(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 1) {
    return message.reply('❌ Uso: `*createitem <nombre con espacios>`\n\nEjemplo: `*createitem Joker Premium`\n\nDespués configura con `*edititem` los campos: chance, rarity, reply, tokens, role-given, object, promo');
  }

  const name = args.join(' ');
  const guildId = message.guild?.id;
  if (!guildId) return;

  await storage.createItem(guildId, name, 1, 'R', 'Premio obtenido');

  const embed = new EmbedBuilder()
    .setColor(storage.getRarityColor('R'))
    .setTitle('✅ Premio Creado')
    .setDescription(`El premio **${name}** ha sido creado con valores por defecto.`)
    .addFields(
      { name: 'Nombre', value: name, inline: true },
      { name: 'Rareza', value: storage.getRarityStars('R') + ' (por defecto)', inline: true },
      { name: 'Probabilidad', value: '1 (por defecto)', inline: true },
      { name: 'Siguiente Paso', value: `Configura los campos con:\n\`*edititem <nombre> chance 10\`\n\`*edititem <nombre> rarity SSR\` (SSR=5★, SR=4★, UR=3★, R=2★)\n\`*edititem <nombre> reply url o texto\`\n\`*edititem <nombre> tokens si\`\n\`*edititem <nombre> role-given NombreRol\`\n\`*edititem <nombre> object persona\`\n\`*edititem <nombre> promo true\``, inline: false }
    );

  if (message.channel.isSendable()) {
    await message.channel.send({ embeds: [embed] });
  }
}

async function handleCreateItemSecret(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 1) {
    return message.reply('❌ Uso: `*createitemsecret <nombre con espacios>`\n\nEjemplo: `*createitemsecret Johnny Secreto`\n\nDespués configura con `*edititem` los campos: chance, rarity, reply, tokens, role-given, object, promo');
  }

  const name = args.join(' ');
  const guildId = message.guild?.id;
  if (!guildId) return;

  await storage.createItem(guildId, name, 1, 'R', 'Premio secreto obtenido', true);

  const embed = new EmbedBuilder()
    .setColor(0x8B0000)
    .setTitle('🔒 Personaje Secreto Creado')
    .setDescription(`El personaje secreto **${name}** ha sido creado.`)
    .addFields(
      { name: 'Nombre', value: name, inline: true },
      { name: 'Rareza', value: storage.getRarityStars('R') + ' (por defecto)', inline: true },
      { name: 'Probabilidad', value: '1 (por defecto)', inline: true },
      { name: '🔒 Secreto', value: 'Este personaje NO aparece en el banner público', inline: false },
      { name: 'Siguiente Paso', value: `Configura los campos con:\n\`*edititem ${name} chance 10\`\n\`*edititem ${name} rarity SSR\`\n\`*edititem ${name} reply url o texto\`\n\`*edititem ${name} tokens si\`\n\`*edititem ${name} role-given NombreRol\`\n\`*edititem ${name} object persona\`\n\`*edititem ${name} promo true\``, inline: false }
    )
    .setFooter({ text: 'Usa *secretbanner para ver todos los personajes secretos' });

  if (message.channel.isSendable()) {
    await message.channel.send({ embeds: [embed] });
  }
}

async function handleSecretBanner(message) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  const guildId = message.guild?.id;
  if (!guildId) return;

  const allItems = await storage.getAllItems(guildId);
  const secretItems = allItems.filter(item => item.secret);

  if (secretItems.length === 0) {
    return message.reply('❌ No hay personajes secretos configurados.');
  }

  const totalChance = secretItems.reduce((sum, item) => sum + item.chance, 0);
  const guild = message.guild;

  const rarityOrder = ['SSR', 'SR', 'UR', 'R'];
  const sortedItems = [...secretItems].sort((a, b) => {
    const rarityDiff = rarityOrder.indexOf(a.rarity.toUpperCase()) - rarityOrder.indexOf(b.rarity.toUpperCase());
    if (rarityDiff !== 0) return rarityDiff;
    return a.name.localeCompare(b.name);
  });

  const rarityConfig = {
    'SSR': { stars: storage.getRarityStars('SSR'), name: await storage.getTokenEmoji('SSR'), color: 0xFFD700 },
    'SR': { stars: storage.getRarityStars('SR'), name: await storage.getTokenEmoji('SR'), color: 0xA020F0 },
    'UR': { stars: storage.getRarityStars('UR'), name: await storage.getTokenEmoji('UR'), color: 0x3498DB },
    'R': { stars: storage.getRarityStars('R'), name: await storage.getTokenEmoji('R'), color: 0x2ECC71 }
  };

  const itemsByRarity = {
    'SSR': [],
    'SR': [],
    'UR': [],
    'R': []
  };

  sortedItems.forEach(item => {
    const rarity = item.rarity.toUpperCase();
    if (itemsByRarity[rarity]) {
      itemsByRarity[rarity].push(item);
    }
  });

  const embed = new EmbedBuilder()
    .setColor(0x8B0000)
    .setAuthor({
      name: `${guild?.name || 'Server'} Banner Secreto`,
      iconURL: guild?.iconURL() || undefined
    })
    .setTitle('🔒 Personajes Secretos 🔒')
    .setDescription('◆━━━━━━━━━✪━━━━━━━━━◆\nEstos personajes NO aparecen en el banner público');

  rarityOrder.forEach(rarityKey => {
    const itemsInRarity = itemsByRarity[rarityKey];
    if (itemsInRarity.length === 0) return;

    const config = rarityConfig[rarityKey];
    let rarityList = '';
    let rarityTotal = 0;

    itemsInRarity.forEach((item) => {
      const percentage = ((item.chance / totalChance) * 100).toFixed(2);
      rarityTotal += parseFloat(percentage);
      const promoMarker = item.promo ? '⭐' : '';
      rarityList += `${percentage}% — **${item.name}** ${promoMarker}\n`;
    });

    embed.addFields({
      name: `${config.stars} ${config.name} (${rarityTotal.toFixed(2)}%)`,
      value: rarityList || 'Sin items',
      inline: false
    });
  });

  if (message.channel.isSendable()) {
    await message.channel.send({ embeds: [embed] });
  }
}

async function handleEditItem(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (!message.channel.isSendable()) return;

  if (args.length < 2) {
    return message.channel.send('❌ Uso: `*edititem <nombre> <campo> <valor...>`\n**Campos:** chance, rarity, reply, tokens, role-given, object, promo, secret, collectable\n\nEjemplos:\n`*edititem Joker rarity SSR`\n`*edititem Joker chance 5`\n`*edititem Joker reply https://imagen.gif`\n`*edititem Joker tokens si`\n`*edititem Joker role-given @NombreRol`\n`*edititem Joker promo true`\n`*edititem Joker secret true`\n`*edititem "Cuerpo Santo" collectable 5`');
  }

  let itemName;
  let field;
  let valueArgs;

  if (args[0].startsWith('"')) {
    const endQuoteIndex = args.findIndex((arg, i) => i > 0 && arg.endsWith('"'));
    if (endQuoteIndex === -1) {
      return message.channel.send('❌ Falta comillas de cierre en el nombre del item.');
    }

    itemName = args.slice(0, endQuoteIndex + 1).join(' ').replace(/^"|"$/g, '');
    field = args[endQuoteIndex + 1]?.toLowerCase();
    valueArgs = args.slice(endQuoteIndex + 2);
  } else {
    itemName = args[0];
    field = args[1]?.toLowerCase();
    valueArgs = args.slice(2);
  }

  const guildId = message.guild?.id;
  if (!guildId) return;

  const allItems = await storage.getAllItems(guildId);
  const item = await searchItemByPartialName(allItems, itemName);

  if (!item) {
    return message.channel.send(`❌ No se encontró el premio **${itemName}**.`);
  }

  if (field === 'chance') {
    const chance = parseInt(valueArgs[0]);
    if (isNaN(chance) || chance <= 0) {
      return message.channel.send('❌ La probabilidad debe ser un número mayor a 0.');
    }

    await storage.updateItem(guildId, item.name, 'chance', chance);
    return message.channel.send(`✅ Probabilidad del premio **${item.name}** actualizada a **${chance}**.`);

  } else if (field === 'rarity') {
    const rarity = valueArgs[0]?.toUpperCase();
    const validRarities = ['SSR', 'SR', 'UR', 'R'];

    if (!validRarities.includes(rarity)) {
      return message.channel.send(`❌ Rareza inválida. Usa: SSR (5★), SR (4★), UR (3★), o R (2★)`);
    }

    await storage.updateItem(guildId, item.name, 'rarity', rarity);

    const embed = new EmbedBuilder()
      .setColor(storage.getRarityColor(rarity))
      .setTitle('✅ Rareza Actualizada')
      .setDescription(`La rareza del premio **${item.name}** ha sido actualizada.`)
      .addFields({ name: 'Nueva Rareza', value: storage.getRarityStars(rarity), inline: false });

    return message.channel.send({ embeds: [embed] });

  } else if (field === 'reply') {
    const reply = valueArgs.join(' ');
    if (!reply) {
      return message.channel.send('❌ Debes proporcionar una URL o texto de respuesta.');
    }

    await storage.updateItem(guildId, item.name, 'reply', reply);
    return message.channel.send(`✅ Respuesta del premio **${item.name}** actualizada.`);

  } else if (field === 'tokens') {
    const value = valueArgs[0]?.toLowerCase();
    const giveTokens = value === 'si' || value === 'yes' || value === 'true';

    await storage.updateItem(guildId, item.name, 'giveTokens', giveTokens);
    return message.channel.send(`✅ El premio **${item.name}** ${giveTokens ? 'ahora da' : 'ya no da'} Tokens al duplicarse.`);

  } else if (field === 'role-given' || field === 'role') {
    const roleName = valueArgs.join(' ');

    if (!roleName) {
      await storage.updateItem(guildId, item.name, 'roleGiven', null);
      return message.channel.send(`✅ Rol removido del premio **${item.name}**.`);
    }

    await storage.updateItem(guildId, item.name, 'roleGiven', roleName);
    return message.channel.send(`✅ El premio **${item.name}** ahora otorgará el rol **${roleName}**.`);

  } else if (field === 'object' || field === 'tipo') {
    const objectType = valueArgs[0]?.toLowerCase();
    const validTypes = ['personaje', 'persona', 'objeto', 'object'];

    if (!validTypes.includes(objectType)) {
      return message.channel.send('❌ Tipo inválido. Usa: personaje, persona, objeto');
    }

    await storage.updateItem(guildId, item.name, 'objectType', objectType);
    return message.channel.send(`✅ El tipo del premio **${item.name}** ha sido actualizado a **${objectType}**.`);

  } else if (field === 'promo') {
    const value = valueArgs[0]?.toLowerCase();
    const isPromo = value === 'true' || value === 'si' || value === 'yes';

    await storage.updateItem(guildId, item.name, 'promo', isPromo);
    return message.channel.send(`✅ El premio **${item.name}** ${isPromo ? 'ahora es' : 'ya no es'} promocional.`);

  } else if (field === 'secret') {
    const value = valueArgs[0]?.toLowerCase();
    const isSecret = value === 'true' || value === 'si' || value === 'yes';

    await storage.updateItem(guildId, item.name, 'secret', isSecret);
    return message.channel.send(`✅ El premio **${item.name}** ${isSecret ? 'ahora es secreto 🔒' : 'ya no es secreto'}.`);

  } else if (field === 'collectable') {
    const amount = parseInt(valueArgs[0]);
    if (isNaN(amount) || amount < 0) {
      return message.channel.send('❌ La cantidad debe ser un número mayor o igual a 0.');
    }

    await storage.updateItem(guildId, item.name, 'collectable', amount);

    // Si se desactiva collectable (amount = 0), eliminar replycollectables
    if (amount === 0) {
      await storage.updateItem(guildId, item.name, 'replyCollectable1', null);
      await storage.updateItem(guildId, item.name, 'replyCollectable2', null);
      await storage.updateItem(guildId, item.name, 'replyCollectable3', null);
      return message.channel.send(`✅ El premio **${item.name}** ya no es coleccionable. Se eliminaron los replies coleccionables.`);
    }

    return message.channel.send(`✅ El premio **${item.name}** ahora requiere **${amount}** copias para completarse.`);

  } else if (field === 'name' || field === 'nombre') {
    const newName = valueArgs.join(' ');
    if (!newName) {
      return message.channel.send('❌ Debes proporcionar un nuevo nombre.');
    }

    const existingItem = await storage.getItemByName(guildId, newName);
    if (existingItem && existingItem.name !== item.name) {
      return message.channel.send(`❌ Ya existe un premio con el nombre **${newName}**.`);
    }

    await storage.renameItem(guildId, item.name, newName);
    return message.channel.send(`✅ El premio **${item.name}** ha sido renombrado a **${newName}**.`);

  } else if (field === 'replycollectable1') {
    if (!item.collectable || item.collectable === 0) {
      return message.channel.send(`❌ El premio **${item.name}** no es coleccionable. Usa \`*edititem ${item.name} collectable <cantidad>\` primero para activar el modo coleccionable.`);
    }
    const reply = valueArgs.join(' ');
    await storage.updateItem(guildId, item.name, 'replyCollectable1', reply || null);
    return message.channel.send(`✅ Reply coleccionable 1 del premio **${item.name}** actualizado.`);

  } else if (field === 'replycollectable2') {
    if (!item.collectable || item.collectable === 0) {
      return message.channel.send(`❌ El premio **${item.name}** no es coleccionable. Usa \`*edititem ${item.name} collectable <cantidad>\` primero para activar el modo coleccionable.`);
    }
    const reply = valueArgs.join(' ');
    await storage.updateItem(guildId, item.name, 'replyCollectable2', reply || null);
    return message.channel.send(`✅ Reply coleccionable 2 del premio **${item.name}** actualizado.`);

  } else if (field === 'replycollectable3') {
    if (!item.collectable || item.collectable === 0) {
      return message.channel.send(`❌ El premio **${item.name}** no es coleccionable. Usa \`*edititem ${item.name} collectable <cantidad>\` primero para activar el modo coleccionable.`);
    }
    const reply = valueArgs.join(' ');
    await storage.updateItem(guildId, item.name, 'replyCollectable3', reply || null);
    return message.channel.send(`✅ Reply coleccionable 3 del premio **${item.name}** actualizado.`);

  } else {
    return message.channel.send('❌ Campo inválido. Usa: chance, rarity, reply, tokens, role-given, object, promo, secret, collectable, name, replycollectable1, replycollectable2, replycollectable3');
  }
}

async function handleDeleteItem(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 1) {
    return message.reply('❌ Uso: `*deleteitem <nombre del premio>`');
  }

  if (!message.channel.isSendable()) return;

  const itemName = args.join(' ');
  const guildId = message.guild?.id;
  if (!guildId) return;

  const allItems = await storage.getAllItems(guildId);
  const item = await searchItemByPartialName(allItems, itemName);

  if (!item) {
    return message.channel.send(`❌ No se encontró el premio **${itemName}**.`);
  }

  const confirmationKey = `${message.author.id}-deleteitem`;

  if (pendingConfirmations.has(confirmationKey)) {
    clearTimeout(pendingConfirmations.get(confirmationKey).timeout);
  }

  const timeout = setTimeout(() => {
    pendingConfirmations.delete(confirmationKey);
  }, 30000);

  pendingConfirmations.set(confirmationKey, {
    command: 'deleteitem',
    data: { itemName: item.name },
    timeout
  });

  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('⚠️ Confirmación Requerida')
    .setDescription(`¿Estás seguro de que quieres **ELIMINAR** el premio **${item.name}**?\n\nEsta acción no se puede deshacer.\n\nEscribe \`*confirmar\` para continuar o \`*cancelar\` para abortar.\n\n_Esta confirmación expira en 30 segundos._`);

  await message.channel.send({ embeds: [embed] });
}

async function handleResetItems(message) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (!message.channel.isSendable()) return;

  const confirmationKey = `${message.author.id}-resetitems`;

  if (pendingConfirmations.has(confirmationKey)) {
    clearTimeout(pendingConfirmations.get(confirmationKey).timeout);
  }

  const timeout = setTimeout(() => {
    pendingConfirmations.delete(confirmationKey);
  }, 30000);

  pendingConfirmations.set(confirmationKey, {
    command: 'resetitems',
    data: {},
    timeout
  });

  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('⚠️ Confirmación Requerida')
    .setDescription(`¿Estás seguro de que quieres **ELIMINAR TODOS LOS PREMIOS** del gacha?\n\nEsto también eliminará todos los inventarios de usuarios.\n\nEsta acción no se puede deshacer.\n\nEscribe \`*confirmar\` para continuar o \`*cancelar\` para abortar.\n\n_Esta confirmación expira en 30 segundos._`);

  await message.channel.send({ embeds: [embed] });
}

async function handleItemInfo(message, args) {
  if (args.length < 1) {
    return message.reply('❌ Uso: `*iteminfo <nombre del premio>`');
  }

  const itemName = args.join(' ');
  const guildId = message.guild?.id;
  if (!guildId) return;

  const allItems = await storage.getAllItems(guildId);
  const item = await searchItemByPartialName(allItems, itemName);

  if (!item) {
    return message.reply(`❌ No se encontró el premio **${itemName}**.`);
  }

  // Proteger items secretos para usuarios sin permisos de admin
  if (item.secret && !message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply(`❌ No se encontró el premio **${itemName}**.`);
  }

  const embed = new EmbedBuilder()
    .setColor(storage.getRarityColor(item.rarity))
    .setTitle(`📋 Información: ${item.name}`)
    .addFields(
      { name: 'Rareza', value: storage.getRarityStars(item.rarity), inline: true },
      { name: 'Probabilidad', value: item.chance.toString(), inline: true },
      { name: 'Tipo', value: (item.objectType || 'personaje').charAt(0).toUpperCase() + (item.objectType || 'personaje').slice(1), inline: true },
      { name: 'Da Tokens', value: item.giveTokens ? 'Sí' : 'No', inline: true },
      { name: 'Promocional', value: item.promo ? 'Sí ⭐' : 'No', inline: true },
      { name: 'Secreto', value: item.secret ? 'Sí 🔒' : 'No', inline: true }
    );

  if (item.roleGiven) {
    embed.addFields({ name: 'Rol Otorgado', value: item.roleGiven, inline: false });
  }

  if (item.collectable && item.collectable > 0) {
    embed.addFields({ name: 'Coleccionable', value: `Requiere ${item.collectable} copias`, inline: false });

    if (item.replyCollectable1 || item.replyCollectable2 || item.replyCollectable3) {
      const collectableReplies = [];
      if (item.replyCollectable1) collectableReplies.push('Reply 1 configurado');
      if (item.replyCollectable2) collectableReplies.push('Reply 2 configurado');
      if (item.replyCollectable3) collectableReplies.push('Reply 3 configurado');
      embed.addFields({ name: 'Replies Coleccionables', value: collectableReplies.join('\n'), inline: false });
    }
  } else {
    if (item.replyCollectable1 || item.replyCollectable2 || item.replyCollectable3) {
      embed.addFields({
        name: '⚠️ Replies Coleccionables',
        value: 'Este item tiene replies coleccionables configurados pero no es coleccionable.\nUsa `*edititem ' + item.name + ' collectable <cantidad>` para activarlo.',
        inline: false
      });
    }
  }

  if (item.reply) {
    const isUrl = item.reply.match(/^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i);
    if (isUrl) {
      embed.setImage(item.reply);
    } else {
      embed.addFields({ name: 'Respuesta', value: item.reply, inline: false });
    }
  }

  await message.reply({ embeds: [embed] });
}

async function handleExchange(message, args) {
  if (args.length < 1) {
    return message.reply('❌ Uso: `*canjear <ID del canje>`\n\nUsa `*listexchanges` para ver los canjes disponibles.');
  }

  const exchangeId = args[0];
  const guildId = message.guild?.id;
  if (!guildId) return;

  const exchanges = await storage.getExchangeRules(guildId);
  const exchange = exchanges.find(e => e.id === exchangeId);

  if (!exchange) {
    return message.reply(`❌ No existe un canje con ID **${exchangeId}**.\n\nUsa \`*listexchanges\` para ver los canjes disponibles.`);
  }

  const userTokens = await storage.getUserTokens(guildId, message.author.id);

  let canAfford = true;
  for (const [rarity, amount] of Object.entries(exchange.prices)) {
    const tokenType = `Token ${rarity}`;
    if (!userTokens[tokenType] || userTokens[tokenType] < amount) {
      canAfford = false;
      break;
    }
  }

  const priceDisplayPromises = Object.entries(exchange.prices)
    .map(async ([rarity, amount]) => `${amount} ${await storage.getTokenEmoji(guildId, rarity)}`);
  const priceDisplay = (await Promise.all(priceDisplayPromises)).join(', ');

  if (!canAfford) {
    return message.reply(`❌ No tienes suficientes Tokens para este canje.\n\n**Requiere:** ${priceDisplay}\n\nUsa \`*tokens\` para ver tus Tokens actuales.`);
  }

  for (const [rarity, amount] of Object.entries(exchange.prices)) {
    const tokenType = `Token ${rarity}`;
    await storage.removeTokens(guildId, message.author.id, tokenType, amount);
  }

  if (exchange.roleGiven && message.member) {
    let roleToGive = message.guild?.roles.cache.find((r) => r.name === exchange.roleGiven);

    if (!roleToGive) {
      const roleMentionMatch = exchange.roleGiven?.match(/<@&(\d+)>/);
      if (roleMentionMatch) {
        roleToGive = message.guild?.roles.cache.get(roleMentionMatch[1]);
      }
    }

    if (!roleToGive && exchange.roleGiven) {
      roleToGive = message.guild?.roles.cache.get(exchange.roleGiven);
    }

    if (roleToGive) {
      try {
        await message.member.roles.add(roleToGive);
      } catch (error) {
        console.error(`❌ Error al asignar rol "${roleToGive.name}":`, error.message);
      }
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Canje Exitoso')
    .setDescription(`Has canjeado con éxito: **${exchange.rewardName}**`)
    .addFields(
      { name: 'Tokens Gastados', value: priceDisplay, inline: false }
    );

  await message.reply({ embeds: [embed] });
}

async function handleTokens(message) {
  const guildId = message.guild?.id;
  if (!guildId) return;
  const tokens = await storage.getUserTokens(guildId, message.author.id);
  const customEmoji = await storage.getConfig(guildId, 'currency_emoji');
  const titleEmoji = customEmoji || '<:Dupe:1425315638959673384>';

  if (Object.keys(tokens).length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle(`${titleEmoji} Tokens de ${message.author.username}`)
      .setDescription('No tienes ningún Token aún.\n\nObtén Tokens al conseguir premios duplicados en el gacha.');
    // .setThumbnail(message.author.displayAvatarURL({ dynamic: true })) // Removed thumbnail
    return message.channel.send({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`${titleEmoji} Tokens de ${message.author.username}`)
    .setDescription('Aquí están tus Tokens acumulados:')
    .setAuthor({
      name: message.author.username,
      iconURL: message.author.displayAvatarURL({ dynamic: true })
    });

  const rarityOrder = ['Token SSR', 'Token SR', 'Token UR', 'Token R'];

  for (const tokenType of rarityOrder) {
    if (tokens[tokenType] && tokens[tokenType] > 0) {
      const rarity = tokenType.replace('Token ', '');
      const tokenEmoji = await storage.getTokenEmoji(guildId, rarity);
      embed.addFields({
        name: `Token ${tokenEmoji}`,
        value: `${tokens[tokenType]}`,
        inline: true
      });
    }
  }

  await message.channel.send({ embeds: [embed] });
}

async function handleCreateExchange(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 1) {
    return message.reply('❌ Uso: `*createexchange <nombre del canje>`\n\nEjemplo: `*createexchange Spin Gratis`');
  }

  const rewardName = args.join(' ');
  const guildId = message.guild?.id;
  if (!guildId) return;
  const exchangeId = await storage.createExchange(guildId, rewardName);

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Canje Creado')
    .setDescription(`El canje **${rewardName}** ha sido creado con ID: **${exchangeId}**`)
    .addFields(
      { name: 'Siguiente Paso', value: `Configura el canje con:\n\`*editexchange ${exchangeId} price 1SSR 3SR 10UR 40R\`\n\`*editexchange ${exchangeId} role @Ticket\``, inline: false }
    );

  if (message.channel.isSendable()) {
    await message.channel.send({ embeds: [embed] });
  }
}

async function handleListExchanges(message) {
  const guildId = message.guild?.id;
  if (!guildId) return;
  const exchanges = await storage.getExchangeRules(guildId);

  if (exchanges.length === 0) {
    return message.reply('❌ No hay canjes configurados. Los administradores pueden crear uno con `*createexchange`.');
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('💱 Canjes Disponibles')
    .setDescription('Usa `*canjear <ID>` para canjear tus Tokens:');

  for (const exchange of exchanges) {
    const priceDisplayPromises = Object.entries(exchange.prices)
      .map(async ([rarity, amount]) => `${amount} ${await storage.getTokenEmoji(guildId, rarity)}`);
    const priceDisplay = (await Promise.all(priceDisplayPromises)).join(', ') || 'Sin precio configurado';

    embed.addFields({
      name: `ID: ${exchange.id} - ${exchange.rewardName}`,
      value: `**Precio:** ${priceDisplay}`,
      inline: false
    });
  }

  await message.reply({ embeds: [embed] });
}

async function handleSetTicketRole(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 1) {
    return message.reply('❌ Uso: `*setticketrole <nombre del rol o @mención>`');
  }

  const roleName = args.join(' ');
  const guildId = message.guild?.id;
  if (!guildId) return;
  await storage.setConfig(guildId, 'ticket_role', roleName);

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Rol de Ticket Configurado')
    .setDescription(`El rol de ticket para \`*spin\` ha sido configurado a: **${roleName}**`);

  await message.reply({ embeds: [embed] });
}

async function handleSetTicketRole10(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 1) {
    return message.reply('❌ Uso: `*setticketrole10 <nombre del rol o @mención>`');
  }

  const roleName = args.join(' ');
  const guildId = message.guild?.id;
  if (!guildId) return;
  await storage.setConfig(guildId, 'ticket_role_10', roleName);

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Rol de Ticket x10 Configurado')
    .setDescription(`El rol de ticket para \`*spin10\` ha sido configurado a: **${roleName}**`);

  await message.reply({ embeds: [embed] });
}

async function handleEditPull(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length === 0) {
    return message.reply('❌ Uso: `*editpull <URL del GIF>`\nO `*editpull remove` para quitar el GIF');
  }
  const guildId = message.guild?.id;
  if (!guildId) return;

  if (args[0].toLowerCase() === 'remove') {
    await storage.setConfig(guildId, 'pity_gif', null);
    return message.reply('✅ GIF de tirada removido.');
  }

  const gifUrl = args[0];
  await storage.setConfig(guildId, 'pity_gif', gifUrl);

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ GIF de Tirada Configurado')
    .setDescription('El GIF que aparecerá al hacer una tirada ha sido actualizado.')
    .setImage(gifUrl);

  await message.reply({ embeds: [embed] });
}

async function handleEditPullSSR(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length === 0) {
    return message.reply('❌ Uso: `*editpullssr <URL del GIF>`\nO `*editpullssr remove` para quitar el GIF');
  }
  const guildId = message.guild?.id;
  if (!guildId) return;

  if (args[0].toLowerCase() === 'remove') {
    await storage.setConfig(guildId, 'ssr_gif', null);
    return message.reply('✅ GIF de SSR/Promocional removido.');
  }

  const gifUrl = args[0];
  await storage.setConfig(guildId, 'ssr_gif', gifUrl);

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('✅ GIF de SSR/Promocional Configurado')
    .setDescription('El GIF que aparecerá al sacar un SSR o promocional ha sido actualizado.')
    .setImage(gifUrl);

  await message.reply({ embeds: [embed] });
}

async function handleEditPullTimer(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  const guildId = message.guild?.id;
  if (!guildId) return;

  if (args.length === 0) {
    const currentTimer = await storage.getConfig(guildId, 'pull_timer') || DEFAULT_PULL_TIMER;
    return message.reply(`⏱️ Timer actual: **${currentTimer}ms** (${(currentTimer/1000).toFixed(1)}s)\n\nPara cambiarlo usa: \`*editpulltimer <milisegundos>\`\nEjemplo: \`*editpulltimer 5000\` (5 segundos)`);
  }

  if (args[0].toLowerCase() === 'reset' || args[0].toLowerCase() === 'default') {
    await storage.setConfig(guildId, 'pull_timer', DEFAULT_PULL_TIMER);
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Timer de Tirada Reseteado')
      .setDescription(`El timer ha sido reseteado al valor por defecto: **${DEFAULT_PULL_TIMER}ms** (${(DEFAULT_PULL_TIMER/1000).toFixed(1)}s)`);
    return message.reply({ embeds: [embed] });
  }

  const timer = parseInt(args[0]);

  if (isNaN(timer) || timer < 1000 || timer > 60000) {
    return message.reply('❌ El timer debe ser un número entre 1000 y 60000 milisegundos (1-60 segundos).\n\nEjemplo: `*editpulltimer 5000` para 5 segundos');
  }

  await storage.setConfig(guildId, 'pull_timer', timer);

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Timer de Tirada Configurado')
    .setDescription(`El timer de los GIFs de tirada ha sido actualizado a: **${timer}ms** (${(timer/1000).toFixed(1)}s)`)
    .addFields(
      { name: 'Nota', value: 'Este timer se aplicará tanto para tiradas normales (*spin) como para tiradas x10 (*spin10)', inline: false }
    );

  await message.reply({ embeds: [embed] });
}

async function handleHelp(message) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('<:dogsuke:1425324917854834708> Comandos del Gacha Bot <:dogsuke:1425324917854834708>')
    .setDescription('Aquí están los comandos que puedes usar:')
    .addFields(
      {
        name: '🎰 Comandos de Juego',
        value: '**`*spin`** - Hacer un spin del gacha (requiere Ticket)\n**`*spin10`** - Hacer 10 spins del gacha (requiere Ticket x10)\n**`*banner`** - Ver el banner actual con probabilidades\n**`*pity`** - Ver tu contador de pity actual',
        inline: false
      },
      {
        name: '🎒 Comandos de Inventario',
        value: '**`*tokens`** - Ver tus Tokens acumulados\n**`*inventory`** - Ver tus premios y objetos coleccionables\n**`*canjear <ID>`** - Canjear Tokens por recompensas\n**`*listexchanges`** - Ver canjes disponibles',
        inline: false
      },
      {
        name: 'ℹ️ Sistema de Rarezas',
        value: '<:SSRTK:1425246335472369857> - Super Super Raro (5★)\n<:SRTK:1425246269307359395> - Super Raro (4★)\n<:URTK:1425246198071033906> - Ultra Raro (3★)\n<:RTK:1425246396654682272> - Raro (2★)\n\n⭐ = Personaje Promocional (Banner)',
        inline: false
      }
    )
    .setFooter({ text: 'Usa *help para ver este menú en cualquier momento' });

  if (message.channel.isSendable()) {
    await message.channel.send({ embeds: [embed] });
  }
}

async function handleFixHelp(message) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando. Usa `*help` para ver los comandos disponibles.');
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('<:dogsuke:1425324917854834708> Comandos del Gacha Bot <:dogsuke:1425324917854834708>')
    .setDescription('Aquí está la lista completa de comandos disponibles:')
    .addFields(
      {
        name: '🎰 Comandos de Juego',
        value: '**`*spin`** - Hacer un spin del gacha (requiere Ticket)\n**`*spin10`** - Hacer 10 spins del gacha (requiere Ticket x10)\n**`*banner`** - Ver el banner actual con probabilidades\n**`*pity`** - Ver tu contador de pity actual',
        inline: false
      },
      {
        name: '🎒 Comandos de Inventario',
        value: '**`*tokens`** - Ver tus Tokens acumulados\n**`*inventory`** - Ver tus premios y objetos coleccionables\n**`*canjear <ID>`** - Canjear Tokens por recompensas\n**`*listexchanges`** - Ver canjes disponibles',
        inline: false
      },
      {
        name: '⚙️ Comandos Admin - Crear Items',
        value: '**`*createitem <nombre>`** - Crear premio\n**`*createitemsecret <nombre>`** - Crear secreto 🔒\n**`*deleteitem <nombre>`** - Eliminar premio\n**`*resetitems`** - Eliminar todos\n**`*iteminfo <nombre>`** - Ver info\n**`*secretbanner`** - Ver secretos 🔒',
        inline: false
      },
      {
        name: '⚙️ Comandos Admin - Editar Items (Parte 1)',
        value: '**`*edititem <nombre> <campo> <valor>`**\n\n**Campos básicos:**\n`*edititem Joker rarity SSR`\n`*edititem Joker chance 5`\n`*edititem Joker reply https://imagen.gif`\n`*edititem Joker tokens si`\n`*edititem Joker role-given @Rol`',
        inline: false
      },
      {
        name: '⚙️ Comandos Admin - Editar Items (Parte 2)',
        value: '**Campos avanzados:**\n`*edititem Joker promo true`\n`*edititem Joker secret true` 🔒\n`*edititem Joker collectable 5`\n`*edititem Joker name "Nuevo Nombre"`\n`*edititem Joker object persona`',
        inline: false
      },
      {
        name: '⚙️ Comandos Admin - Replies Coleccionables',
        value: '**Configurar replies aleatorios:**\n`*edititem Joker replycollectable1 <url>`\n`*edititem Joker replycollectable2 <url>`\n`*edititem Joker replycollectable3 <url>`',
        inline: false
      },
      {
        name: '⚙️ Comandos de Administración - Tokens & Coleccionables',
        value: '**`*addtokens <@usuario> <cantidad><rareza>`** - Dar tokens a un usuario\nEjemplo: `*addtokens @Juan 5SSR`\n\n**`*removetokens <@usuario> <cantidad><rareza>`** - Quitar tokens\nEjemplo: `*removetokens @Juan 2SR`\n\n**`*resettokens`** - Resetear tokens de todos (requiere confirmación)\n**`*resetcollectable <item> <@usuario>`** - Resetear coleccionables de un item\nEjemplo: `*resetcollectable Cuerpo santo @Juan`',
        inline: false
      },
      {
        name: '⚙️ Comandos de Administración - Canjes',
        value: '**`*createexchange <nombre>`** - Crear un nuevo canje\nEjemplo: `*createexchange Spin Gratis`\n\n**`*editexchange <id> price <tokens>`** - Editar precios del canje\nEjemplo: `*editexchange 1 price 1SSR 3SR 10UR 40R`\n\n**`*editexchange <id> role <rol>`** - Asignar rol al canje\nEjemplo: `*editexchange 1 role @Ticket`\n\n**`*resetexchanges`** - Eliminar todos los canjes',
        inline: false
      },
      {
        name: '⚙️ Comandos de Configuración',
        value: '**`*setticketrole <rol>`** - Configurar rol de ticket para `*spin`\n**`*setticketrole10 <rol>`** - Configurar rol de ticket para `*spin10`\n**`*editpull <url_gif>`** - Configurar GIF de tirada normal\n**`*editpull remove`** - Quitar GIF de tirada normal\n**`*editpullssr <url_gif>`** - Configurar GIF para SSR/Promocional\n**`*editpullssr remove`** - Quitar GIF de SSR/Promocional\n**`*editpulltimer <milisegundos>`** - Configurar duración del GIF (ej: 5000 = 5s)\n**`*editpulltimer`** - Ver timer actual\n**`*editpulltimer reset`** - Resetear timer a 11.5s\n**`*editpity <número>`** - Configurar en qué tirada es el SSR asegurado (ej: 100)\n**`*editpity`** - Ver pity actual\n**`*editpity reset`** - Resetear pity a 90\n**`*setcurrency <emoji>`** - Configurar emoji del título de tokens',
        inline: false
      },
      {
        name: 'ℹ️ Sistema de Rarezas',
        value: '<:SSRTK:1425246335472369857> - Super Super Raro (5★)\n<:SRTK:1425246269307359395> - Super Raro (4★)\n<:URTK:1425246198071033906> - Ultra Raro (3★)\n<:RTK:1425246396654682272> - Raro (2★)\n\n⭐ = Personaje Promocional (Banner)',
        inline: false
      }
    )
    .setFooter({ text: 'Usa *fixhelp para ver este menú en cualquier momento' });

  if (message.channel.isSendable()) {
    await message.channel.send({ embeds: [embed] });
  }
}

async function handleResetExchanges(message) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }
  const guildId = message.guild?.id;
  if (!guildId) return;

  if (!message.channel.isSendable()) return;

  const deletedCount = await storage.resetAllExchanges(guildId);

  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('🗑️ Todos los Canjes Eliminados')
    .setDescription(`Se han eliminado **${deletedCount}** canjes.\n\n✅ Ahora puedes crear nuevos canjes desde cero.`);

  await message.channel.send({ embeds: [embed] });
}

async function handleEditExchange(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (!message.channel.isSendable()) return;

  if (args.length < 2) {
    return message.channel.send('❌ Uso: `*editexchange <id> <campo> <valor...>`\n**Campos:** price, role\n\nEjemplo precio: `*editexchange 1 price 1SSR 3SR 10UR 40R`\nEjemplo rol: `*editexchange 1 role @Ticket`');
  }

  const exchangeId = args[0];
  const field = args[1].toLowerCase();
  const guildId = message.guild?.id;
  if (!guildId) return;

  const exchanges = await storage.getExchangeRules(guildId);
  const exchange = exchanges.find(e => e.id === exchangeId);

  if (!exchange) {
    return message.channel.send(`❌ No existe un canje con ID **${exchangeId}**.`);
  }

  if (field === 'price') {
    const priceArgs = args.slice(2);
    const prices = {};

    for (const arg of priceArgs) {
      const match = arg.match(/^(\d+)(R|UR|SR|SSR)$/i);
      if (match) {
        const amount = parseInt(match[1]);
        const rarity = match[2].toUpperCase();
        prices[rarity] = amount;
      }
    }

    if (Object.keys(prices).length === 0) {
      return message.channel.send('❌ Formato inválido. Usa: `*editexchange <id> price 1SSR 3SR 10UR 40R`\nPuedes omitir rarezas que no necesites.');
    }

    exchange.prices = prices;
    const filePath = require('path').join(__dirname, 'data', `${guildId}_exchanges.json`);
    await require('fs').promises.writeFile(filePath, JSON.stringify({ exchanges }, null, 2), 'utf-8');

    const priceDisplayPromises = Object.entries(prices)
      .map(async ([rarity, amount]) => `${amount} ${await storage.getTokenEmoji(guildId, rarity)}`);
    const priceDisplay = (await Promise.all(priceDisplayPromises)).join(', ');

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Precios Actualizados')
      .setDescription(`Los precios del canje **${exchange.rewardName}** (ID: ${exchangeId}) han sido actualizados.`)
      .addFields({ name: 'Nuevos Precios', value: priceDisplay });

    await message.channel.send({ embeds: [embed] });

  } else if (field === 'role' || field === 'role-given') {
    const roleName = args.slice(2).join(' ');

    if (!roleName) {
      exchange.roleGiven = null;
      const filePath = require('path').join(__dirname, 'data', `${guildId}_exchanges.json`);
      await require('fs').promises.writeFile(filePath, JSON.stringify({ exchanges }, null, 2), 'utf-8');
      return message.channel.send(`✅ Rol eliminado del canje **${exchange.rewardName}**.`);
    }

    exchange.roleGiven = roleName;
    const filePath = require('path').join(__dirname, 'data', `${guildId}_exchanges.json`);
    await require('fs').promises.writeFile(filePath, JSON.stringify({ exchanges }, null, 2), 'utf-8');
    await message.channel.send(`✅ El canje **${exchange.rewardName}** ahora otorgará el rol **${roleName}**.`);

  } else {
    await message.channel.send('❌ Campo inválido. Usa: price, role, o role-given.');
  }
}

async function handleAddTokens(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 2) {
    return message.reply('❌ Uso: `*addtokens <@usuario> <cantidad><rareza>`\n\nEjemplos:\n`*addtokens @Juan 5SSR`\n`*addtokens @Maria 10R`');
  }

  const userMention = args[0];
  const userIdMatch = userMention.match(/<@!?(\d+)>/);
  const userId = userIdMatch ? userIdMatch[1] : null;

  if (!userId) {
    return message.reply('❌ Debes mencionar a un usuario válido.\nEjemplo: `*addtokens @Juan 5SSR`');
  }

  const tokenArg = args[1];
  const match = tokenArg.match(/^(\d+)(R|UR|SR|SSR)$/i);

  if (!match) {
    return message.reply('❌ Formato inválido. Usa: `<cantidad><rareza>`\nEjemplos: 5SSR, 10R, 3SR');
  }

  const amount = parseInt(match[1]);
  const rarity = match[2].toUpperCase();
  const tokenType = `Token ${rarity}`;
  const guildId = message.guild?.id;
  if (!guildId) return;

  console.log(`Adding ${amount} ${tokenType} to user ${userId} on guild ${guildId}`);
  await storage.addTokens(guildId, userId, tokenType, amount);

  const tokenEmoji = await storage.getRarityTokenEmoji(rarity);
  const user = await message.guild.members.fetch(userId);
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Tokens Añadidos')
    .setDescription(`Se han añadido **${amount}** ${tokenEmoji} a ${user.user.username}.`);

  await message.channel.send({ embeds: [embed] });
}

async function handleRemoveTokens(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 2) {
    return message.reply('❌ Uso: `*removetokens <@usuario> <cantidad><rareza>`\n\nEjemplos:\n`*removetokens @Juan 5SSR`\n`*removetokens @Maria 10R`');
  }

  const userMention = args[0];
  const userIdMatch = userMention.match(/<@!?(\d+)>/);
  const userId = userIdMatch ? userIdMatch[1] : null;

  if (!userId) {
    return message.reply('❌ Debes mencionar a un usuario válido.\nEjemplo: `*removetokens @Juan 5SSR`');
  }

  const tokenArg = args[1];
  const match = tokenArg.match(/^(\d+)(R|UR|SR|SSR)$/i);

  if (!match) {
    return message.reply('❌ Formato inválido. Usa: `<cantidad><rareza>`\nEjemplos: 5SSR, 10R, 3SR');
  }

  const amount = parseInt(match[1]);
  const rarity = match[2].toUpperCase();
  const tokenType = `Token ${rarity}`;
  const guildId = message.guild?.id;
  if (!guildId) return;

  console.log(`Removing ${amount} ${tokenType} from user ${userId} on guild ${guildId}`);
  const success = await storage.removeTokens(guildId, userId, tokenType, amount);

  const tokenEmoji = await storage.getRarityTokenEmoji(rarity);
  const user = await message.guild.members.fetch(userId);

  if (!success) {
    return message.channel.send(`❌ ${user.user.username} no tiene suficientes ${tokenEmoji} para remover.`);
  }

  const embed = new EmbedBuilder()
    .setColor(0xFF6B35)
    .setTitle('✅ Tokens Removidos')
    .setDescription(`Se han removido **${amount}** ${tokenEmoji} de ${user.user.username}.`);

  await message.channel.send({ embeds: [embed] });
}

async function handleResetTokens(message) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (!message.channel.isSendable()) return;
  const guildId = message.guild?.id;
  if (!guildId) return;

  const confirmationKey = `${message.author.id}-resettokens`;

  if (pendingConfirmations.has(confirmationKey)) {
    clearTimeout(pendingConfirmations.get(confirmationKey).timeout);
  }

  const timeout = setTimeout(() => {
    pendingConfirmations.delete(confirmationKey);
  }, 30000);

  pendingConfirmations.set(confirmationKey, {
    command: 'resettokens',
    data: {},
    timeout
  });

  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('⚠️ Confirmación Requerida')
    .setDescription(`¿Estás seguro de que quieres **RESETEAR TODOS LOS TOKENS** de todos los usuarios?\n\nEsta acción no se puede deshacer.\n\nEscribe \`*confirmar\` para continuar o \`*cancelar\` para abortar.\n\n_Esta confirmación expira en 30 segundos._`);

  await message.channel.send({ embeds: [embed] });
}

async function handleConfirm(message) {
  const guildId = message.guild?.id;
  if (!guildId) return;

  const confirmationKey = `${message.author.id}-deleteitem`;
  const confirmationKey2 = `${message.author.id}-resetitems`;
  const confirmationKey3 = `${message.author.id}-resettokens`;

  if (pendingConfirmations.has(confirmationKey)) {
    const confirmation = pendingConfirmations.get(confirmationKey);
    clearTimeout(confirmation.timeout);
    pendingConfirmations.delete(confirmationKey);

    await storage.deleteItem(guildId, confirmation.data.itemName);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Premio Eliminado')
      .setDescription(`El premio **${confirmation.data.itemName}** ha sido eliminado del gacha.`);

    return message.reply({ embeds: [embed] });
  }

  if (pendingConfirmations.has(confirmationKey2)) {
    const confirmation = pendingConfirmations.get(confirmationKey2);
    clearTimeout(confirmation.timeout);
    pendingConfirmations.delete(confirmationKey2);

    await storage.resetAllItems(guildId);

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🗑️ Todos los Premios Eliminados')
      .setDescription('Se han eliminado todos los premios del gacha y todos los inventarios de usuarios.\n\n✅ Ahora puedes crear nuevos premios desde cero.');

    return message.reply({ embeds: [embed] });
  }

  if (pendingConfirmations.has(confirmationKey3)) {
    const confirmation = pendingConfirmations.get(confirmationKey3);
    clearTimeout(confirmation.timeout);
    pendingConfirmations.delete(confirmationKey3);

    await storage.resetAllTokens(guildId);

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🗑️ Todos los Tokens Reseteados')
      .setDescription('Se han eliminado todos los tokens de todos los usuarios.\n\n✅ Los tokens comenzarán desde cero.');

    return message.reply({ embeds: [embed] });
  }

  return message.reply('❌ No tienes ninguna confirmación pendiente.');
}

async function handleCancel(message) {
  const confirmationKey = `${message.author.id}-deleteitem`;
  const confirmationKey2 = `${message.author.id}-resetitems`;
  const confirmationKey3 = `${message.author.id}-resettokens`;

  if (pendingConfirmations.has(confirmationKey)) {
    const confirmation = pendingConfirmations.get(confirmationKey);
    clearTimeout(confirmation.timeout);
    pendingConfirmations.delete(confirmationKey);
    return message.reply('❌ Eliminación de premio cancelada.');
  }

  if (pendingConfirmations.has(confirmationKey2)) {
    const confirmation = pendingConfirmations.get(confirmationKey2);
    clearTimeout(confirmation.timeout);
    pendingConfirmations.delete(confirmationKey2);
    return message.reply('❌ Reseteo de premios cancelado.');
  }

  if (pendingConfirmations.has(confirmationKey3)) {
    const confirmation = pendingConfirmations.get(confirmationKey3);
    clearTimeout(confirmation.timeout);
    pendingConfirmations.delete(confirmationKey3);
    return message.reply('❌ Reseteo de tokens cancelado.');
  }

  return message.reply('❌ No tienes ninguna confirmación pendiente para cancelar.');
}

async function handlePityInfo(message) {
  const guildId = message.guild?.id;
  if (!guildId) return;
  const pityData = await storage.getUserPity(guildId, message.author.id);
  const pityMax = await storage.getConfig(guildId, 'pity_max') || 90;

  const fiftyFiftyStatus = pityData.guaranteedPromo
    ? '🎯 Próximo SSR será PROMOCIONAL garantizado'
    : '🎲 Próximo SSR tiene 50% de ser promocional';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📊 Tu Información de Pity')
    .setDescription('Sistema de garantía de personajes raros')
    .addFields(
      { name: 'Tiradas desde último SSR', value: `${pityData.counter}/${pityMax}`, inline: true },
      { name: 'Próximo SSR garantizado en', value: `${pityMax - pityData.counter} tiradas`, inline: true },
      { name: 'Sistema 50/50', value: fiftyFiftyStatus, inline: false }
    )
    .setFooter({ text: 'El pity se resetea al obtener un SSR. Si pierdes el 50/50 (obtienes estándar), el próximo SSR será promocional garantizado.' });

  await message.reply({ embeds: [embed] });
}

async function handleSetCurrency(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 1) {
    return message.reply('❌ Uso: `*setcurrency <emoji>`\n\nEjemplo: `*setcurrency 💰` o `*setcurrency <:SSRTK:1425246335472369857>`');
  }

  const emoji = args.join(' ');
  const guildId = message.guild?.id;
  if (!guildId) return;
  await storage.setConfig(guildId, 'currency_emoji', emoji);

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Emoji de Tokens Configurado')
    .setDescription(`El emoji de tokens ha sido configurado a: ${emoji}\n\nAhora aparecerá en el título de \`*bal\` y \`*tokens\`\n\nPrueba con \`*tokens\` para ver el cambio.`);

  await message.reply({ embeds: [embed] });
}

async function handleInventory(message) {
  const guildId = message.guild?.id;
  if (!guildId) return;

  const allItems = await storage.getAllItems(guildId);
  const collectables = await storage.getUserCollectables(guildId, message.author.id);

  const personasAndObjects = allItems.filter(item => {
    const objectType = (item.objectType || 'personaje').toLowerCase();
    return objectType === 'persona' || objectType === 'objeto' || objectType === 'object';
  });

  if (personasAndObjects.length === 0) {
    return message.reply('❌ No hay personas u objetos configurados en el gacha.');
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎒 Tu Inventario')
    .setDescription(`${message.author.username}, aquí están tus personas y objetos coleccionables:`);

  let hasAnyItem = false;

  for (const item of personasAndObjects) {
    const count = collectables[item.name] || 0;
    const objectType = (item.objectType || 'personaje').toLowerCase();
    const rarityStars = storage.getRarityStars(item.rarity);

    if (count > 0) {
      hasAnyItem = true;
      let statusText = `**Cantidad:** ${count}`;

      if (item.collectable && item.collectable > 0) {
        statusText += ` / ${item.collectable}`;
        if (count >= item.collectable) {
          statusText += ' ✅ (Completado)';
        } else {
          statusText += ` (${Math.floor((count / item.collectable) * 100)}%)`;
        }
      }

      embed.addFields({
        name: `${rarityStars} ${item.name}`,
        value: `**Tipo:** ${objectType.charAt(0).toUpperCase() + objectType.slice(1)}\n${statusText}`,
        inline: true
      });
    }
  }

  if (!hasAnyItem) {
    embed.setDescription('No tienes ninguna persona u objeto en tu inventario aún.\n\nObtén items haciendo spins en el gacha.');
  }

  await message.reply({ embeds: [embed] });
}

async function handleResetCollectable(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 2) {
    return message.reply('❌ Uso: `*resetcollectable <nombre_item> <@usuario>`\n\nEjemplo: `*resetcollectable Cuerpo santo @Juan`');
  }

  const userMention = args[args.length - 1];
  const userIdMatch = userMention.match(/<@!?(\d+)>/);
  const userId = userIdMatch ? userIdMatch[1] : null;

  if (!userId) {
    return message.reply('❌ Debes mencionar a un usuario válido.\nEjemplo: `*resetcollectable Cuerpo santo @Juan`');
  }

  const itemName = args.slice(0, args.length - 1).join(' ');
  const guildId = message.guild?.id;
  if (!guildId) return;

  const allItems = await storage.getAllItems(guildId);
  const item = await searchItemByPartialName(allItems, itemName);
  if (!item) {
    return message.reply(`❌ No se encontró el item **${itemName}**.`);
  }

  await storage.resetCollectable(guildId, userId, item.name);

  const user = await message.guild.members.fetch(userId);
  const embed = new EmbedBuilder()
    .setColor(0xFF6B35)
    .setTitle('✅ Coleccionables Reseteados')
    .setDescription(`Los coleccionables de **${item.name}** han sido reseteados para ${user.user.username}.`);

  await message.channel.send({ embeds: [embed] });
}

async function handleEditPity(message, args) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  const guildId = message.guild?.id;
  if (!guildId) return;

  if (args.length === 0) {
    const currentPity = await storage.getConfig(guildId, 'pity_max') || 90;
    return message.reply(`⏱️ Pity actual: **${currentPity}** tiradas\n\nPara cambiarlo usa: \`*editpity <número>\`\nEjemplo: \`*editpity 100\` (el pity será a las 100 tiradas)`);
  }

  if (args[0].toLowerCase() === 'reset' || args[0].toLowerCase() === 'default') {
    await storage.setConfig(guildId, 'pity_max', 90);
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Pity Reseteado')
      .setDescription(`El pity ha sido reseteado al valor por defecto: **90 tiradas**`);
    return message.reply({ embeds: [embed] });
  }

  const pityMax = parseInt(args[0]);

  if (isNaN(pityMax) || pityMax < 1 || pityMax > 500) {
    return message.reply('❌ El pity debe ser un número entre 1 y 500.\n\nEjemplo: `*editpity 100` para que el pity sea a las 100 tiradas');
  }

  await storage.setConfig(guildId, 'pity_max', pityMax);

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Pity Configurado')
    .setDescription(`El pity ha sido actualizado a: **${pityMax} tiradas**`)
    .addFields(
      { name: 'Nota', value: 'Los usuarios recibirán un SSR garantizado al llegar a este número de tiradas sin obtener uno.', inline: false }
    );

  await message.reply({ embeds: [embed] });
}

async function handleGirarSlash(interaction) {
  const member = interaction.member;
  const guildId = interaction.guild?.id;
  if (!member || !guildId) return;

  // Verificar si hay una tirada en curso
  const cooldownKey = `${guildId}-${interaction.user.id}`;
  if (spinCooldowns.has(cooldownKey)) {
    const timeLeft = spinCooldowns.get(cooldownKey) - Date.now();
    if (timeLeft > 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎰 Tirada en Curso')
        .setDescription(`Ya tienes una tirada activa.\n\n⏱️ Podrás hacer otra tirada en **${Math.ceil(timeLeft / 1000)}** segundos.`)
        .setFooter({ text: 'Espera a que termine tu tirada actual' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    spinCooldowns.delete(cooldownKey);
  }

  let ticketRole = await storage.getConfig(guildId, 'ticket_role') || DEFAULT_TICKET_ROLE;

  const mentionMatch = ticketRole.match(/<@&(\d+)>/);
  if (mentionMatch) {
    ticketRole = mentionMatch[1];
  }

  const hasTicket = member.roles.cache.some((role) =>
    role.name.toLowerCase() === ticketRole.toLowerCase() || role.id === ticketRole
  );

  if (!hasTicket) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Sin Ticket')
      .setDescription(`No tienes el ticket necesario para hacer un spin.\n\nCompra un ticket en <@292953664492929025> para poder jugar.`);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Activar cooldown de 5 segundos
  const cooldownTime = 5000; // 5 segundos fijos
  spinCooldowns.set(cooldownKey, Date.now() + cooldownTime);
  setTimeout(() => spinCooldowns.delete(cooldownKey), cooldownTime);

  // Esperar 1 segundo antes de quitar el rol (para evitar errores)
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Quitar el rol después de 1 segundo
  const ticketRoleToRemove = member.roles.cache.find((role) =>
    role.name.toLowerCase() === ticketRole.toLowerCase() || role.id === ticketRole
  );

  if (ticketRoleToRemove) {
    try {
      await member.roles.remove(ticketRoleToRemove);
      console.log(`✅ Ticket "${ticketRoleToRemove.name}" removido (con delay de 1s) [slash]`);
    } catch (error) {
      console.error(`❌ Error al remover ticket "${ticketRoleToRemove.name}":`, error.message);
      
      if (error.code === 50001) {
        const warningEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('⚠️ No se pudo remover el ticket')
          .setDescription(`El bot no tiene permisos para remover el rol **${ticketRoleToRemove.name}**.\n\n**Solución:** Asegúrate de que el rol del bot esté por encima de este rol en la jerarquía del servidor.`);
        await interaction.reply({ embeds: [warningEmbed], ephemeral: true });
        return;
      }
    }
  }

  const item = await storage.getRandomItemWithPity(guildId, interaction.user.id);

  if (!item) {
    return interaction.reply({ content: '❌ No hay premios configurados en el gacha.', ephemeral: true });
  }

  const isSSRorPromo = item.rarity.toUpperCase() === 'SSR' || item.promo;
  const gifToShow = isSSRorPromo
    ? await storage.getConfig(guildId, 'ssr_gif')
    : await storage.getConfig(guildId, 'pity_gif');

  if (gifToShow) {
    const pullTimer = await storage.getConfig(guildId, 'pull_timer') || DEFAULT_PULL_TIMER;
    
    const loadingEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🌟 Realizando tirada...')
      .setImage(gifToShow);

    await interaction.reply({ embeds: [loadingEmbed] });

    await new Promise(resolve => setTimeout(resolve, pullTimer));

    await interaction.deleteReply();
  } else {
    await interaction.deferReply();
  }

  let hasRoleGiven = false;

  if (item.roleGiven) {
    let roleToCheck = interaction.guild?.roles.cache.find((r) => r.name === item.roleGiven);

    if (!roleToCheck) {
      const roleMentionMatch = item.roleGiven?.match(/<@&(\d+)>/);
      if (roleMentionMatch) {
        roleToCheck = interaction.guild?.roles.cache.get(roleMentionMatch[1]);
      }
    }

    if (!roleToCheck && item.roleGiven) {
      roleToCheck = interaction.guild?.roles.cache.get(item.roleGiven);
    }

    if (roleToCheck) {
      hasRoleGiven = member.roles.cache.has(roleToCheck.id);
    }
  }

  const isDuplicate = hasRoleGiven;
  const embedColor = item.secret ? 0x8B0000 : storage.getRarityColor(item.rarity);
  const objectType = item.objectType || 'personaje';

  const collectables = await storage.getUserCollectables(guildId, interaction.user.id);
  const currentCount = collectables[item.name] || 0;
  const isCollectable = item.collectable && item.collectable > 0;

  let replyToUse = item.reply;
  if (isCollectable && (item.replyCollectable1 || item.replyCollectable2 || item.replyCollectable3)) {
    const collectableReplies = [item.replyCollectable1, item.replyCollectable2, item.replyCollectable3].filter(r => r);
    if (collectableReplies.length > 0) {
      replyToUse = collectableReplies[Math.floor(Math.random() * collectableReplies.length)];
    }
  }

  const isUrl = replyToUse?.match(/^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i);

  if ((isDuplicate && item.giveTokens) || (objectType === 'persona' && item.giveTokens)) {
    const tokenEmoji = await storage.getTokenEmoji(item.rarity);
    const tokenType = `Token ${item.rarity.toUpperCase()}`;
    await storage.addTokens(guildId, interaction.user.id, tokenType, 1);

    const rarityStars = storage.getRarityStars(item.rarity);

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle(`🔄 ¡${objectType.charAt(0).toUpperCase() + objectType.slice(1)} Duplicado!`)
      .addFields(
        { name: objectType.charAt(0).toUpperCase() + objectType.slice(1), value: item.name, inline: true },
        { name: 'Rareza', value: rarityStars, inline: true },
        { name: '<:Dupe:1425315638959673384> Tokens', value: `+1 ${tokenEmoji}`, inline: true }
      )
      .setFooter({ text: `Ya tenías este ${objectType}, recibiste Tokens` });

    if (isUrl) {
      embed.setImage(replyToUse);
    }

    const replyMethod = interaction.replied ? 'followUp' : 'reply';
    await interaction[replyMethod]({ embeds: [embed] });
  } else {
    const rarityStars = storage.getRarityStars(item.rarity);

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(item.secret ? `🔒 ¡${objectType.charAt(0).toUpperCase() + objectType.slice(1)} Secreto Obtenido!` : `🎉 ¡Nuevo ${objectType.charAt(0).toUpperCase() + objectType.slice(1)} Obtenido!`)
      .addFields(
        { name: objectType.charAt(0).toUpperCase() + objectType.slice(1), value: item.name, inline: true },
        { name: 'Rareza', value: rarityStars, inline: true }
      );

    if (item.secret) {
      embed.setDescription('🔒 ¡Has conseguido un personaje secreto!');
    }

    if (isCollectable) {
      const remaining = item.collectable - currentCount;
      embed.addFields({ name: '📦 Coleccionable', value: `${currentCount}/${item.collectable} (Faltan ${remaining})`, inline: false });

      if (currentCount >= item.collectable && item.roleGiven) {
        embed.addFields({ name: '✅ Completado', value: `Rol asignado: ${item.roleGiven}`, inline: false });
      }
    }

    embed.setFooter({ text: item.secret ? '¡Has desbloqueado un secreto!' : `¡Felicidades por tu nuevo ${objectType}!` });

    if (isUrl) {
      embed.setImage(replyToUse);
    }

    const replyMethod = interaction.replied ? 'followUp' : 'reply';
    await interaction[replyMethod]({ embeds: [embed] });

    if (item.roleGiven) {
      const shouldGiveRole = !isCollectable || currentCount >= item.collectable;

      if (shouldGiveRole) {
        let roleToGive = interaction.guild?.roles.cache.find((r) => r.name === item.roleGiven);

        if (!roleToGive) {
          const roleMentionMatch = item.roleGiven?.match(/<@&(\d+)>/);
          if (roleMentionMatch) {
            roleToGive = interaction.guild?.roles.cache.get(roleMentionMatch[1]);
          }
        }

        if (!roleToGive && item.roleGiven) {
          roleToGive = interaction.guild?.roles.cache.get(item.roleGiven);
        }

        if (roleToGive) {
          try {
            await member.roles.add(roleToGive);
            console.log(`✅ Rol "${roleToGive.name}" asignado exitosamente a ${interaction.user.tag}`);
          } catch (error) {
            console.error(`❌ Error al asignar rol "${roleToGive.name}":`, error.message);
          }
        } else {
          console.log(`⚠️ No se encontró el rol "${item.roleGiven}" en el servidor`);
        }
      }
    }
  }
}

async function handleGirar10Slash(interaction) {
  const member = interaction.member;
  const guildId = interaction.guild?.id;
  if (!member || !guildId) return;

  let ticketRole10 = await storage.getConfig(guildId, 'ticket_role_10') || 'Ticket x10';

  const mentionMatch = ticketRole10.match(/<@&(\d+)>/);
  if (mentionMatch) {
    ticketRole10 = mentionMatch[1];
  }

  const hasTicket10 = member.roles.cache.some((role) =>
    role.name.toLowerCase() === ticketRole10.toLowerCase() || role.id === ticketRole10
  );

  if (!hasTicket10) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Sin Ticket x10')
      .setDescription(`No tienes el ticket necesario para hacer 10 spins.\n\nCompra un ticket x10 en <@292953664492929025> para poder jugar.`);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  await interaction.deferReply();

  // Esperar 1 segundo antes de quitar el rol (para evitar errores)
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Quitar el rol después de 1 segundo
  const ticketRoleToRemove = member.roles.cache.find((role) =>
    role.name.toLowerCase() === ticketRole10.toLowerCase() || role.id === ticketRole10
  );

  if (ticketRoleToRemove) {
    try {
      await member.roles.remove(ticketRoleToRemove);
      console.log(`✅ Ticket x10 "${ticketRoleToRemove.name}" removido (con delay de 1s) [slash]`);
    } catch (error) {
      console.error(`❌ Error al remover ticket x10:`, error.message);
      
      if (error.code === 50001) {
        const warningEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('⚠️ No se pudo remover el ticket')
          .setDescription(`El bot no tiene permisos para remover el rol **${ticketRoleToRemove.name}**.\n\n**Solución:** Asegúrate de que el rol del bot esté por encima de este rol en la jerarquía del servidor.`);
        await interaction.followUp({ embeds: [warningEmbed], ephemeral: true });
        return;
      }
    }
  }

  const results = [];

  for (let i = 0; i < 10; i++) {
    const item = await storage.getRandomItemWithPity(guildId, interaction.user.id);
    if (!item) continue;

    let hasRoleGiven = false;

    if (item.roleGiven) {
      let roleToCheck = interaction.guild?.roles.cache.find((r) => r.name === item.roleGiven);

      if (!roleToCheck) {
        const roleMentionMatch = item.roleGiven?.match(/<@&(\d+)>/);
        if (roleMentionMatch) {
          roleToCheck = interaction.guild?.roles.cache.get(roleMentionMatch[1]);
        }
      }

      if (!roleToCheck && item.roleGiven) {
        roleToCheck = interaction.guild?.roles.cache.get(item.roleGiven);
      }

      if (roleToCheck) {
        hasRoleGiven = member.roles.cache.has(roleToCheck.id);
      }
    }

    const isDuplicate = hasRoleGiven;
    const objectType = item.objectType || 'personaje';

    if (isDuplicate || (objectType === 'persona' && item.giveTokens)) {
      const tokenType = `Token ${item.rarity.toUpperCase()}`;
      await storage.addTokens(guildId, interaction.user.id, tokenType, 1);
    } else if (!isDuplicate && item.roleGiven) {
      let roleToGive = interaction.guild?.roles.cache.find((r) => r.name === item.roleGiven);

      if (!roleToGive) {
        const roleMentionMatch = item.roleGiven?.match(/<@&(\d+)>/);
        if (roleMentionMatch) {
          roleToGive = interaction.guild?.roles.cache.get(roleMentionMatch[1]);
        }
      }

      if (!roleToGive && item.roleGiven) {
        roleToGive = interaction.guild?.roles.cache.get(item.roleGiven);
      }

      if (roleToGive && !member.roles.cache.has(roleToGive.id)) {
        try {
          await member.roles.add(roleToGive);
        } catch (error) {
          console.error(`❌ Error al asignar rol "${roleToGive.name}":`, error.message);
        }
      }
    }

    results.push({ item, isDuplicate });
  }

  const rarityPriority = { 'SSR': 1, 'SR': 2, 'UR': 3, 'R': 4 };
  const hasPromo = results.some(r => r.item.promo);
  const highestRarity = results.reduce((highest, current) => {
    const currentPriority = rarityPriority[current.item.rarity.toUpperCase()] || 999;
    const highestPriority = rarityPriority[highest.toUpperCase()] || 999;
    return currentPriority < highestPriority ? current.item.rarity : highest;
  }, 'R');

  const isSSRorPromo = highestRarity.toUpperCase() === 'SSR' || hasPromo;
  const gifToShow = isSSRorPromo
    ? await storage.getConfig(guildId, 'ssr_gif')
    : await storage.getConfig(guildId, 'pity_gif');

  if (gifToShow) {
    const pullTimer = await storage.getConfig(guildId, 'pull_timer') || DEFAULT_PULL_TIMER;

    const loadingEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🌟 Realizando 10 tiradas...')
      .setImage(gifToShow);

    await interaction.editReply({ embeds: [loadingEmbed] });
    await new Promise(resolve => setTimeout(resolve, pullTimer));
  }

  const groupedResults = {};

  results.forEach(({ item, isDuplicate }) => {
    if (!groupedResults[item.name]) {
      groupedResults[item.name] = { count: 0, isDuplicate, rarity: item.rarity };
    }
    groupedResults[item.name].count++;
  });

  const bestItems = results.filter(r => r.item.rarity === highestRarity);
  const randomBestItem = bestItems[Math.floor(Math.random() * bestItems.length)].item;

  const isUrl = randomBestItem.reply.match(/^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i);

  if (isUrl) {
    const bestItemEmbed = new EmbedBuilder()
      .setColor(storage.getRarityColor(randomBestItem.rarity))
      .setTitle(`✨ ¡${randomBestItem.name}!`)
      .setDescription(`${storage.getRarityStars(randomBestItem.rarity)} - Tu mejor premio de estas 10 tiradas`)
      .setImage(randomBestItem.reply);

    await interaction.editReply({ embeds: [bestItemEmbed] });

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎉 Resultados de 10 Giros')
    .setDescription(`${interaction.user.username}, aquí están tus resultados:`);

  Object.entries(groupedResults).forEach(([name, data]) => {
    const rarityStars = storage.getRarityStars(data.rarity);
    const status = data.isDuplicate ? '🔄 Duplicado' : '✨ Nuevo';
    embed.addFields({
      name: `${rarityStars} ${name}`,
      value: `${status} - Obtenido **${data.count}x**`,
      inline: false
    });
  });

  await interaction.followUp({ embeds: [embed] });
}

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('❌ Error: No se encontró DISCORD_TOKEN en las variables de entorno');
  process.exit(1);
}

client.login(token);