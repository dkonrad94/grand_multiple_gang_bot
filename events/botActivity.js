const { ActivityType } = require('discord.js');
const { GameDig } = require('gamedig');
const yaml = require('js-yaml');
const fs = require('fs');

const getDb = require('../commands/Other/createdb');
const config = yaml.load(fs.readFileSync('first_setup.yaml', 'utf8'));

const typeMap = {
    "Playing": ActivityType.Playing,
    "Watching": ActivityType.Watching,
    "Listening": ActivityType.Listening,
    "Streaming": ActivityType.Streaming,
    "Competing": ActivityType.Competing
};


let toggle = true;

async function updateFivemStatus(client, activityConfig, status) {
    const activityType = typeMap[activityConfig.type] || ActivityType.Playing;

    try {
        const state = await GameDig.query({
            type: activityConfig.gametype,
            host: activityConfig.ip_address
        });
        // console.log('GameDig state:', state);
        const playerCount = parseInt(state.numplayers, 10) || 0;
        const maxPlayers = parseInt(state.maxplayers, 10) || 'N/A';

        // Emoji váltakozás
        const onlineEmoji = toggle ? '🟢' : '⚪';

        const activityName = config.activity.activityName
            .replace('{onlineEmoji}', onlineEmoji)
            .replace('{playerCount}', `${playerCount}`)
            .replace('{maxPlayers}', `${maxPlayers}`)
            ;

        await client.user.setPresence({
            activities: [{ name: activityName, type: activityType }],
            status: status || 'online',
        });

        toggle = !toggle;

    } catch (error) {
        const offlineEmoji = toggle ? '🔴' : '⚪';
        const activityName = `${offlineEmoji} ${activityConfig.offline_activity || "Server Offline"}`;

        await client.user.setPresence({
            activities: [{ name: activityName, type: activityType }],
            status: status || 'online',
        });

        toggle = !toggle;
    }
}

function startPeriodicFivemStatusUpdate(client, activityConfig, status, interval) {
    setInterval(() => {
        updateFivemStatus(client, activityConfig, status);
    }, interval);
}



async function updateTicketStats(client, activityConfig, status) {
    let statusIndex = 0;
    const activities = activityConfig.activities || [];

    if (activities.length === 0) {
        return;
    }

    setInterval(async () => {
        try {
            // 1. Összes jegy (total-tickets)
            const totalTickets = await getTotalTicketsFromDatabase();

            // 2. Üzenetek száma lezárt jegyekben (total-messages)
            const totalMessagesInClosedTickets = await getTotalMessagesInClosedTicketsFromDatabase();

            // 3. Összes emberi tag (total-users)
            let totalUsers = 0;
            for (const guild of client.guilds.cache.values()) {
                try {
                    const members = await guild.members.fetch();
                    totalUsers += members.filter(member => !member.user.bot).size;
                } catch (error) {
                    console.error(`Failed to fetch members for guild ${guild.id}:`, error);
                }
            }

            const activityName = activities[statusIndex % activities.length]
                .replace('{total-tickets}', totalTickets)
                .replace('{total-users}', totalUsers)
                .replace('{total-messages}', totalMessagesInClosedTickets);

            const activityType = typeMap[activityConfig.type];

            await client.user.setPresence({
                activities: [{ name: activityName, type: activityType }],
                status: status,
            });

            statusIndex++;

        } catch (error) {
            console.error('Error updating TicketStats:', error);
        }
    }, activityConfig.Interval * 1000);
}


async function getTotalTicketsFromDatabase() {
    const db = getDb();

    return new Promise((resolve, reject) => {
        db.query('SELECT MAX(id) AS maxId FROM tickets', (err, results) => {
            if (err) {
                console.error('SQL Error:', err);
                return reject(err);
            }
            if (!results || !results[0] || typeof results[0].maxId === 'undefined') {
                return reject(new Error('No results or unexpected format'));
            }
            resolve(results[0].maxId || 0);
        });
    });
}

async function getTotalMessagesInClosedTicketsFromDatabase() {
    const db = getDb();

    return new Promise((resolve, reject) => {
        db.query('SELECT SUM(total_messages) AS totalMessages FROM tickets WHERE ticket_status = "closed"', (err, results) => {
            if (err) {
                console.error('SQL Error:', err);
                return reject(err);
            }
            if (!results || !results[0] || typeof results[0].totalMessages === 'undefined') {
                return reject(new Error('No results or unexpected format'));
            }
            resolve(results[0].totalMessages || 0);
        });
    });
}



function updateCustomActivity(client, activityConfig, status) {
    let activityIndex = 0;

    async function setNextActivity() {
        const activity = activityConfig[activityIndex % activityConfig.length];
        const activityType = typeMap[activity.type];

        await client.user.setPresence({
            activities: [{ name: activity.text, type: activityType }],
            status: status,
        });

        setTimeout(() => {
            activityIndex++;
            setNextActivity();
        }, activity.interval);
    }
    setNextActivity();
}

function updateActivities(client) {
    if (!config || !config.BOT_ACTIVITY) {
        console.warn('No BOT_ACTIVITY configuration found.');
        return;
    }

    for (const guildId in config.BOT_ACTIVITY) {
        const settings = config.BOT_ACTIVITY[guildId];
        const selectedActivity = settings.SelectedActivity;
        const status = settings.status;

        if (selectedActivity === 'FivemStatus') {
            const interval = settings.FivemStatusActivity.interval;
            startPeriodicFivemStatusUpdate(client, settings.FivemStatusActivity, status, interval);
        } else if (selectedActivity === 'CustomActivity') {
            updateCustomActivity(client, settings.CustomActivityConfig, status);
        } else if (selectedActivity === 'TicketStats') {
            updateTicketStats(client, settings.TicketStatsActivity, status);
        } else {
            console.warn('No valid activity selected.');
        }
    }
}

module.exports = {
    updateActivities
};
