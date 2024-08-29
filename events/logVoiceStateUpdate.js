const { EmbedBuilder } = require('discord.js');
const moment = require('moment');
const yaml = require('js-yaml');
const fs = require('fs');

let config;
try {
    config = yaml.load(fs.readFileSync('config_files/voice_log_config.yaml', 'utf8'));
} catch (e) {
    console.error("Error reading voice_log_config.yaml", e);
    process.exit(1);
}

const getDateFormat = (formatKey) => config.DATE_FORMATS[formatKey] || config.DATE_FORMATS.Default;

module.exports = {
    name: 'voiceStateUpdate',
    execute: async (oldState, newState, client) => {
        try {
            if (!config.LOGS_SETTINGS.Enabled) {
                return;
            }

            const logChannelId = config.LOGS_SETTINGS.LogChannelID[newState.guild.id];
            if (!logChannelId) {
                return;
            }

            const channel = client.channels.cache.get(logChannelId);
            if (!channel) {
                console.warn('Not found voice log channel.');
                return;
            }

            const guildName = newState.guild.name;

            if (!oldState.channelId && newState.channelId) {
                // User joined a voice channel
                const joinEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.VoiceJoin)
                    .setTitle(config.TRANSLATE.VoiceJoin.Title)
                    .setThumbnail(newState.member.user.displayAvatarURL({ format: 'png', size: 1024 }))
                    .addFields(
                        { name: config.TRANSLATE.VoiceJoin.Fields.Field_1.Title, value: `<@${newState.member.user.id}>`, inline: true },
                        { name: config.TRANSLATE.VoiceJoin.Fields.Field_2.Title, value: newState.member.user.tag, inline: true },
                        { name: config.TRANSLATE.VoiceJoin.Fields.Field_3.Title, value: newState.member.user.id, inline: true },
                        { name: config.TRANSLATE.VoiceJoin.Fields.Field_4.Title, value: newState.channel.url, inline: true },
                        { name: config.TRANSLATE.VoiceJoin.Fields.Field_5.Title, value: moment().format(getDateFormat('Join')), inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: config.TRANSLATE.VoiceJoin.footer.replace('{guildName}', guildName), iconURL: client.user.displayAvatarURL() });

                await channel.send({ embeds: [joinEmbed] });
            } else if (oldState.channelId && !newState.channelId) {
                // User left a voice channel
                const leaveEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.VoiceLeave)
                    .setTitle(config.TRANSLATE.VoiceLeave.Title)
                    .setThumbnail(oldState.member.user.displayAvatarURL({ format: 'png', size: 1024 }))
                    .addFields(
                        { name: config.TRANSLATE.VoiceLeave.Fields.Field_1.Title, value: `<@${oldState.member.user.id}>`, inline: true },
                        { name: config.TRANSLATE.VoiceLeave.Fields.Field_2.Title, value: oldState.member.user.tag, inline: true },
                        { name: config.TRANSLATE.VoiceLeave.Fields.Field_3.Title, value: oldState.member.user.id, inline: true },
                        { name: config.TRANSLATE.VoiceLeave.Fields.Field_4.Title, value: oldState.channel.url, inline: true },
                        { name: config.TRANSLATE.VoiceLeave.Fields.Field_5.Title, value: moment().format(getDateFormat('Leave')), inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: config.TRANSLATE.VoiceLeave.footer.replace('{guildName}', guildName), iconURL: client.user.displayAvatarURL() });

                await channel.send({ embeds: [leaveEmbed] });
            } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                // User switched voice channels
                const switchEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.VoiceSwitch)
                    .setTitle(config.TRANSLATE.VoiceSwitch.Title)
                    .setThumbnail(newState.member.user.displayAvatarURL({ format: 'png', size: 1024 }))
                    .addFields(
                        { name: config.TRANSLATE.VoiceSwitch.Fields.Field_1.Title, value: `<@${newState.member.user.id}>`, inline: true },
                        { name: config.TRANSLATE.VoiceSwitch.Fields.Field_2.Title, value: newState.member.user.tag, inline: true },
                        { name: config.TRANSLATE.VoiceSwitch.Fields.Field_3.Title, value: newState.member.user.id, inline: true },
                        { name: config.TRANSLATE.VoiceSwitch.Fields.Field_4.Title, value: oldState.channel.url, inline: true },
                        { name: config.TRANSLATE.VoiceSwitch.Fields.Field_5.Title, value: newState.channel.url, inline: true },
                        { name: config.TRANSLATE.VoiceSwitch.Fields.Field_6.Title, value: moment().format(getDateFormat('Switch')), inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: config.TRANSLATE.VoiceSwitch.footer.replace('{guildName}', guildName), iconURL: client.user.displayAvatarURL() });

                await channel.send({ embeds: [switchEmbed] });
            }
        } catch (error) {
            console.error('An error occurred during the voiceStateUpdate event:', error);
        }
    }
};