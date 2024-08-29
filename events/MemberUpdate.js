const { Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const moment = require('moment');

let config;
try {
    config = yaml.load(fs.readFileSync('config_files/member_update.yaml', 'utf8'));
} catch (e) {
    console.error('Error reading member_update.yaml', e);
    process.exit(1);
}

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        if (newMember.isCommunicationDisabled()) {
            return;
        }

        const oldRoles = oldMember.roles.cache.map(role => role.id);
        const newRoles = newMember.roles.cache.map(role => role.id);
        const addedRoles = newRoles.filter(role => !oldRoles.includes(role));
        const removedRoles = oldRoles.filter(role => !newRoles.includes(role));

        if (addedRoles.length === 0 && removedRoles.length === 0) {
            return;
        }

        const guild = newMember.guild;
        const targetUser = newMember.user;
        const profileUrl = `https://discord.com/users/${newMember.id}`;
        const date = moment().format(config.DATE_FORMATS.Default);

        let embedColor = config.EMBED_SETTINGS.Color;
        if (addedRoles.length > 0 && removedRoles.length === 0) {
            embedColor = config.EMBED_SETTINGS.AddColor;
        } else if (removedRoles.length > 0 && addedRoles.length === 0) {
            embedColor = config.EMBED_SETTINGS.RemoveColor;
        } else if (addedRoles.length > 0 && removedRoles.length > 0) {
            embedColor = config.EMBED_SETTINGS.MixedColor;
        }

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(config.EMBED_SETTINGS.Title)
            .setDescription(
                config.EMBED_SETTINGS.Description
                    .replace('{guildName}', guild.name)
                    .replace('{user}', `<@${newMember.id}>`)
                    .replace('{date}', `${date}`)
            )
            .setAuthor({ name: `${config.EMBED_SETTINGS.Author}${targetUser.tag}`, iconURL: newMember.displayAvatarURL({ size: 1024 }), url: profileUrl })
            .setThumbnail(newMember.displayAvatarURL({ size: 1024 }))
            .addFields({ name: " ", value: "~~----------------------------------------------------~~\n" })
            .addFields(
                { name: config.EMBED_SETTINGS.fields.User.Value, value: `<@${newMember.id}>`, inline: true },  // Javítva kisbetűs `fields`
                { name: config.EMBED_SETTINGS.fields.Username.Value, value: targetUser.tag, inline: true },
                { name: config.EMBED_SETTINGS.fields.DiscordID.Value, value: newMember.id, inline: true },
                { name: ' ', value: '\u200B' },
            )
            .setFooter({ text: config.EMBED_SETTINGS.Footer.replace('{guildName}', guild.name), iconURL: newMember.client.user.displayAvatarURL() })
            .setTimestamp();

        const previousRolesNames = oldRoles.map(roleId => roleId === newMember.guild.id ? 'everyone' : `<@&${roleId}>`).join(', ');
        embed.addFields({ name: config.EMBED_SETTINGS.PreviousRoles, value: previousRolesNames, inline: false });

        if (addedRoles.length > 0) {
            const addedRoleNames = addedRoles.map(roleId => roleId === newMember.guild.id ? 'everyone' : `<@&${roleId}>`).join(', ');
            embed.addFields({ name: config.EMBED_SETTINGS.AddedRoles, value: addedRoleNames, inline: false });
        }

        if (removedRoles.length > 0) {
            const removedRoleNames = removedRoles.map(roleId => roleId === newMember.guild.id ? 'everyone' : `<@&${roleId}>`).join(', ');
            embed.addFields({ name: config.EMBED_SETTINGS.RemoveRoles, value: removedRoleNames, inline: false });
        }

        const logChannelId = config.LOGS_SETTINGS[newMember.guild.id];
        if (logChannelId) {
            const logChannel = newMember.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                await logChannel.send({ embeds: [embed] });
            }
        }
    },
};