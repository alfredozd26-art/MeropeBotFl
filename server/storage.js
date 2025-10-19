const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

async function ensureDataFiles() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log('✅ Carpeta de datos inicializada');
  } catch (error) {
    console.error('❌ Error al crear carpeta de datos:', error);
  }
}

function getFilePath(guildId, filename) {
  return path.join(DATA_DIR, `${guildId}_${filename}.json`);
}

async function readJSON(filePath, defaultValue = {}) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return defaultValue;
    }
    throw error;
  }
}

async function writeJSON(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function getAllItems(guildId) {
  const filePath = getFilePath(guildId, 'items');
  const data = await readJSON(filePath, { items: [] });
  return data.items || [];
}

async function getItemByName(guildId, name) {
  const items = await getAllItems(guildId);
  return items.find(item => item.name.toLowerCase() === name.toLowerCase());
}

async function createItem(guildId, name, chance, rarity, reply, secret = false) {
  const filePath = getFilePath(guildId, 'items');
  const data = await readJSON(filePath, { items: [] });
  
  if (!data.items) {
    data.items = [];
  }
  
  data.items.push({
    name,
    chance,
    rarity,
    reply,
    secret,
    giveTokens: true,
    roleGiven: null,
    objectType: 'personaje',
    promo: false,
    collectable: 0
  });
  
  await writeJSON(filePath, data);
}

async function deleteItem(guildId, name) {
  const filePath = getFilePath(guildId, 'items');
  const data = await readJSON(filePath, { items: [] });
  
  if (!data.items) return;
  
  data.items = data.items.filter(item => item.name.toLowerCase() !== name.toLowerCase());
  await writeJSON(filePath, data);
}

async function resetAllItems(guildId) {
  const filePath = getFilePath(guildId, 'items');
  await writeJSON(filePath, { items: [] });
  
  const inventoryPath = getFilePath(guildId, 'collectables');
  await writeJSON(inventoryPath, {});
}

async function updateItem(guildId, name, field, value) {
  const filePath = getFilePath(guildId, 'items');
  const data = await readJSON(filePath, { items: [] });
  
  if (!data.items) return false;
  
  const item = data.items.find(i => i.name.toLowerCase() === name.toLowerCase());
  if (!item) return false;
  
  item[field] = value;
  await writeJSON(filePath, data);
  return true;
}

async function renameItem(guildId, oldName, newName) {
  const filePath = getFilePath(guildId, 'items');
  const data = await readJSON(filePath, { items: [] });
  
  if (!data.items) return false;
  
  const item = data.items.find(i => i.name.toLowerCase() === oldName.toLowerCase());
  if (!item) return false;
  
  const collectablesPath = getFilePath(guildId, 'collectables');
  const collectablesData = await readJSON(collectablesPath, {});
  
  for (const userId in collectablesData) {
    if (collectablesData[userId][oldName]) {
      collectablesData[userId][newName] = collectablesData[userId][oldName];
      delete collectablesData[userId][oldName];
    }
  }
  
  await writeJSON(collectablesPath, collectablesData);
  
  item.name = newName;
  await writeJSON(filePath, data);
  return true;
}

async function getConfig(guildId, key) {
  const filePath = getFilePath(guildId, 'config');
  const config = await readJSON(filePath, {});
  return config[key] || null;
}

async function setConfig(guildId, key, value) {
  const filePath = getFilePath(guildId, 'config');
  const config = await readJSON(filePath, {});
  config[key] = value;
  await writeJSON(filePath, config);
}

async function getRandomItemWithPity(guildId, userId) {
  const items = await getAllItems(guildId);
  
  if (items.length === 0) return null;
  
  const pityData = await getUserPity(guildId, userId);
  const pityMax = await getConfig(guildId, 'pity_max') || 90;
  let selectedItem;
  
  const totalChance = items.reduce((sum, item) => sum + item.chance, 0);
  
  if (pityData.counter >= (pityMax - 1)) {
    const ssrItems = items.filter(item => item.rarity.toUpperCase() === 'SSR');
    
    if (ssrItems.length > 0) {
      if (pityData.guaranteedPromo) {
        const promoItems = ssrItems.filter(item => item.promo);
        if (promoItems.length > 0) {
          const promoTotalChance = promoItems.reduce((sum, item) => sum + item.chance, 0);
          let random = Math.random() * promoTotalChance;
          for (const item of promoItems) {
            random -= item.chance;
            if (random <= 0) {
              selectedItem = item;
              break;
            }
          }
        }
      }
      
      if (!selectedItem) {
        const ssrTotalChance = ssrItems.reduce((sum, item) => sum + item.chance, 0);
        let random = Math.random() * ssrTotalChance;
        for (const item of ssrItems) {
          random -= item.chance;
          if (random <= 0) {
            selectedItem = item;
            break;
          }
        }
      }
    }
  }
  
  if (!selectedItem) {
    let random = Math.random() * totalChance;
    for (const item of items) {
      random -= item.chance;
      if (random <= 0) {
        selectedItem = item;
        break;
      }
    }
  }
  
  if (!selectedItem && items.length > 0) {
    selectedItem = items[0];
  }
  
  if (selectedItem && selectedItem.rarity.toUpperCase() === 'SSR') {
    await resetPity(guildId, userId, selectedItem.promo);
  } else {
    await incrementPity(guildId, userId);
  }
  
  if (selectedItem && (selectedItem.objectType === 'persona' || selectedItem.objectType === 'objeto' || selectedItem.objectType === 'object')) {
    await incrementCollectable(guildId, userId, selectedItem.name);
  }
  
  return selectedItem;
}

async function getUserPity(guildId, userId) {
  const filePath = getFilePath(guildId, 'pity');
  const data = await readJSON(filePath, {});
  
  if (!data[userId]) {
    data[userId] = { counter: 0, guaranteedPromo: false };
  }
  
  return data[userId];
}

async function incrementPity(guildId, userId) {
  const filePath = getFilePath(guildId, 'pity');
  const data = await readJSON(filePath, {});
  
  if (!data[userId]) {
    data[userId] = { counter: 0, guaranteedPromo: false };
  }
  
  data[userId].counter += 1;
  await writeJSON(filePath, data);
}

async function resetPity(guildId, userId, wasPromo) {
  const filePath = getFilePath(guildId, 'pity');
  const data = await readJSON(filePath, {});
  
  if (!data[userId]) {
    data[userId] = { counter: 0, guaranteedPromo: false };
  }
  
  data[userId].counter = 0;
  data[userId].guaranteedPromo = !wasPromo;
  
  await writeJSON(filePath, data);
}

async function getUserTokens(guildId, userId) {
  const filePath = getFilePath(guildId, 'tokens');
  const data = await readJSON(filePath, {});
  return data[userId] || {};
}

async function addTokens(guildId, userId, tokenType, amount) {
  const filePath = getFilePath(guildId, 'tokens');
  const data = await readJSON(filePath, {});
  
  if (!data[userId]) {
    data[userId] = {};
  }
  
  if (!data[userId][tokenType]) {
    data[userId][tokenType] = 0;
  }
  
  data[userId][tokenType] += amount;
  await writeJSON(filePath, data);
}

async function removeTokens(guildId, userId, tokenType, amount) {
  const filePath = getFilePath(guildId, 'tokens');
  const data = await readJSON(filePath, {});
  
  if (!data[userId] || !data[userId][tokenType] || data[userId][tokenType] < amount) {
    return false;
  }
  
  data[userId][tokenType] -= amount;
  await writeJSON(filePath, data);
  return true;
}

async function resetAllTokens(guildId) {
  const filePath = getFilePath(guildId, 'tokens');
  await writeJSON(filePath, {});
}

async function getUserCollectables(guildId, userId) {
  const filePath = getFilePath(guildId, 'collectables');
  const data = await readJSON(filePath, {});
  return data[userId] || {};
}

async function incrementCollectable(guildId, userId, itemName) {
  const filePath = getFilePath(guildId, 'collectables');
  const data = await readJSON(filePath, {});
  
  if (!data[userId]) {
    data[userId] = {};
  }
  
  if (!data[userId][itemName]) {
    data[userId][itemName] = 0;
  }
  
  data[userId][itemName] += 1;
  await writeJSON(filePath, data);
}

async function resetCollectable(guildId, userId, itemName) {
  const filePath = getFilePath(guildId, 'collectables');
  const data = await readJSON(filePath, {});
  
  if (data[userId] && data[userId][itemName]) {
    data[userId][itemName] = 0;
    await writeJSON(filePath, data);
  }
}

async function getExchangeRules(guildId) {
  const filePath = getFilePath(guildId, 'exchanges');
  const data = await readJSON(filePath, { exchanges: [] });
  return data.exchanges || [];
}

async function createExchange(guildId, rewardName) {
  const filePath = getFilePath(guildId, 'exchanges');
  const data = await readJSON(filePath, { exchanges: [] });
  
  if (!data.exchanges) {
    data.exchanges = [];
  }
  
  const id = (data.exchanges.length + 1).toString();
  data.exchanges.push({
    id,
    rewardName,
    prices: {},
    roleGiven: null
  });
  
  await writeJSON(filePath, data);
  return id;
}

async function updateExchangePrices(exchangeId, prices) {
  const exchanges = await getExchangeRules(guildId);
  const exchange = exchanges.find(e => e.id === exchangeId);
  if (exchange) {
    exchange.prices = prices;
    const filePath = getFilePath(guildId, 'exchanges');
    await writeJSON(filePath, { exchanges });
  }
}

async function updateExchangeRole(exchangeId, roleGiven) {
  const exchanges = await getExchangeRules(guildId);
  const exchange = exchanges.find(e => e.id === exchangeId);
  if (exchange) {
    exchange.roleGiven = roleGiven;
    const filePath = getFilePath(guildId, 'exchanges');
    await writeJSON(filePath, { exchanges });
  }
}

async function resetAllExchanges(guildId) {
  const filePath = getFilePath(guildId, 'exchanges');
  const data = await readJSON(filePath, { exchanges: [] });
  const count = data.exchanges ? data.exchanges.length : 0;
  await writeJSON(filePath, { exchanges: [] });
  return count;
}

function getRarityColor(rarity) {
  const colors = {
    'SSR': 0xFFD700,
    'SR': 0xA020F0,
    'UR': 0x3498DB,
    'R': 0x2ECC71
  };
  return colors[rarity.toUpperCase()] || 0x808080;
}

function getRarityStars(rarity) {
  const stars = {
    'SSR': '<:RStarR:1425259849477918837><:RStar:1425259703981703208><:RStarR:1425259849477918837><:RStar:1425259703981703208><:RStarR:1425259849477918837>',
    'SR': '<:RStarR:1425259849477918837><:RStar:1425259703981703208><:RStarR:1425259849477918837><:RStar:1425259703981703208>',
    'UR': '<:RStarR:1425259849477918837><:RStar:1425259703981703208><:RStarR:1425259849477918837>',
    'R': '<:RStarR:1425259849477918837><:RStar:1425259703981703208>'
  };
  return stars[rarity.toUpperCase()] || '⭐';
}

async function getTokenEmoji(guildIdOrRarity, rarityParam) {
  let rarity;
  if (typeof guildIdOrRarity === 'string' && guildIdOrRarity.length < 5) {
    rarity = guildIdOrRarity;
  } else if (rarityParam) {
    rarity = rarityParam;
  } else {
    rarity = guildIdOrRarity;
  }
  
  const emojis = {
    'SSR': '<:SSRTK:1425246335472369857>',
    'SR': '<:SRTK:1425246269307359395>',
    'UR': '<:URTK:1425246198071033906>',
    'R': '<:RTK:1425246396654682272>'
  };
  return emojis[rarity.toUpperCase()] || '🎫';
}

async function getRarityTokenEmoji(rarity) {
  return await getTokenEmoji(rarity);
}

module.exports = {
  ensureDataFiles,
  getAllItems,
  getItemByName,
  createItem,
  deleteItem,
  resetAllItems,
  updateItem,
  renameItem,
  getConfig,
  setConfig,
  getRandomItemWithPity,
  getUserPity,
  incrementPity,
  resetPity,
  getUserTokens,
  addTokens,
  removeTokens,
  resetAllTokens,
  getUserCollectables,
  incrementCollectable,
  resetCollectable,
  getExchangeRules,
  createExchange,
  updateExchangePrices,
  updateExchangeRole,
  resetAllExchanges,
  getRarityColor,
  getRarityStars,
  getTokenEmoji,
  getRarityTokenEmoji
};
