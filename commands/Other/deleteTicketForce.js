const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const getDb = require('./createdb');

let config;
try {
    const fileContents = fs.readFileSync('config_files/ticket_config.yaml', 'utf8');
    config = yaml.load(fileContents);
} catch (e) {
    console.log('Error reading ticket_config.yaml for Delete Ticket Force');
    process.exit(1);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.OTHER_COMMANDS.DeleteForceTicket.Command || 'deleteticket')
        .setDescription(config.OTHER_COMMANDS.DeleteForceTicket.CmdDescription || 'Deletes a ticket channel if the conditions are met.'),
    async execute(interaction) {
        const channel = interaction.channel;
        const channelName = channel.name;
        const guildId = interaction.guildId;
        const memberRoles = interaction.member.roles.cache;
        const db = getDb();

        const allowedRoles = config.OTHER_COMMANDS.DeleteForceTicket.SupportRoles[guildId] || [];
        const hasPermission = memberRoles.some(role => allowedRoles.includes(role.id));

        if (!hasPermission) {
            const noPermissionEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.Error || '')
                .setDescription(config.TRANSLATE.NoPermission || 'You do not have permission to use this command.');
            await interaction.reply({ embeds: [noPermissionEmbed], ephemeral: true });
            return;
        }

        let matchFound = false;
        for (const key in config) {
            try {
                const configEntry = config[key];
                if (configEntry && configEntry.CreatedChannelName) {
                    const configChannelNamePrefix = configEntry.CreatedChannelName.split('-')[0];
                    if (configChannelNamePrefix && channelName.startsWith(configChannelNamePrefix)) {
                        matchFound = true;
                        break;
                    }
                }
            } catch (error) {
                console.error(`Error processing config for key ${key}:`, error);
            }
        }

        if (matchFound) {
            const deleteTime = config.SETTINGS?.DeleteTime || 10; // Default to 10 seconds if not set

            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.Warning || '')
                .setTitle(config.TRANSLATE.TicketDeletion || 'Ticket Deleted')
                .setDescription(
                    (config.TRANSLATE.DeleteTicketDesc || 'The channel will be deleted in `{deleteTime}` seconds.')
                        .replace('{deleteTime}', deleteTime)
                        .replace('{channelName}', channel.name)
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Log the ticket deletion
            if (config.LOGS_SETTINGS?.LogTypes?.DeleteTicket?.Enabled) {
                const logChannelId = config.LOGS_SETTINGS.LogTypes.DeleteTicket.Channels[guildId];
                const logChannel = interaction.guild.channels.cache.get(logChannelId);

                if (logChannel) {
                    // Get ticket data from the database
                    const ticketData = await new Promise((resolve, reject) => {
                        db.query('SELECT * FROM tickets WHERE ticket_channel_id = ?', [channel.id], (err, results) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(results[0]);
                            }
                        });
                    });

                    const logEmbed = new EmbedBuilder()
                        .setColor(config.LOGS_SETTINGS.LogTypes.DeleteTicket.EmbedColor || '')
                        .setTitle(config.LOGS_SETTINGS.LogTypes.DeleteTicket.Title || 'Ticket Deletion Log')
                        .setDescription(
                            (config.LOGS_SETTINGS.LogTypes.DeleteTicket.Description || '')
                                .replace('{closedBy}', `<@${interaction.user.id}>`)
                                .replace('{claimedBy}', ticketData?.claimed_by ? `<@${ticketData.claimed_by}>` : config.LOGS_SETTINGS.LogTypes.DeleteTicket.IfNotClaimed || 'Not claimed by anyone.')
                                .replace('{openedBy}', ticketData?.userid_by_opened || 'N/A')
                                .replace('{channelName}', channel.name)
                                .replace('{openedCategory}', ticketData?.category_name || 'N/A')
                                .replace('{channelId}', channel.id)
                                .replace('{messageCount}', ticketData?.message_count || 'N/A')
                        )
                        .setFooter({
                            text: interaction.guild.name,
                            iconURL: interaction.client.user.displayAvatarURL(),
                        })
                        .setTimestamp();

                    await logChannel.send({ embeds: [logEmbed] });
                } else {
                    console.log('Log channel not found for delete ticket command.');
                }
            }

            // Delay the channel deletion
            setTimeout(async () => {
                await channel.delete();
            }, deleteTime * 1000); // Delay in seconds
        } else {
            const embed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.Warning || '')
                .setDescription(config.TRANSLATE.CannotDeleteTicket || 'This channel is not a ticket channel so you cannot delete it.')
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};