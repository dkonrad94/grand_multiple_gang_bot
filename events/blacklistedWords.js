const { Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

let config;

try {
    config = yaml.load(fs.readFileSync('config_files/auto_moderation.yaml', 'utf8'));
} catch (e) {
    console.error("Error Auto Moderation configuration file not found!");
    process.exit(1);
}

let blacklistedWords = [];

try {
    const blacklistedWordsPath = path.join(__dirname, '../config_files/blacklistwords_Config', 'blacklistwords_list.json');
    const rawdata = fs.readFileSync(blacklistedWordsPath);
    const data = JSON.parse(rawdata);
    blacklistedWords = data.blacklistedWords;
} catch (error) {
    console.error('Error reading blacklisted words file:', error.message);
}

const generatePattern = (word) => {
    const sanitizedWord = word
        .split('')
        .map(char => {
            if (/[a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(char)) {
                return `[${char.toLowerCase()}${char.toUpperCase()}][*?%/@]*`;
            } else {
                return `\\${char}`;
            }
        })
        .join('');
    return new RegExp(sanitizedWord, 'gi');
};

const checkForBlacklistedWords = (content) => {
    const sanitizedContent = content.replace(/[^a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ]/g, '').toLowerCase();
    return blacklistedWords.filter(word => {
        const sanitizedWord = word.toLowerCase();
        return sanitizedContent.includes(sanitizedWord) || generatePattern(sanitizedWord).test(content);
    });
};

const checkForRepeatedCharacters = (content) => {
    const containsMention = /<@!?[0-9]+>/.test(content) || /<@&[0-9]+>/.test(content);

    if (containsMention) return false;
    const allowedFormats = /^(\*\*|\*|__|_|``|~~|\|\|)[^\s]+(\*\*|\*|__|_|``|~~|\|\|)$/g;
    const repeatedPattern = /(.)\1{2,}/g;

    return !allowedFormats.test(content) && repeatedPattern.test(content);
};

const checkCapsLockUsage = (content) => {
    const totalLength = content.length;
    const uppercaseLength = (content.match(/[A-ZÁÉÍÓÖŐÚÜŰ]/g) || []).length;
    const acceptedPercentage = config.CAPITAL_LETTERS.AcceptedPercentage || 30;

    return uppercaseLength / totalLength > (acceptedPercentage / 100);
};

const checkForForbiddenTags = (message) => {
    const guildId = message.guild.id;
    const forbiddenRoles = config.AVOID_TAGS.ForbiddenRoles[guildId] || [];
    const forbiddenUsers = config.AVOID_TAGS.ForbiddenUsers[guildId] || [];

    const forbiddenUserPinged = message.mentions.users.some(user => forbiddenUsers.includes(user.id));
    const forbiddenRolePinged = message.mentions.roles.some(role => forbiddenRoles.includes(role.id));

    return forbiddenUserPinged || forbiddenRolePinged;
};


const filterMessage = async (message) => {
    const guildId = message.guild.id;
    const userRoles = message.member.roles.cache.map(role => role.id);

    const blacklistedExceptRole = config.BLACKLISTED_WORDS_SETTINGS.ExceptRoleID[guildId];
    const capitalLettersExceptRole = config.CAPITAL_LETTERS.ExceptRoleID[guildId];
    const repeatedCharactersExceptRole = config.REPEATED_CHARACTERS.ExceptRoleID[guildId];
    const forbiddenTagsExceptRole = config.AVOID_TAGS.ExceptRoleID[guildId];

    if (blacklistedExceptRole && userRoles.includes(blacklistedExceptRole)) return;
    if (capitalLettersExceptRole && userRoles.includes(capitalLettersExceptRole)) return;
    if (repeatedCharactersExceptRole && userRoles.includes(repeatedCharactersExceptRole)) return;
    if (forbiddenTagsExceptRole && userRoles.includes(forbiddenTagsExceptRole)) return;

    const messageContent = message.content;
    const blacklistedWordsFound = config.BLACKLISTED_WORDS_SETTINGS.Enabled ? checkForBlacklistedWords(messageContent) : [];
    const hasRepeatedCharacters = config.REPEATED_CHARACTERS.Enabled && checkForRepeatedCharacters(messageContent);
    const hasTooManyCaps = config.CAPITAL_LETTERS.Enabled && checkCapsLockUsage(messageContent);
    const hasForbiddenTags = config.AVOID_TAGS.Enabled && checkForForbiddenTags(message);

    if (blacklistedWordsFound.length === 0 && !hasRepeatedCharacters && !hasTooManyCaps && !hasForbiddenTags) return;

    try {
        if (blacklistedWordsFound.length > 0) {
            message.deletedByBot = true;
            await message.delete();

            if (config.LOGS_SETTINGS.LogTypes.BlacklistedWords.Enabled) {
                const logChannelId = config.LOGS_SETTINGS.LogTypes.BlacklistedWords.Channels[guildId];
                const logChannel = logChannelId ? message.guild.channels.cache.get(logChannelId) : null;

                if (logChannelId && logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle(config.LOGS_SETTINGS.LogTypes.BlacklistedWords.Title)
                        .setDescription(config.LOGS_SETTINGS.LogTypes.BlacklistedWords.Description.replace('{user}', message.author.tag)
                            .replace('{username}', message.author.username)
                            .replace('{userid}', message.author.id))
                        .addFields(
                            { name: config.LOGS_SETTINGS.LogTypes.BlacklistedWords.Fields.Field1.Title, value: messageContent, inline: config.LOGS_SETTINGS.LogTypes.BlacklistedWords.Fields.Field1.Inline },
                            { name: config.LOGS_SETTINGS.LogTypes.BlacklistedWords.Fields.Field2.Title, value: blacklistedWordsFound.join(', '), inline: config.LOGS_SETTINGS.LogTypes.BlacklistedWords.Fields.Field2.Inline },
                            { name: config.LOGS_SETTINGS.LogTypes.BlacklistedWords.Fields.Field3.Title, value: `https://discord.com/channels/${guildId}/${message.channel.id}`, inline: config.LOGS_SETTINGS.LogTypes.BlacklistedWords.Fields.Field3.Inline }
                        )
                        .setThumbnail(message.author.displayAvatarURL({ format: 'png', size: 1024 }))
                        .setColor(config.LOGS_SETTINGS.LogTypes.BlacklistedWords.EmbedColor)
                        .setFooter({ text: config.LOGS_SETTINGS.LogTypes.BlacklistedWords.Footer.Text.replace('{guildName}', message.guild.name), iconURL: message.client.user.displayAvatarURL() })
                        .setTimestamp();

                    await logChannel.send({ embeds: [logEmbed] });
                } else {
                    console.warn(`[WARNING] Blacklisted Words log channel is missing or invalid for guild ID: ${guildId}.`);
                }
            }

            if (config.BLACKLISTED_WORDS_SETTINGS.WarningEmbed.SendWarnToChannel) {
                const warningEmbed = new EmbedBuilder()
                    .setTitle(config.BLACKLISTED_WORDS_SETTINGS.WarningEmbed.Title)
                    .setDescription(config.BLACKLISTED_WORDS_SETTINGS.WarningEmbed.Description.replace('{user}', message.author.tag))
                    .setColor(config.BLACKLISTED_WORDS_SETTINGS.WarningEmbed.EmbedColor)
                    .setFooter({ text: config.BLACKLISTED_WORDS_SETTINGS.WarningEmbed.Footer.Text.replace('{guildName}', message.guild.name), iconURL: message.client.user.displayAvatarURL() })
                    .setTimestamp();

                await message.channel.send({ embeds: [warningEmbed] });
            }
        }

        if (hasRepeatedCharacters) {
            message.deletedByBot = true;
            await message.delete();

            if (config.LOGS_SETTINGS.LogTypes.RepeatedCharacters.Enabled) {
                const logChannelId = config.LOGS_SETTINGS.LogTypes.RepeatedCharacters.Channels[guildId];
                const logChannel = logChannelId ? message.guild.channels.cache.get(logChannelId) : null;

                if (logChannelId && logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle(config.LOGS_SETTINGS.LogTypes.RepeatedCharacters.Title)
                        .setDescription(config.LOGS_SETTINGS.LogTypes.RepeatedCharacters.Description.replace('{user}', message.author.tag)
                            .replace('{username}', message.author.username)
                            .replace('{userid}', message.author.id))
                        .addFields(
                            { name: config.LOGS_SETTINGS.LogTypes.RepeatedCharacters.Fields.Field1.Title, value: messageContent, inline: config.LOGS_SETTINGS.LogTypes.RepeatedCharacters.Fields.Field1.Inline },
                            { name: config.LOGS_SETTINGS.LogTypes.RepeatedCharacters.Fields.Field2.Title, value: `https://discord.com/channels/${guildId}/${message.channel.id}`, inline: config.LOGS_SETTINGS.LogTypes.RepeatedCharacters.Fields.Field2.Inline }
                        )
                        .setThumbnail(message.author.displayAvatarURL({ format: 'png', size: 1024 }))
                        .setColor(config.LOGS_SETTINGS.LogTypes.RepeatedCharacters.EmbedColor)
                        .setFooter({ text: config.LOGS_SETTINGS.LogTypes.RepeatedCharacters.Footer.Text.replace('{guildName}', message.guild.name), iconURL: message.client.user.displayAvatarURL() })
                        .setTimestamp();

                    await logChannel.send({ embeds: [logEmbed] });
                } else {
                    console.warn(`[WARNING] Repeated Characters log channel is missing or invalid for guild ID: ${guildId}.`);
                }
            }

            if (config.REPEATED_CHARACTERS.WarningEmbed.SendWarnToChannel) {
                const warningEmbed = new EmbedBuilder()
                    .setTitle(config.REPEATED_CHARACTERS.WarningEmbed.Title)
                    .setDescription(config.REPEATED_CHARACTERS.WarningEmbed.Description.replace('{user}', message.author.tag))
                    .setColor(config.REPEATED_CHARACTERS.WarningEmbed.EmbedColor)
                    .setFooter({ text: config.REPEATED_CHARACTERS.WarningEmbed.Footer.Text.replace('{guildName}', message.guild.name), iconURL: message.client.user.displayAvatarURL() })
                    .setTimestamp();

                await message.channel.send({ embeds: [warningEmbed] });
            }
        }

        if (hasTooManyCaps) {
            message.deletedByBot = true;
            await message.delete();

            if (config.LOGS_SETTINGS.LogTypes.CapitalLetters.Enabled) {
                const logChannelId = config.LOGS_SETTINGS.LogTypes.CapitalLetters.Channels[guildId];
                const logChannel = logChannelId ? message.guild.channels.cache.get(logChannelId) : null;

                if (logChannelId && logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle(config.LOGS_SETTINGS.LogTypes.CapitalLetters.Title)
                        .setDescription(config.LOGS_SETTINGS.LogTypes.CapitalLetters.Description.replace('{user}', message.author.tag)
                            .replace('{username}', message.author.username)
                            .replace('{userid}', message.author.id))
                        .addFields(
                            { name: config.LOGS_SETTINGS.LogTypes.CapitalLetters.Fields.Field1.Title, value: messageContent, inline: config.LOGS_SETTINGS.LogTypes.CapitalLetters.Fields.Field1.Inline },
                            { name: config.LOGS_SETTINGS.LogTypes.CapitalLetters.Fields.Field2.Title, value: `https://discord.com/channels/${guildId}/${message.channel.id}`, inline: config.LOGS_SETTINGS.LogTypes.CapitalLetters.Fields.Field2.Inline }
                        )
                        .setThumbnail(message.author.displayAvatarURL({ format: 'png', size: 1024 }))
                        .setColor(config.LOGS_SETTINGS.LogTypes.CapitalLetters.EmbedColor)
                        .setFooter({ text: config.LOGS_SETTINGS.LogTypes.CapitalLetters.Footer.Text.replace('{guildName}', message.guild.name), iconURL: message.client.user.displayAvatarURL() })
                        .setTimestamp();

                    await logChannel.send({ embeds: [logEmbed] });
                } else {
                    console.warn(`[WARNING] Capital Letters log channel is missing or invalid for guild ID: ${guildId}.`);
                }
            }

            if (config.CAPITAL_LETTERS.WarningEmbed.SendWarnToChannel) {
                const warningEmbed = new EmbedBuilder()
                    .setTitle(config.CAPITAL_LETTERS.WarningEmbed.Title)
                    .setDescription(config.CAPITAL_LETTERS.WarningEmbed.Description.replace('{user}', message.author.tag))
                    .setColor(config.CAPITAL_LETTERS.WarningEmbed.EmbedColor)
                    .setFooter({ text: config.CAPITAL_LETTERS.WarningEmbed.Footer.Text.replace('{guildName}', message.guild.name), iconURL: message.client.user.displayAvatarURL() })
                    .setTimestamp();

                await message.channel.send({ embeds: [warningEmbed] });
            }
        }

        if (hasForbiddenTags) {
            if (config.AVOID_TAGS.WarningEmbed.DeleteAuthorMessage) {
                message.deletedByBot = true;
                await message.delete();
            }

            if (config.LOGS_SETTINGS.LogTypes.ForbiddenTags.Enabled) {
                const logChannelId = config.LOGS_SETTINGS.LogTypes.ForbiddenTags.Channels[guildId];
                const logChannel = logChannelId ? message.guild.channels.cache.get(logChannelId) : null;

                if (logChannelId && logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle(config.LOGS_SETTINGS.LogTypes.ForbiddenTags.Title)
                        .setDescription(config.LOGS_SETTINGS.LogTypes.ForbiddenTags.Description.replace('{user}', message.author.tag)
                            .replace('{username}', message.author.username)
                            .replace('{userid}', message.author.id))
                        .addFields(
                            { name: config.LOGS_SETTINGS.LogTypes.ForbiddenTags.Fields.Field1.Title, value: messageContent, inline: config.LOGS_SETTINGS.LogTypes.ForbiddenTags.Fields.Field1.Inline },
                            { name: config.LOGS_SETTINGS.LogTypes.ForbiddenTags.Fields.Field2.Title, value: `https://discord.com/channels/${guildId}/${message.channel.id}`, inline: config.LOGS_SETTINGS.LogTypes.ForbiddenTags.Fields.Field2.Inline }
                        )
                        .setThumbnail(message.author.displayAvatarURL({ format: 'png', size: 1024 }))
                        .setColor(config.LOGS_SETTINGS.LogTypes.ForbiddenTags.EmbedColor);

                    if (config.LOGS_SETTINGS.LogTypes.ForbiddenTags.Footer.Enabled) {
                        logEmbed.setFooter({
                            text: config.LOGS_SETTINGS.LogTypes.ForbiddenTags.Footer.Text
                                ? config.LOGS_SETTINGS.LogTypes.ForbiddenTags.Footer.Text.replace('{guildName}', message.guild.name || '')
                                : message.guild.name || '',
                            iconURL: message.client.user.displayAvatarURL()
                        });
                    }

                    if (config.LOGS_SETTINGS.LogTypes.ForbiddenTags.TimestampEnabled) {
                        logEmbed.setTimestamp();
                    }

                    await logChannel.send({ embeds: [logEmbed] });
                } else {
                    console.warn(`[WARNING] Forbidden Tags log channel is missing or invalid for guild ID: ${guildId}.`);
                }
            }

            if (config.AVOID_TAGS.WarningEmbed.SendWarnToChannel) {
                const warningEmbed = new EmbedBuilder()
                    .setTitle(config.AVOID_TAGS.WarningEmbed.Title || '')
                    .setDescription(config.AVOID_TAGS.WarningEmbed.Description.replace('{user}', message.author.tag))
                    .setColor(config.AVOID_TAGS.WarningEmbed.EmbedColor);

                if (config.AVOID_TAGS.WarningEmbed.Footer.Enabled) {
                    warningEmbed.setFooter({
                        text: config.AVOID_TAGS.WarningEmbed.Footer.Text
                            ? config.AVOID_TAGS.WarningEmbed.Footer.Text.replace('{guildName}', message.guild.name || '')
                            : message.guild.name || '',
                        iconURL: message.client.user.displayAvatarURL()
                    });
                }

                if (config.AVOID_TAGS.WarningEmbed.TimestampEnabled) {
                    warningEmbed.setTimestamp();
                }

                await message.channel.send({ embeds: [warningEmbed] });
            }
        }

    } catch (error) {
        console.error(`[ERROR] Error handling message moderation: ${error.message}`);
    }
};

async function handleMessageCreate(message) {
    try {
        if (message.author.bot) return;

        await filterMessage(message);
    } catch (error) {
        console.error('Error checking message content:', error.message);
    }
}


async function handleMessageUpdate(oldMessage, newMessage) {
    try {
        if (newMessage.author.bot) return;

        await filterMessage(newMessage);
    } catch (error) {
        console.error('Error checking message content:', error.message);
    }
}

module.exports = {
    messageCreate: {
        name: Events.MessageCreate,
        execute: handleMessageCreate,
    },
    messageUpdate: {
        name: Events.MessageUpdate,
        execute: handleMessageUpdate,
    }
};