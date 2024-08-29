const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const getDb = require('./createdb');

let config;
try {
    const fileContents = fs.readFileSync('config_files/ticket_config.yaml', 'utf8');
    config = yaml.load(fileContents);
} catch (e) {
    console.log('Error reading ticket_config.yaml for Remove Member');
    process.exit(1);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.OTHER_COMMANDS.RemoveMember.Command || 'removemember')
        .setDescription(config.OTHER_COMMANDS.RemoveMember.CmdDescription || 'Removes a member from the ticket')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription(config.OTHER_COMMANDS.RemoveMember.OptDescription || 'Select a user to remove')
                .setRequired(true)
        ),
    async execute(interaction) {
        const channel = interaction.channel;
        const guildId = interaction.guildId;
        const memberRoles = interaction.member.roles.cache;
        const db = getDb();

        const allowedRoles = config.OTHER_COMMANDS.RemoveMember.SupportRoles[guildId] || [];
        const hasPermission = memberRoles.some(role => allowedRoles.includes(role.id));

        if (!hasPermission) {
            const noPermissionEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.Error || '')
                .setDescription(config.TRANSLATE.NoPermission || 'No permission!');
            await interaction.reply({ embeds: [noPermissionEmbed], ephemeral: true });
            return;
        }

        const results = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM tickets WHERE ticket_channel_id = ?', [channel.id], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });

        const ticket = results[0];

        if (!ticket) {
            const notTicketChannelEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.Warning || '')
                .setDescription(config.TRANSLATE.NotATicketChannel || 'This is not a ticket channel.');
            await interaction.reply({ embeds: [notTicketChannelEmbed], ephemeral: true });
            return;
        }

        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
            const userNotFoundEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.Warning || '')
                .setDescription(config.TRANSLATE.UserNotFound || 'The user cannot be found on this server.');
            await interaction.reply({ embeds: [userNotFoundEmbed], ephemeral: true });
            return;
        }

        if (ticket.userid_by_opened === user.id) {
            const cannotRemoveCreatorEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.Error || '')
                .setDescription(config.TRANSLATE.CannotRemoveCreator || 'You cannot remove the creator of the ticket.');
            await interaction.reply({ embeds: [cannotRemoveCreatorEmbed], ephemeral: true });
            return;
        }

        const permissionOverwrites = channel.permissionOverwrites.cache.get(member.id);
        if (!permissionOverwrites || !permissionOverwrites.allow.has(PermissionsBitField.Flags.ViewChannel)) {
            const memberNotInChannelEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.Info || '')
                .setDescription(
                    (config.TRANSLATE.MemberNotInChannel || '{userName} is not found in this channel.')
                        .replace('{userID}', user.id)
                        .replace('{userName}', user.username)
                );
            await interaction.reply({ embeds: [memberNotInChannelEmbed], ephemeral: true });
            return;
        }

        await channel.permissionOverwrites.delete(member);

        const embed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.Success || '')
            .setDescription(
                (config.TRANSLATE.RemoveMemberSuccess || '{userName} successfully removed.')
                    .replace('{userID}', user.id)
                    .replace('{userName}', user.username)
            );

        await interaction.reply({ embeds: [embed], ephemeral: false });

        if (config.LOGS_SETTINGS?.LogTypes?.UserRemove?.Enabled) {
            const logChannelId = config.LOGS_SETTINGS.LogTypes.UserRemove.Channels[guildId];
            const logChannel = interaction.guild.channels.cache.get(logChannelId);

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(config.LOGS_SETTINGS.LogTypes.UserRemove.EmbedColor)
                    .setTitle(config.LOGS_SETTINGS.LogTypes.UserRemove.Title)
                    .setDescription(
                        (config.LOGS_SETTINGS.LogTypes.UserRemove.Description)
                            .replace('{userId}', interaction.user.id)
                            .replace('{userTag}', interaction.user.tag)
                            .replace('{removedUserId}', user.id)
                            .replace('{removedUser}', user.tag)
                            .replace('{openedBy}', ticket.userid_by_opened)
                            .replace('{channelName}', channel.name)
                            .replace('{categoryName}', ticket.category_name)
                            .replace('{channel}', channel.toString())
                    )
                    .setThumbnail(user.displayAvatarURL({ format: 'png', size: 1024 }))
                    .setFooter({
                        text: `${interaction.guild.name}`,
                        iconURL: interaction.client.user.displayAvatarURL(),
                    })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            } else {
                console.log('Log channel not found for remove member commands.');
            }
        }
    },
};