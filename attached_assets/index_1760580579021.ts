import { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, Message, MessageCollector, REST, Routes, SlashCommandBuilder } from 'discord.js';
import * as dotenv from 'dotenv';
import * as storage from './server/storage';
import { searchItemByPartialName, searchItemByPartialNameSync } from './utils/itemSearch';

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

const pendingConfirmations = new Map<string, { command: string; data: any; timeout: NodeJS.Timeout }>();

client.on('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user?.tag}`);
  await storage.ensureDataFiles();

  // Registrar comando slash /oye
  const commands = [
    new SlashCommandBuilder()
      .setName('oye')
      .setDescription('¡Oye!')
      .toJSON()
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

  try {
    console.log('🔄 Registrando comando slash /oye...');
    await rest.put(
      Routes.applicationCommands(client.user!.id),
      { body: commands }
    );
    console.log('✅ Comando slash /oye registrado');
  } catch (error) {
    console.error('❌ Error registrando comando slash:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'oye') {
    await interaction.reply({
      content: 'https://cdn.discord.gg/attachments/1160511107102953475/1427795523066138664/attachment.gif'
    });
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
    } else if (command === 'bal') {
      await handleBalance(message);
    } else if (command === 'editpull') {
      await handleEditPull(message, args);
    } else if (command === 'editpullssr') {
      await handleEditPullSSR(message, args);
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
    }
  } catch (error) {
    console.error('Error:', error);
    message.reply('❌ Ocurrió un error al ejecutar el comando.');
  }
});

async function handleGirar(message: Message) {
  const member = message.member;
  const guildId = message.guild?.id;
  if (!member || !guildId) return;

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

  const item = await storage.getRandomItemWithPity(guildId, message.author.id);

  if (!item) {
    return message.reply('❌ No hay premios configurados en el gacha.');
  }

  const isSSRorPromo = item.rarity.toUpperCase() === 'SSR' || item.promo;
  const gifToShow = isSSRorPromo
    ? await storage.getConfig(guildId, 'ssr_gif')
    : await storage.getConfig(guildId, 'pity_gif');

  if (gifToShow) {
    const loadingEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🌟 Realizando tirada...')
      .setImage(gifToShow);

    const loadingMessage = await message.reply({ embeds: [loadingEmbed] });

    await new Promise(resolve => setTimeout(resolve, 11500));

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
  const embedColor = storage.getRarityColor(item.rarity);
  const objectType = item.objectType || 'personaje';

  const isUrl = item.reply.match(/^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i);

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
      embed.setImage(item.reply);
    }

    await message.reply({ embeds: [embed] });
  } else {
    const rarityStars = storage.getRarityStars(item.rarity);

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`🎉 ¡Nuevo ${objectType.charAt(0).toUpperCase() + objectType.slice(1)} Obtenido!`)
      .addFields(
        { name: objectType.charAt(0).toUpperCase() + objectType.slice(1), value: item.name, inline: true },
        { name: 'Rareza', value: rarityStars, inline: true }
      )
      .setFooter({ text: `¡Felicidades por tu nuevo ${objectType}!` });

    if (isUrl) {
      embed.setImage(item.reply);
    }

    await message.reply({ embeds: [embed] });

    if (item.roleGiven) {
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
        } catch (error: any) {
          console.error(`❌ Error al asignar rol "${roleToGive.name}":`, error.message);
        }
      } else {
        console.log(`⚠️ No se encontró el rol "${item.roleGiven}" en el servidor`);
      }
    }
  }

  const ticketRoleToRemove = member.roles.cache.find((role) =>
    role.name.toLowerCase() === ticketRole.toLowerCase() || role.id === ticketRole
  );

  if (ticketRoleToRemove) {
    try {
      await member.roles.remove(ticketRoleToRemove);
      console.log(`✅ Ticket "${ticketRoleToRemove.name}" removido exitosamente`);
    } catch (error: any) {
      console.error(`❌ Error al remover ticket "${ticketRoleToRemove.name}":`, error.message);

      if (error.code === 50001) {
        const warningEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('⚠️ No se pudo remover el ticket')
          .setDescription(`El bot no tiene permisos para remover el rol **${ticketRoleToRemove.name}**.\n\n**Solución:** Asegúrate de que el rol del bot esté por encima de este rol en la jerarquía del servidor.`);
        await message.reply({ embeds: [warningEmbed] });
      }
    }
  }
}

async function handleGirar10(message: Message) {
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

  const results: { item: any; isDuplicate: boolean }[] = [];

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
        } catch (error: any) {
          console.error(`❌ Error al asignar rol "${roleToGive.name}":`, error.message);
        }
      }
    }

    results.push({ item, isDuplicate });
  }

  const rarityPriority: { [key: string]: number } = { 'SSR': 1, 'SR': 2, 'UR': 3, 'R': 4 };
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
    const loadingEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🌟 Realizando 10 tiradas...')
      .setImage(gifToShow);

    const loadingMessage = await message.reply({ embeds: [loadingEmbed] });
    await new Promise(resolve => setTimeout(resolve, 11500));
    await loadingMessage.delete();
  }

  const groupedResults: { [key: string]: { count: number; isDuplicate: boolean; rarity: string } } = {};

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

  const ticketRoleToRemove = member.roles.cache.find((role) =>
    role.name.toLowerCase() === ticketRole10.toLowerCase() || role.id === ticketRole10
  );

  if (ticketRoleToRemove) {
    try {
      await member.roles.remove(ticketRoleToRemove);
      console.log(`✅ Ticket x10 "${ticketRoleToRemove.name}" removido exitosamente`);
    } catch (error: any) {
      console.error(`❌ Error al remover ticket x10:`, error.message);
    }
  }
}

async function handleBanner(message: Message) {
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

  const itemsByRarity: { [key: string]: typeof sortedItems } = {
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

    const config = rarityConfig[rarityKey as keyof typeof rarityConfig];
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

async function handleCreateItem(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
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

async function handleCreateItemSecret(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
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

async function handleSecretBanner(message: Message) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  const guildId = message.guild?.id;
  if (!guildId) return;
  const allItems = await storage.getAllItems(guildId);

  const secretItems = allItems.filter(item => item.secret);

  if (secretItems.length === 0) {
    if (message.channel.isSendable()) {
      return message.channel.send('❌ No hay personajes secretos configurados.');
    }
    return;
  }

  const totalChance = allItems.reduce((sum, item) => sum + item.chance, 0);
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

  const itemsByRarity: { [key: string]: typeof sortedItems } = {
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
      name: `${guild?.name || 'Server'} Secret Banner`,
      iconURL: guild?.iconURL() || undefined
    })
    .setTitle('🔒 Personajes Secretos del Banner 🔒')
    .setDescription('◆━━━━━━━━━✪━━━━━━━━━◆\n**Estos personajes NO aparecen en el banner público**');

  let totalPercentageCheck = 0;

  rarityOrder.forEach(rarityKey => {
    const itemsInRarity = itemsByRarity[rarityKey];
    if (itemsInRarity.length === 0) return;

    const config = rarityConfig[rarityKey as keyof typeof rarityConfig];
    let rarityList = '';
    let rarityTotal = 0;

    itemsInRarity.forEach((item) => {
      const percentage = ((item.chance / totalChance) * 100).toFixed(2);
      rarityTotal += parseFloat(percentage);
      const promoMarker = item.promo ? '⭐' : '';
      rarityList += `${percentage}% — **${item.name}** ${promoMarker} 🔒\n`;
    });

    totalPercentageCheck += rarityTotal;

    embed.addFields({
      name: `${config.stars} ${config.name} (${rarityTotal.toFixed(2)}%)`,
      value: rarityList || 'Sin items',
      inline: false
    });
  });

  embed.setFooter({ text: 'Solo los administradores pueden ver este banner' });

  if (message.channel.isSendable()) {
    await message.channel.send({ embeds: [embed] });
  }
}

async function handleItemInfo(message: Message, args: string[]) {
  if (args.length < 1) {
    return message.reply('❌ Uso: `*iteminfo <nombre_o_parte>`\n\nEjemplo: `*iteminfo Joke` (detectará "Joker" si existe)');
  }

  const query = args.join(' ');
  const guildId = message.guild?.id;
  if (!guildId) return;

  const allItems = await storage.getAllItems(guildId);
  const searchResult = searchItemByPartialNameSync(query, allItems);

  if (searchResult.type === 'none') {
    if (message.channel.isSendable()) {
      return message.channel.send(`❌ No se encontró ningún premio que comience con **"${query}"**.`);
    }
    return;
  }

  if (searchResult.type === 'multiple' && searchResult.matches) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🔍 Múltiples Resultados Encontrados')
      .setDescription(`Se encontraron varios premios que comienzan con **"${query}"**:\n\n${searchResult.matches.map((item, idx) => `**${idx + 1}.** ${item.name}`).join('\n')}\n\nUsa el nombre completo o más letras para ser más específico.`);

    if (message.channel.isSendable()) {
      return message.channel.send({ embeds: [embed] });
    }
    return;
  }

  if (searchResult.type !== 'exact' && searchResult.type !== 'unique') return;
  const item = searchResult.item;

  const allItemsForPercentage = await storage.getAllItems(guildId);
  const totalChance = allItemsForPercentage.reduce((sum, i) => sum + i.chance, 0);
  const percentage = ((item.chance / totalChance) * 100).toFixed(2);

  const rarityStars = storage.getRarityStars(item.rarity);

  const embed = new EmbedBuilder()
    .setColor(storage.RarityColor(item.rarity))
    .setTitle(`📋 Información: ${item.name}`)
    .addFields(
      { name: 'Nombre', value: item.name, inline: true },
      { name: 'Rareza', value: rarityStars, inline: true },
      { name: 'Probabilidad', value: `${percentage}%`, inline: true },
      { name: 'Tipo de Referencia', value: item.objectType || 'Personaje', inline: true },
      { name: 'Da Tokens', value: item.giveTokens ? 'Sí' : 'No', inline: true },
      { name: 'Rol Asignado', value: item.roleGiven || 'Ninguno', inline: true },
      { name: 'Promocional', value: item.promo ? 'Sí ⭐' : 'No', inline: true },
      { name: 'Respuesta', value: item.reply || 'N/A', inline: false }
    )
    .setFooter({ text: `ID: ${item.id}` });

  if (message.channel.isSendable()) {
    await message.channel.send({ embeds: [embed] });
  }
}

async function handleEditItem(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 3) {
    return message.reply('❌ Uso: `*edititem <nombre> <campo> <valor...>`\n**Campos:** reply, chance, rarity, tokens, role-given, object, promo, secret');
  }

  const query = args.slice(0, args.length - 2).join(' ');
  const field = args[args.length - 2];
  const value = args[args.length - 1];

  const guildId = message.guild?.id;
  if (!guildId) return;

  const allItems = await storage.getAllItems(guildId);
  const searchResult = searchItemByPartialNameSync(query, allItems);

  if (searchResult.type === 'none') {
    if (message.channel.isSendable()) {
      return message.channel.send(`❌ No se encontró ningún premio que comience con **"${query}"**.`);
    }
    return;
  }

  if (searchResult.type === 'multiple' && searchResult.matches) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🔍 Múltiples Resultados Encontrados')
      .setDescription(`Se encontraron varios premios que comienzan con **"${query}"**:\n\n${searchResult.matches.map((item, idx) => `**${idx + 1}.** ${item.name}`).join('\n')}\n\nUsa el nombre completo o más letras para ser más específico.`);

    if (message.channel.isSendable()) {
      return message.channel.send({ embeds: [embed] });
    }
    return;
  }

  if (searchResult.type !== 'exact' && searchResult.type !== 'unique') return;
  const item = searchResult.item;

  if (!message.channel.isSendable()) return;

  if (field === 'reply') {
    await storage.updateItemReply(guildId, item.name, value);
    await message.channel.send(`✅ Respuesta de **${item.name}** actualizada.`);
  } else if (field === 'chance') {
    const chance = parseInt(value);
    if (isNaN(chance) || chance <= 0) {
      return message.channel.send('❌ La probabilidad debe ser un número mayor a 0.');
    }
    await storage.updateItemChance(guildId, item.name, chance);
    await message.channel.send(`✅ Probabilidad de **${item.name}** actualizada a ${chance}.`);
  } else if (field === 'rarity') {
    const rarity = value.toUpperCase();
    if (!['R', 'UR', 'SR', 'SSR'].includes(rarity)) {
      return message.channel.send('❌ Rareza inválida. Usa: R (Raro), UR (Ultra Raro), SR (Super Raro), SSR (Super Super Raro)');
    }
    await storage.updateItemRarity(guildId, item.name, rarity);
    await message.channel.send(`✅ Rareza de **${item.name}** actualizada a ${storage.getRarityStars(rarity)}.`);
  } else if (field === 'tokens') {
    const giveTokens = value.toLowerCase() === 'si' || value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
    await storage.updateItemTokens(guildId, item.name, giveTokens);
    await message.channel.send(`✅ **${item.name}** ahora ${giveTokens ? 'dará' : 'no dará'} Tokens al duplicar.`);
  } else if (field === 'role-given') {
    if (!value) {
      await storage.updateItemRoleGiven(guildId, item.name, null);
      await message.channel.send(`✅ Rol eliminado de **${item.name}**.`);
    } else {
      await storage.updateItemRoleGiven(guildId, item.name, value);
      await message.channel.send(`✅ **${item.name}** ahora otorgará el rol **${value}** al ganarlo.`);
    }
  } else if (field === 'object') {
    await storage.updateItemObjectType(guildId, item.name, value);
    await message.channel.send(`✅ Tipo de objeto de **${item.name}** actualizado a **${value}**.`);
  } else if (field === 'promo') {
    const isPromo = value.toLowerCase() === 'true' || value.toLowerCase() === 'si' || value.toLowerCase() === 'yes';
    await storage.updateItemPromo(guildId, item.name, isPromo);
    await message.channel.send(`✅ **${item.name}** ${isPromo ? 'ahora es' : 'ya no es'} un personaje promocional.`);
  } else if (field === 'collectable') {
    const collectableAmount = parseInt(value);
    if (isNaN(collectableAmount) || collectableAmount <= 0) {
      return message.channel.send('❌ La cantidad de coleccionables debe ser un número mayor a 0.');
    }
    await storage.updateItemCollectable(guildId, item.name, collectableAmount);
    await message.channel.send(`✅ **${item.name}** ahora requiere **${collectableAmount}** copias para obtener el rol asignado.`);
  } else if (field === 'secret') {
    const isSecret = value.toLowerCase() === 'true' || value.toLowerCase() === 'si' || value.toLowerCase() === 'yes';
    await storage.updateItemSecret(guildId, item.name, isSecret);
    await message.channel.send(`✅ **${item.name}** ${isSecret ? 'ahora es' : 'ya no es'} un personaje secreto. 🔒`);
  } else {
    await message.channel.send('❌ Campo inválido. Usa: reply, chance, rarity, tokens, role-given, object, promo, secret.');
  }
}

async function handleDeleteItem(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 1) {
    return message.reply('❌ Uso: `*deleteitem <nombre>`');
  }

  const query = args.join(' ');
  const guildId = message.guild?.id;
  if (!guildId) return;

  const allItems = await storage.getAllItems(guildId);
  const searchResult = searchItemByPartialNameSync(query, allItems);

  if (searchResult.type === 'none') {
    if (message.channel.isSendable()) {
      return message.channel.send(`❌ No se encontró ningún premio que comience con **"${query}"**.`);
    }
    return;
  }

  if (searchResult.type === 'multiple' && searchResult.matches) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🔍 Múltiples Resultados Encontrados')
      .setDescription(`Se encontraron varios premios que comienzan con **"${query}"**:\n\n${searchResult.matches.map((item, idx) => `**${idx + 1}.** ${item.name}`).join('\n')}\n\nUsa el nombre completo para eliminar.`);

    if (message.channel.isSendable()) {
      return message.channel.send({ embeds: [embed] });
    }
    return;
  }

  if (searchResult.type !== 'exact' && searchResult.type !== 'unique') return;
  const item = searchResult.item;

  if (!message.channel.isSendable()) return;

  const confirmationKey = `${message.author.id}-deleteitem`;

  if (pendingConfirmations.has(confirmationKey)) {
    clearTimeout(pendingConfirmations.get(confirmationKey)!.timeout);
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
    .setColor(0xFF6B35)
    .setTitle('⚠️ Confirmación Requerida')
    .setDescription(`¿Estás seguro de que quieres eliminar el premio **${item.name}**?\n\nEscribe \`*confirmar\` para continuar o \`*cancelar\` para abortar.\n\n_Esta confirmación expira en 30 segundos._`);

  await message.channel.send({ embeds: [embed] });
}

async function handleResetItems(message: Message) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (!message.channel.isSendable()) return;

  const confirmationKey = `${message.author.id}-resetitems`;

  if (pendingConfirmations.has(confirmationKey)) {
    clearTimeout(pendingConfirmations.get(confirmationKey)!.timeout);
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
    .setDescription(`¿Estás seguro de que quieres **ELIMINAR TODOS LOS PREMIOS** del gacha?\n\nEsto también borrará todos los inventarios de usuarios.\n\nEscribe \`*confirmar\` para continuar o \`*cancelar\` para abortar.\n\n_Esta confirmación expira en 30 segundos._`);

  await message.channel.send({ embeds: [embed] });
}

async function handleExchange(message: Message, args: string[]) {
  const guildId = message.guild?.id;
  if (!guildId) return;

  if (args.length < 1) {
    return message.reply('❌ Uso: `*canjear <ID del canje>`\nUsa `*listexchanges` para ver los canjes disponibles.');
  }

  const exchangeId = args[0];
  const exchanges = await storage.getExchangeRules(guildId);
  const exchange = exchanges.find(e => e.id === exchangeId);

  if (!exchange) {
    return message.reply(`❌ No existe un canje con ID **${exchangeId}**.\nUsa \`*listexchanges\` para ver los disponibles.`);
  }

  const userTokens = await storage.getUserTokens(guildId, message.author.id);
  const canAfford = Object.entries(exchange.prices).every(([rarity, amount]) => {
    const tokenType = `Token ${rarity}`;
    return (userTokens[tokenType] || 0) >= amount;
  });

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
      } catch (error: any) {
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

  if (exchange.roleGiven) {
    embed.addFields({ name: 'Rol Obtenido', value: exchange.roleGiven, inline: false });
  }

  await message.reply({ embeds: [embed] });
}

async function handleTokens(message: Message) {
  const guildId = message.guild?.id;
  if (!guildId) return;
  const tokens = await storage.getUserTokens(guildId, message.author.id);
  const customEmoji = await storage.getConfig(guildId, 'currency_emoji');
  const titleEmoji = customEmoji || '<:Dupe:1425315638959673384>';

  if (Object.keys(tokens).length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle(`${titleEmoji} Tus Tokens`)
      .setDescription('No tienes ningún Token aún.\n\nObtén Tokens al conseguir premios duplicados en el gacha.');
    return message.reply({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`${titleEmoji} Tus Tokens`)
    .setDescription('Aquí están tus Tokens acumulados:');

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

  await message.reply({ embeds: [embed] });
}

async function handleBalance(message: Message) {
  return handleTokens(message);
}

async function handleCreateExchange(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
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

async function handleListExchanges(message: Message) {
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

    let description = `**Precio:** ${priceDisplay}`;
    if (exchange.roleGiven) {
      description += `\n**Rol:** ${exchange.roleGiven}`;
    }

    embed.addFields({
      name: `ID: ${exchange.id} - ${exchange.rewardName}`,
      value: description,
      inline: false
    });
  }

  await message.reply({ embeds: [embed] });
}

async function handleSetTicketRole(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
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
    .setDescription(`El rol de ticket para \`*girar\` ha sido configurado a: **${roleName}**`);

  await message.reply({ embeds: [embed] });
}

async function handleSetTicketRole10(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
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
    .setDescription(`El rol de ticket para \`*girar10\` ha sido configurado a: **${roleName}**`);

  await message.reply({ embeds: [embed] });
}

async function handleEditPull(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
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

async function handleEditPullSSR(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
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

async function handleFixHelp(message: Message) {
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
        value: '**`*tokens`** o **`*bal`** - Ver tus Tokens acumulados\n**`*inventory`** - Ver tus personas y objetos coleccionables\n**`*canjear <ID>`** - Canjear Tokens por recompensas\n**`*listexchanges`** - Ver canjes disponibles',
        inline: false
      },
      {
        name: '⚙️ Comandos de Administración - Items',
        value: '**`*createitem <nombre>`** - Crear un nuevo premio\nEjemplo: `*createitem Joker Premium`\n\n**`*createitemsecret <nombre>`** - Crear personaje secreto 🔒\nEjemplo: `*createitemsecret Johnny`\n*No aparece en el banner público*\n\n**`*edititem <nombre> <campo> <valor>`** - Editar premio\n  - Campos: `chance`, `rarity`, `reply`, `tokens`, `role-given`, `object`, `promo`, `secret`\n  - Ejemplos:\n    - `*edititem Joker rarity SSR`\n    - `*edititem Joker chance 5`\n    - `*edititem Joker reply https://imagen.gif`\n    - `*edititem Joker tokens si`\n    - `*edititem Joker role-given @NombreRol`\n    - `*edititem Joker promo true`\n    - `*edititem Joker secret true` (lo hace secreto 🔒)\n    - `*edititem "Cuerpo Santo" collectable 5` (necesita 5 copias para el rol)\n\n**`*deleteitem <nombre>`** - Eliminar un premio (requiere confirmación)\n**`*resetitems`** - Eliminar todos los premios (requiere confirmación)\n**`*iteminfo <nombre>`** - Ver información de un premio\n**`*secretbanner`** - Ver solo personajes secretos (admin) 🔒',
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
        value: '**`*setticketrole <rol>`** - Configurar rol de ticket para `*spin`\n**`*setticketrole10 <rol>`** - Configurar rol de ticket para `*spin10`\n**`*editpull <url_gif>`** - Configurar GIF de tirada normal\n**`*editpull remove`** - Quitar GIF de tirada normal\n**`*editpullssr <url_gif>`** - Configurar GIF para SSR/Promocional\n**`*editpullssr remove`** - Quitar GIF de SSR/Promocional\n**`*setcurrency <emoji>`** - Configurar emoji del título de tokens',
        inline: false
      },
      {
        name: 'ℹ️ Sistema de Rarezas',
        value: 'SSR <:SSRTK:1425246335472369857> - Super Super Raro (5★)\nSR <:SRTK:1425246269307359395> - Super Raro (4★)\nUR <:URTK:1425246198071033906> - Ultra Raro (3★)\nR <:RTK:1425246396654682272> - Raro (2★)\n\n⭐ = Personaje Promocional (Banner)',
        inline: false
      }
    )
    .setFooter({ text: 'Usa *fixhelp para ver este menú en cualquier momento' });

  if (message.channel.isSendable()) {
    await message.channel.send({ embeds: [embed] });
  }
}

async function handleResetExchanges(message: Message) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
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

async function handleEditExchange(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
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
    const prices: { [key: string]: number } = {};

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

    await storage.updateExchangePrices(exchange.id, prices);

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
      await storage.updateExchangeRole(exchange.id, null);
      return message.channel.send(`✅ Rol eliminado del canje **${exchange.rewardName}**.`);
    }

    await storage.updateExchangeRole(exchange.id, roleName);
    await message.channel.send(`✅ El canje **${exchange.rewardName}** ahora otorgará el rol **${roleName}**.`);

  } else {
    await message.channel.send('❌ Campo inválido. Usa: price, role, o role-given.');
  }
}

async function handleAddTokens(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 2) {
    return message.reply('❌ Uso: `*addtokens <@usuario> <cantidad><rareza>`\n\nEjemplos:\n`*addtokens @Juan 5SSR`\n`*addtokens @Maria 10R`');
  }

  const userMention = args[0];
  const userId = userMention.match(/<@!?(\d+)>/) ? userMention.match(/<@!?(\d+)>/)![1] : null;

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
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Tokens Añadidos')
    .setDescription(`Se han añadido **${amount}** ${tokenEmoji} a <@${userId}>.`);

  await message.reply({ embeds: [embed] });
}

async function handleRemoveTokens(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 2) {
    return message.reply('❌ Uso: `*removetokens <@usuario> <cantidad><rareza>`\n\nEjemplos:\n`*removetokens @Juan 5SSR`\n`*removetokens @Maria 10R`');
  }

  const userMention = args[0];
  const userId = userMention.match(/<@!?(\d+)>/) ? userMention.match(/<@!?(\d+)>/)![1] : null;

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

  if (!success) {
    return message.reply(`❌ <@${userId}> no tiene suficientes ${tokenEmoji} para remover.`);
  }

  const embed = new EmbedBuilder()
    .setColor(0xFF6B35)
    .setTitle('✅ Tokens Removidos')
    .setDescription(`Se han removido **${amount}** ${tokenEmoji} de <@${userId}>.`);

  await message.reply({ embeds: [embed] });
}

async function handleResetTokens(message: Message) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (!message.channel.isSendable()) return;
  const guildId = message.guild?.id;
  if (!guildId) return;

  const confirmationKey = `${message.author.id}-resettokens`;

  if (pendingConfirmations.has(confirmationKey)) {
    clearTimeout(pendingConfirmations.get(confirmationKey)!.timeout);
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

async function handleConfirm(message: Message) {
  const guildId = message.guild?.id;
  if (!guildId) return;

  const confirmationKey = `${message.author.id}-deleteitem`;
  const confirmationKey2 = `${message.author.id}-resetitems`;
  const confirmationKey3 = `${message.author.id}-resettokens`;

  if (pendingConfirmations.has(confirmationKey)) {
    const confirmation = pendingConfirmations.get(confirmationKey)!;
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
    const confirmation = pendingConfirmations.get(confirmationKey2)!;
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
    const confirmation = pendingConfirmations.get(confirmationKey3)!;
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

async function handleCancel(message: Message) {
  const confirmationKey = `${message.author.id}-deleteitem`;
  const confirmationKey2 = `${message.author.id}-resetitems`;
  const confirmationKey3 = `${message.author.id}-resettokens`;

  if (pendingConfirmations.has(confirmationKey)) {
    const confirmation = pendingConfirmations.get(confirmationKey)!;
    clearTimeout(confirmation.timeout);
    pendingConfirmations.delete(confirmationKey);
    return message.reply('❌ Eliminación de premio cancelada.');
  }

  if (pendingConfirmations.has(confirmationKey2)) {
    const confirmation = pendingConfirmations.get(confirmationKey2)!;
    clearTimeout(confirmation.timeout);
    pendingConfirmations.delete(confirmationKey2);
    return message.reply('❌ Reseteo de premios cancelado.');
  }

  if (pendingConfirmations.has(confirmationKey3)) {
    const confirmation = pendingConfirmations.get(confirmationKey3)!;
    clearTimeout(confirmation.timeout);
    pendingConfirmations.delete(confirmationKey3);
    return message.reply('❌ Reseteo de tokens cancelado.');
  }

  return message.reply('❌ No tienes ninguna confirmación pendiente para cancelar.');
}

async function handlePityInfo(message: Message) {
  const guildId = message.guild?.id;
  if (!guildId) return;
  const pityData = await storage.getUserPity(guildId, message.author.id);

  const fiftyFiftyStatus = pityData.guaranteedPromo
    ? '🎯 Próximo SSR será PROMOCIONAL garantizado'
    : '🎲 Próximo SSR tiene 50% de ser promocional';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📊 Tu Información de Pity')
    .setDescription('Sistema de garantía de personajes raros')
    .addFields(
      { name: 'Tiradas desde último SSR', value: `${pityData.counter}/90`, inline: true },
      { name: 'Próximo SSR garantizado en', value: `${90 - pityData.counter} tiradas`, inline: true },
      { name: 'Sistema 50/50', value: fiftyFiftyStatus, inline: false }
    )
    .setFooter({ text: 'El pity se resetea al obtener un SSR. Si pierdes el 50/50 (obtienes estándar), el próximo SSR será promocional garantizado.' });

  await message.reply({ embeds: [embed] });
}

async function handleSetCurrency(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
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

async function handleInventory(message: Message) {
  const guildId = message.guild?.id;
  if (!guildId) return;

  const allItems = await storage.getAllItems(guildId);
  const collectables = await storage.getUserCollectables(guildId, message.author.id);

  // Filtrar solo personas y objetos (no personajes)
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
      
      // Si tiene collectable configurado, mostrar progreso
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

async function handleResetCollectable(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ Solo administradores pueden usar este comando.');
  }

  if (args.length < 2) {
    return message.reply('❌ Uso: `*resetcollectable <nombre_item> <@usuario>`\n\nEjemplo: `*resetcollectable Cuerpo santo @Juan`');
  }

  const userMention = args[args.length - 1];
  const userId = userMention.match(/<@!?(\d+)>/) ? userMention.match(/<@!?(\d+)>/)![1] : null;

  if (!userId) {
    return message.reply('❌ Debes mencionar a un usuario válido.\nEjemplo: `*resetcollectable Cuerpo santo @Juan`');
  }

  const itemName = args.slice(0, args.length - 1).join(' ');
  const guildId = message.guild?.id;
  if (!guildId) return;

  const item = await storage.getItemByName(guildId, itemName);
  if (!item) {
    return message.reply(`❌ No se encontró el item **${itemName}**.`);
  }

  await storage.resetCollectable(guildId, userId, item.name);

  const embed = new EmbedBuilder()
    .setColor(0xFF6B35)
    .setTitle('✅ Coleccionables Reseteados')
    .setDescription(`Los coleccionables de **${item.name}** han sido reseteados para <@${userId}>.`);

  await message.reply({ embeds: [embed] });
}

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('❌ Error: No se encontró DISCORD_TOKEN en las variables de entorno');
  process.exit(1);
}

client.login(token);