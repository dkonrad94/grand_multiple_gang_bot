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
    console.log('Error reading ticket_config.yaml for Add Member');
    process.exit(1);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.OTHER_COMMANDS.AddMember.Command || 'addmember')
        .setDescription(config.OTHER_COMMANDS.AddMember.CmdDescription || 'Adds a member to the ticket.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription(config.OTHER_COMMANDS.AddMember.OptDescription || 'Select a user to add')
                .setRequired(true)
        ),
    async execute(interaction) {
        const channel = interaction.channel;
        const guildId = interaction.guildId;
        const memberRoles = interaction.member.roles.cache;
        const db = getDb();

        const allowedRoles = config.OTHER_COMMANDS.AddMember.SupportRoles[guildId] || [];
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
            const cannotAddCreatorEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.Warning || '')
                .setDescription(config.TRANSLATE.CannotAddCreator || 'You cannot add the ticket creator.');
            await interaction.reply({ embeds: [cannotAddCreatorEmbed], ephemeral: true });
            return;
        }

        const permissionOverwrites = channel.permissionOverwrites.cache.get(member.id);
        if (permissionOverwrites && permissionOverwrites.allow.has(PermissionsBitField.Flags.ViewChannel)) {
            const memberAlreadyAddedEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.Info || '')
                .setDescription(
                    (config.TRANSLATE.MemberAlreadyAdded || '{userName} is already added to this channel.')
                        .replace('{userID}', user.id)
                        .replace('{userName}', user.username)
                );
            await interaction.reply({ embeds: [memberAlreadyAddedEmbed], ephemeral: true });
            return;
        }

        // Add the member to the channel with the specified permissions
        await channel.permissionOverwrites.create(member, {
            ViewChannel: true,
            SendMessages: true,
            EmbedLinks: true,
            AttachFiles: true,
            AddReactions: true,
            UseExternalEmojis: true,
            MentionEveryone: true,
            ReadMessageHistory: true,
        });

        const embed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.Success || '')
            .setDescription(
                (config.TRANSLATE.AddMemberSuccess || '<@{userID}> | {userName} successfully added.')
                    .replace('{userID}', user.id)
                    .replace('{userName}', user.username)
            );

        await interaction.reply({ embeds: [embed], ephemeral: false });

        if (config.LOGS_SETTINGS?.LogTypes?.UserAdd?.Enabled) {
            const logChannelId = config.LOGS_SETTINGS.LogTypes.UserAdd.Channels[guildId];
            const logChannel = interaction.guild.channels.cache.get(logChannelId);

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(config.LOGS_SETTINGS.LogTypes.UserAdd.EmbedColor || '')
                    .setTitle(config.LOGS_SETTINGS.LogTypes.UserAdd.Title || 'User Added')
                    .setDescription(
                        (config.LOGS_SETTINGS.LogTypes.UserAdd.Description || '')
                            .replace('{userId}', interaction.user.id)
                            .replace('{userTag}', interaction.user.tag)
                            .replace('{addedUserId}', user.id)
                            .replace('{addedUser}', user.tag)
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
                console.log('Log channel not found for add member commands.');
            }
        }
    },
};