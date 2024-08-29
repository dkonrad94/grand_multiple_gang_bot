const fs = require('fs');
const path = require('path');

module.exports = async (client, Discord) => {
    let eventCount = 0;

    const loadEvents = () => {
        const eventFiles = fs
            .readdirSync(path.join(__dirname, '../events'))
            .filter((file) => file.endsWith('.js'));

        for (const file of eventFiles) {
            const event = require(`../events/${file}`);

            if (event.name && typeof event.execute === 'function') {
                client.on(event.name, (...args) => event.execute(...args, client));
                eventCount++;
            } else if (typeof event === 'object' && event !== null) {
                Object.keys(event).forEach(eventKey => {
                    const evt = event[eventKey];
                    if (typeof evt === 'object' && typeof evt.execute === 'function') {
                        client.on(evt.name, (...args) => evt.execute(...args, client));
                        eventCount++;
                    }
                });
            } else {
                console.error(`Failed to register event: ${file}. It is not a valid function or does not have a valid execute method.`);
            }
        }
    };

    loadEvents();
    client.loadStatus.eventsLoaded = true;
    return eventCount;
}