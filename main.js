const { Client, GatewayIntentBits, Partials, REST, Routes, Collection } = require('discord.js');
const Discord = require('discord.js');
const chalk = require('chalk');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const activityManager = require('./events/botActivity');
const cacheData = require('./events/cacheData');
const Table = require('cli-table3');
//@dkonrad94
let config;
try {
    const fileContents = fs.readFileSync('./first_setup.yaml', 'utf8');
    config = yaml.load(fileContents);
} catch (e) {
    console.log('Error reading first_setup.yaml');
    process.exit(1);
}

const { Token, ClientID, Guild_ID } = config.BOT_SETUP;
if (!Token || !ClientID || !Guild_ID || Guild_ID.length === 0) {
    console.error('Missing Token, ClientID, or Guild_ID in YAML config file');
    return;
}

// Guild ID-s (maximum 6)
if (Guild_ID.length > 6) {
    console.error('Too many guild IDs provided. Maximum 6 guilds are allowed.');
    process.exit(1);
}

global.client = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
    ],
    partials: [
        Partials.Channel,
    ],
});

global.client.messagesCache = new Collection();
global.client.commandArray = [];
client.commands = new Discord.Collection();
client.events = new Discord.Collection();
client.loadStatus = { commandsLoaded: false, eventsLoaded: false }; // Betöltési állapotok követése
const rest = new REST({ version: '10' }).setToken(Token);

client.on('ready', async () => {
    // Bot aktivitások frissítése
    activityManager.updateActivities(client);

    const printTable = (cacheStatus = "Please wait! ", messageStatus = "Loading...") => {
        console.clear();
        console.log(chalk.hex('#ff0064').bold`
 _           _   _  __             _                _                                  _   
| |         | | (_)/ _|           | |              | |                                | |  
| |__   ___ | |_ _| |_ _   _    __| | _____   _____| | ___  _ __  _ __ ___   ___ _ __ | |_ 
| '_ \\ / _ \\| __| |  _| | | |  / _\` |/ _ \\ \\ / / _ \\ |/ _ \\| '_ \\| '_ \` _ \\ / _ \\ '_ \\| __|
| |_) | (_) | |_| | | | |_| | | (_| |  __/\\ V /  __/ | (_) | |_) | | | | | |  __/ | | | |_ 
|_.__/ \\___/ \\__|_|_|  \\__, |  \\__,_|\\___| \\_/ \\___|_|\\___/| .__/|_| |_| |_|\\___|_| |_|\\__|
                        __/ |                              | |                             
                       |___/                               |_|                                      `);
        console.log(chalk.hex('#f0f0f0')('___________________________________________________________________________________________\n'));
        console.log(chalk.hex('#f0f0f0')(' API Status: ') + chalk.hex('#28B463').bold('Ok!'));
        console.log(chalk.hex('#f0f0f0')(' License: ') + chalk.hex('#28B463').bold('Valid!'));
        console.log(chalk.hex('#f0f0f0')(' Bot Version: ') + chalk.hex('#28B463').bold('Up to date: 1.0.0!\n'));


        const table = new Table({
            head: [
                chalk.white.bold('Action'),
                chalk.white.bold('Status')
            ],
            style: { head: [], border: chalk.white },
            colAligns: ['center', 'center'], // Csak a fejléceket igazítjuk középre
            colWidths: [59, 29],
        });

        // Üres sor beszúrása a fejlécek után
        table.push(
            [{ colSpan: 2, content: '' }] // Üres sor, amely mindkét oszlopot lefedi
        );

        // Balra igazított tartalom, frissítve a meglévő sorokat
        table.push(
            [
                {
                    content: chalk.hex('#f0f0f0')('• Load commands and events\n\n[SLASH COMMANDS]\n[EVENTS]\n[DATABASE]'),
                    hAlign: 'left'
                },
                {
                    content: chalk.hex('#fffae6')(
                        `${client.loadStatus.commandsLoaded ? `\n\n${client.commandCount.toString()} command file loaded` : 'Please wait...'}\n` +
                        `${client.loadStatus.eventsLoaded ? `${client.eventCount.toString()} event file loaded` : 'Please wait...'}\n` +
                        `${client.dbStatus}`
                    ),
                    hAlign: 'left'
                }
            ],
            [{ content: chalk.hex('#f0f0f0')('Cache Status (max 25 per channel)'), hAlign: 'left' }, { content: chalk.hex('#fffae6')(cacheStatus), hAlign: 'left' }],
            [{ content: chalk.hex('#f0f0f0')('Total Messages / Channels Cached'), hAlign: 'left' }, { content: chalk.hex('#fffae6')(messageStatus), hAlign: 'left' }]
        );

        // Táblázat megjelenítése
        console.log(table.toString());
    };

    // Parancsok és események betöltése
    const commandCount = await require(`./handlers/commandHandler`)(client, Discord);
    const eventCount = await require(`./handlers/eventHandler`)(client, Discord);
    const dbStatus = require('./commands/Other/createdb').getDbStatus();
    const dbError = require('./commands/Other/createdb').getDbError();

    // Státuszok beállítása
    client.commandCount = commandCount;
    client.eventCount = eventCount;
    client.dbStatus = dbStatus;
    client.loadStatus.commandsLoaded = true;
    client.loadStatus.eventsLoaded = true;

    // Kezdeti táblázat megjelenítése
    printTable();

    // Cachelés indítása és várakozás a befejezésére
    const { totalMessagesCached, totalChannelsCached } = await cacheData.execute(client);

    // Cachelés befejeződött, frissítjük a táblázatot helyes adatokkal
    printTable("Cache Ok!", `${totalMessagesCached} message(s) / ${totalChannelsCached} channel(s)`);

    // Hibainformációk kiírása, ha van
    if (dbError) {
        console.error(chalk.red(dbError));
    }

    // Guild specifikus parancsok törlése és regisztrálása
    try {
        for (const guildId of Guild_ID) {
            // Globális parancsok törlése
            await rest.put(
                Routes.applicationCommands(ClientID),
                { body: [] }
            );
            // console.log('Globális parancsok törölve');

            // Új parancsok regisztrálása
            await rest.put(
                Routes.applicationGuildCommands(ClientID, guildId),
                { body: global.client.commandArray },
            );
            // console.log(`Registered commands for guild: ${guildId}`);
        }
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Bot bejelentkezése
try {
    client.login(Token);
} catch (error) {
    console.error('Failed to login:', error);
}

// Hibakezelés
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});