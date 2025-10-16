# Discord Gacha Bot 🎰

Bot de Discord tipo gacha con sistema de tiradas, roles, tokens, pity system y más. Perfecto para servidores que quieren un sistema de recompensas interactivo.

## Características Principales

- 🎰 Sistema de gacha con tiradas individuales (*spin) y múltiples (*spin10)
- 🎫 Sistema de tickets para controlar acceso
- ⭐ Rarezas: SSR (5★), SR (4★), UR (3★), R (2★)
- 🎯 Sistema de pity (garantía a los 90 pulls)
- 🔄 Tokens por duplicados
- 👥 Asignación automática de roles
- 🎒 Inventario de coleccionables
- 💱 Sistema de canjeo de tokens
- 🔒 Personajes secretos
- ⏱️ Timer configurable para GIFs de tirada
- 🌐 Configuración independiente por servidor

## Configuración Rápida

### 1. Obtener Token de Discord

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Crea una nueva aplicación o selecciona una existente
3. Ve a la sección "Bot"
4. Copia el token del bot
5. Activa los **Privileged Gateway Intents**:
   - Server Members Intent
   - Message Content Intent

### 2. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```
DISCORD_TOKEN=tu_token_aqui
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Ejecutar el Bot

```bash
npm start
```

## Despliegue en Cyberpanel

Este bot está optimizado para funcionar en Cyberpanel y otros servicios de hosting económicos.

### Pasos para Cyberpanel:

1. Sube todos los archivos del proyecto a tu servidor
2. Asegúrate de tener Node.js instalado (v18 o superior)
3. Crea el archivo `.env` con tu token
4. Ejecuta `npm install`
5. Para mantenerlo corriendo 24/7, usa PM2:

```bash
npm install -g pm2
pm2 start index.js --name "gacha-bot"
pm2 save
pm2 startup
```

## Comandos Principales

### Para Usuarios
- `*spin` - Hacer una tirada (requiere Ticket)
- `*spin10` - Hacer 10 tiradas (requiere Ticket x10)
- `*banner` - Ver premios disponibles
- `*tokens` o `*bal` - Ver tus tokens
- `*inventory` - Ver tu inventario
- `*pity` - Ver tu contador de pity
- `*canjear <ID>` - Canjear tokens

### Para Administradores
- `*createitem <nombre>` - Crear premio
- `*edititem <nombre> <campo> <valor>` - Editar premio
- `*setticketrole <rol>` - Configurar rol de ticket
- `*editpull <url>` - Configurar GIF de tirada
- `*editpulltimer <ms>` - Configurar duración del GIF
- `*createexchange <nombre>` - Crear canje
- `*fixhelp` - Ver todos los comandos

## Estructura del Proyecto

```
├── index.js              # Archivo principal del bot
├── server/
│   └── storage.js        # Sistema de almacenamiento (JSON)
├── utils/
│   └── itemSearch.js     # Utilidades de búsqueda
├── data/                 # Datos por servidor (se crea automáticamente)
├── package.json          # Dependencias
└── .env                  # Variables de entorno (crear manualmente)
```

## Soporte

Para problemas o preguntas, revisa la documentación completa con `*fixhelp` en Discord.

## Licencia

MIT
