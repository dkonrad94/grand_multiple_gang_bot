const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const getDb = require('./createdb');
const fs = require('fs');
const yaml = require('js-yaml');

let config;
try {
    const fileContents = fs.readFileSync('config_files/ticket_config.yaml', 'utf8');
    config = yaml.load(fileContents);
} catch (e) {
    console.log('Error reading ticket_config.yaml for Remove Blacklist', e);
    process.exit(1);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.OTHER_COMMANDS.RemoveFromBlacklist.Command || 'removefromblacklist')
        .setDescription(config.OTHER_COMMANDS.RemoveFromBlacklist.CmdDescription || 'Removes a user from the blacklist.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription(config.OTHER_COMMANDS.RemoveFromBlacklist.OptDescription || 'Select a user to remove from the blacklist')
                .setRequired(true)
        ),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const guildId = interaction.guildId;
        const memberRoles = interaction.member.roles.cache;
        const db = getDb();

        const allowedRoles = config.OTHER_COMMANDS.RemoveFromBlacklist.SupportRoles[guildId] || [];
        const hasPermission = memberRoles.some(role => allowedRoles.includes(role.id));

        if (!hasPermission) {
            const noPermissionEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.Error || '')
                .setDescription(config.TRANSLATE.NoPermission || 'You do not have permission to use this command.');
            await interaction.reply({ embeds: [noPermissionEmbed], ephemeral: true });
            return;
        }

        const checkQuery = 'SELECT * FROM ticket_blacklist WHERE discord_user_id = ?';
        db.query(checkQuery, [user.id], (err, result) => {
            if (err) {
                console.error('Error checking blacklist:', err);
                const errorEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.Error || '')
                    .setDescription(config.TRANSLATE.BlacklistCheckError || 'An error occurred while checking the blacklist.');
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            if (result.length === 0) {
                const notBlacklistedEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.Warning || '')
                    .setDescription(
                        (config.TRANSLATE.UserNotBlacklisted || '<@{userID}> | {userName} is not on the blacklist.')
                            .replace('{userID}', user.id)
                            .replace('{userName}', user.tag)
                    );
                return interaction.reply({ embeds: [notBlacklistedEmbed], ephemeral: true });
            }

            const deleteQuery = 'DELETE FROM ticket_blacklist WHERE discord_user_id = ?';
            db.query(deleteQuery, [user.id], async (err, result) => {
                if (err) {
                    console.error('Error removing user from blacklist:', err);
                    const errorEmbed = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.Error || '')
                        .setDescription(config.TRANSLATE.BlacklistRemoveError || 'An error occurred while removing the user from the blacklist.');
                    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }

                const successEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.Success || '')
                    .setDescription(
                        (config.TRANSLATE.UserRemovedFromBlacklist || '<@{userID}> | {userName} has been successfully removed from the blacklist.')
                            .replace('{userID}', user.id)
                            .replace('{userName}', user.tag)
                    );
                await interaction.reply({ embeds: [successEmbed], ephemeral: true });

                if (config.LOGS_SETTINGS?.LogTypes?.UserRemovedFromBlacklist?.Enabled) {
                    const logChannelId = config.LOGS_SETTINGS.LogTypes.UserRemovedFromBlacklist.Channels[guildId];
                    const logChannel = interaction.guild.channels.cache.get(logChannelId);

                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor(config.LOGS_SETTINGS.LogTypes.UserRemovedFromBlacklist.EmbedColor || '')
                            .setTitle(config.LOGS_SETTINGS.LogTypes.UserRemovedFromBlacklist.Title || 'User Removed from Blacklist')
                            .setDescription(
                                (config.LOGS_SETTINGS.LogTypes.UserRemovedFromBlacklist.Description || '')
                                    .replace('{userId}', interaction.user.id)
                                    .replace('{userTag}', interaction.user.tag)
                                    .replace('{blacklistedUserId}', user.id)
                                    .replace('{blacklistedUser}', user.tag)
                            )
                            .setThumbnail(user.displayAvatarURL({ format: 'png', size: 1024 }))
                            .setFooter({
                                text: `${interaction.guild.name}`,
                                iconURL: interaction.client.user.displayAvatarURL(),
                            })
                            .setTimestamp();

                        await logChannel.send({ embeds: [logEmbed] });
                    } else {
                        console.log('Log channel not found for remove from blacklist command.');
                    }
                }
            });
        });
    },
};