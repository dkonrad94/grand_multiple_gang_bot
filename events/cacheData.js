module.exports = {
    async execute(client) {
        const MAX_RETRIES = 3;

        async function fetchMessagesWithRetry(channel, retries = 0) {
            try {
                const messages = await channel.messages.fetch({ limit: 25 });
                return messages;
            } catch (error) {
                if (error.status === 500 && retries < MAX_RETRIES) {
                    console.log(`Retrying... (${retries + 1}/${MAX_RETRIES})`);
                    return await fetchMessagesWithRetry(channel, retries + 1);
                } else {
                    console.error(`[ERROR] Failed to fetch messages for channel: ${channel.name} in guild: ${channel.guild.name}`, error);
                    throw error;
                }
            }
        }

        let totalMessagesCached = 0;
        let totalChannelsCached = 0;

        for (const guild of client.guilds.cache.values()) {
            for (const channel of guild.channels.cache.values()) {
                if (channel.isTextBased()) {
                    try {
                        const messages = await fetchMessagesWithRetry(channel);
                        totalMessagesCached += messages.size;
                        totalChannelsCached += 1;
                    } catch (error) {
                        console.error(`Failed to fetch messages for channel: ${channel.name} in guild: ${guild.name}`);
                    }
                }
            }
        }

        return { totalMessagesCached, totalChannelsCached };
    }
};