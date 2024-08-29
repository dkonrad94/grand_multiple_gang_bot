const { EmbedBuilder } = require('discord.js');
const moment = require('moment');
const yaml = require('js-yaml');
const fs = require('fs');

let config;
try {
    config = yaml.load(fs.readFileSync('config_files/welcome_leave_config.yaml', 'utf8'));
} catch (e) {
    console.log("Error reading welcome_leave_config.yaml", e);
    process.exit(1);
}

const getDateFormat = (formatKey) => config.DATE_FORMATS[formatKey] || config.DATE_FORMATS.Default;

module.exports = {
    guildMemberAdd: {
        name: 'guildMemberAdd',
        async execute(member, client) {
            try {
                if (!config.LOGS_SETTINGS.Enabled) {
                    return;
                }

                const logChannelId = config.LOGS_SETTINGS.WelcomeLogChannelID[member.guild.id];
                if (!logChannelId) {
                    return;
                }

                const channel = client.channels.cache.get(logChannelId);
                if (!channel) {
                    console.error('Not found Welcome log channel.');
                    return;
                }

                const joinEmbed = new EmbedBuilder()
                    .setColor(config.embed_colors.member_join)
                    .setTitle(config.TRANSLATE.MemberJoin.Title)
                    .setDescription(config.TRANSLATE.MemberJoin.Description)
                    .setThumbnail(member.user.displayAvatarURL({ format: 'png', size: 1024 }))
                    .addFields(
                        { name: config.TRANSLATE.MemberJoin.Fields.Field_1.Title, value: `<@${member.user.id}>`, inline: false },
                        { name: config.TRANSLATE.MemberJoin.Fields.Field_2.Title, value: member.user.id, inline: false },
                        { name: config.TRANSLATE.MemberJoin.Fields.Field_3.Title, value: member.user.tag, inline: false },
                        { name: config.TRANSLATE.MemberJoin.Fields.Field_4.Title, value: moment(member.user.createdAt).format(getDateFormat('Join')), inline: true },
                        { name: config.TRANSLATE.MemberJoin.Fields.Field_5.Title, value: moment(member.joinedAt).format(getDateFormat('Join')), inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: config.TRANSLATE.MemberJoin.footer.replace('{guildName}', member.guild.name), iconURL: client.user.displayAvatarURL() });

                await channel.send({ embeds: [joinEmbed] });
            } catch (error) {
                console.error('An error occurred during connection join-member:', error);
            }
        },
    },

    guildMemberRemove: {
        name: 'guildMemberRemove',
        async execute(member, client) {
            try {
                if (!config.LOGS_SETTINGS.Enabled) {
                    return;
                }

                const logChannelId = config.LOGS_SETTINGS.LeaveLogChannelID[member.guild.id];
                if (!logChannelId) {
                    return;
                }

                const channel = client.channels.cache.get(logChannelId);
                if (!channel) {
                    console.error('Not found Leave log channel.');
                    return;
                }

                const description = config.TRANSLATE.MemberLeave.Description
                    .replace(/{userId}/g, member.user.id)
                    .replace(/{userTag}/g, member.user.tag);

                const leaveEmbed = new EmbedBuilder()
                    .setColor(config.embed_colors.member_leave)
                    .setTitle(config.TRANSLATE.MemberLeave.Title)
                    .setDescription(description)
                    .setThumbnail(member.user.displayAvatarURL({ format: 'png', size: 1024 }))
                    .addFields(
                        { name: config.TRANSLATE.MemberLeave.Field.Field_1.Title, value: moment(member.joinedAt).format(getDateFormat('Leave')), inline: true },
                        { name: config.TRANSLATE.MemberLeave.Field.Field_2.Title, value: moment().format(getDateFormat('Leave')), inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: config.TRANSLATE.MemberLeave.footer.replace('{guildName}', member.guild.name), iconURL: client.user.displayAvatarURL() });

                await channel.send({ embeds: [leaveEmbed] });
            } catch (error) {
                console.error('An error occurred while leave-member:', error);
            }
        },
    }
};