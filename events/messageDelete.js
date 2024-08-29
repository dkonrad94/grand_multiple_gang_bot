const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const cacheState = require('../libs/cacheState');
const eventQueue = require('../libs/eventQueue');
const moment = require('moment');

let config;
let read_archive_channels;

try {
    config = yaml.load(fs.readFileSync('config_files/message_delete_config.yaml', 'utf8'));
    read_archive_channels = yaml.load(fs.readFileSync('config_files/create_archive_config.yaml', 'utf8'));
} catch (e) {
    console.log("Error reading Message Delete or Archive config file", e);
    process.exit(1);
}

const truncateText = (text, maxLength = 1024) => {
    if (text && text.length > maxLength) {
        return text.slice(0, maxLength - 3) + '...';
    }
    return text || '';
};

module.exports = {
    name: Events.MessageDelete,
    async execute(message, client) {
        if (!message.guild || message.author.bot) return;

        const logChannelId = config.LOGS_SETTINGS.LogChannel[message.guild.id];
        if (!logChannelId) {
            console.error(`Log channel not found for guild ID: ${message.guild.id}`);
            return;
        }

        eventQueue.enqueue(message.id, async () => {
            const cachedMessage = await cacheState.waitForMessageCached(message.id);

            const logChannel = client.channels.cache.get(logChannelId);
            if (!logChannel) {
                console.error(`Invalid log channel: ${logChannelId}`);
                return;
            }

            if (!cachedMessage) {
                console.error('No cached data found for the message');
                return;
            }

            const deleteEmbeds = [];

            const images = cachedMessage.attachments.filter(att => determineAttachmentType(att) === 'image');
            const videos = cachedMessage.attachments.filter(att => determineAttachmentType(att) === 'video');
            const files = cachedMessage.attachments.filter(att => determineAttachmentType(att) === 'file');

            // Szöveg törlése
            if (cachedMessage.content && cachedMessage.attachments.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.MessageDelete || config.EMBED_COLORS.Default)
                    .setTitle(config.MESSAGES.DeleteWithTextOnly.Title)
                    .setDescription(config.MESSAGES.DeleteWithTextOnly.Description)
                    .addFields({ name: " ", value: "~~----------------------------------------------------~~\n" })
                    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                    .addFields(
                        { name: config.MESSAGES.Fields.Field_1.Title, value: config.MESSAGES.Fields.Field_1.Value.replace('{user}', message.author.id), inline: true },
                        { name: config.MESSAGES.Fields.Field_2.Title, value: config.MESSAGES.Fields.Field_2.Value.replace('{username}', message.author.tag), inline: true },
                        { name: config.MESSAGES.Fields.Field_3.Title, value: config.MESSAGES.Fields.Field_3.Value.replace('{userID}', message.author.id), inline: true },
                        { name: config.MESSAGES.Fields.Field_4.Title, value: config.MESSAGES.Fields.Field_4.Value.replace('{channel}', message.channel.id), inline: true },
                        { name: config.MESSAGES.Fields.Field_5.Title, value: config.MESSAGES.Fields.Field_5.Value.replace('{deletionTime}', moment().format(config.DATE_FORMATS.Default)), inline: true },
                        { name: config.MESSAGES.Fields.Field_6.Title, value: truncateText(cachedMessage.content), inline: false }
                    )
                    .setTimestamp()
                    .setFooter({ text: config.MESSAGES.Footer.replace('{guildName}', message.guild.name), iconURL: client.user.displayAvatarURL() });

                deleteEmbeds.push({ embed });
            }

            // Képek törlése
            if (images.length > 0) {
                for (const attachment of images) {
                    const archiveChannelId = read_archive_channels.ArchiveChannels.Images[message.guild.id];
                    const archivedAttachment = await fetchArchivedAttachment(archiveChannelId, attachment.name);

                    const embed = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.DeletedImage || config.EMBED_COLORS.Default)
                        .setTitle(config.MESSAGES.DeletedAttachment.Title)
                        .setDescription(config.MESSAGES.DeletedAttachment.Description.replace('{sentBy}', message.author.tag).replace('{userBy}', message.author.tag))
                        .addFields({ name: " ", value: "~~----------------------------------------------------~~\n" })
                        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                        .setImage(archivedAttachment ? archivedAttachment.url : attachment.url)
                        .addFields(
                            { name: config.MESSAGES.Fields.Field_1.Title, value: config.MESSAGES.Fields.Field_1.Value.replace('{user}', message.author.id), inline: true },
                            { name: config.MESSAGES.Fields.Field_2.Title, value: config.MESSAGES.Fields.Field_2.Value.replace('{username}', message.author.tag), inline: true },
                            { name: config.MESSAGES.Fields.Field_7.Title, value: attachment.name, inline: true },
                            { name: config.MESSAGES.Fields.Field_4.Title, value: config.MESSAGES.Fields.Field_4.Value.replace('{channel}', message.channel.id), inline: true },
                            { name: config.MESSAGES.Fields.Field_5.Title, value: config.MESSAGES.Fields.Field_5.Value.replace('{deletionTime}', moment().format(config.DATE_FORMATS.Default)), inline: true }
                        )
                        .setFooter({ text: config.MESSAGES.Footer.replace('{guildName}', message.guild.name), iconURL: client.user.displayAvatarURL() });

                    const buttons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel(config.BUTTONS.OpenAttachment)
                                .setStyle(ButtonStyle.Link)
                                .setURL(archivedAttachment ? archivedAttachment.url : attachment.url),
                            new ButtonBuilder()
                                .setLabel(config.BUTTONS.Download)
                                .setStyle(ButtonStyle.Link)
                                .setURL(attachment.url)
                        );

                    deleteEmbeds.push({ embed, buttons });
                }
            }

            // Videók törlése
            if (videos.length > 0) {
                for (const attachment of videos) {
                    const archiveChannelId = read_archive_channels.ArchiveChannels.Videos[message.guild.id];
                    const archivedAttachment = await fetchArchivedAttachment(archiveChannelId, attachment.name);

                    const embed = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.DeletedMedia || config.EMBED_COLORS.Default)
                        .setTitle(config.MESSAGES.DeletedAttachment.Title)
                        .setDescription(config.MESSAGES.DeletedAttachment.Description.replace('{sentBy}', message.author.tag).replace('{userBy}', message.author.tag))
                        .addFields({ name: " ", value: "~~----------------------------------------------------~~\n" })
                        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                        .addFields(
                            { name: config.MESSAGES.Fields.Field_1.Title, value: config.MESSAGES.Fields.Field_1.Value.replace('{user}', message.author.id), inline: true },
                            { name: config.MESSAGES.Fields.Field_2.Title, value: config.MESSAGES.Fields.Field_2.Value.replace('{username}', message.author.tag), inline: true },
                            { name: config.MESSAGES.Fields.Field_7.Title, value: attachment.name, inline: true },
                            { name: config.MESSAGES.Fields.Field_4.Title, value: config.MESSAGES.Fields.Field_4.Value.replace('{channel}', message.channel.id), inline: true },
                            { name: config.MESSAGES.Fields.Field_5.Title, value: config.MESSAGES.Fields.Field_5.Value.replace('{deletionTime}', moment().format(config.DATE_FORMATS.Default)), inline: true }
                        )
                        .setFooter({ text: config.MESSAGES.Footer.replace('{guildName}', message.guild.name), iconURL: client.user.displayAvatarURL() });

                    const buttons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel(config.BUTTONS.Download)
                                .setStyle(ButtonStyle.Link)
                                .setURL(attachment.url)
                        );

                    deleteEmbeds.push({ embed, buttons });
                }
            }

            // Fájlok törlése
            if (files.length > 0) {
                for (const attachment of files) {
                    const archiveChannelId = read_archive_channels.ArchiveChannels.Attachments[message.guild.id];
                    const archivedAttachment = await fetchArchivedAttachment(archiveChannelId, attachment.name);

                    const embed = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.DeletedFile || config.EMBED_COLORS.Default)
                        .setTitle(config.MESSAGES.DeletedAttachment.Title)
                        .setDescription(config.MESSAGES.DeletedAttachment.Description.replace('{sentBy}', message.author.tag).replace('{userBy}', message.author.tag))
                        .addFields({ name: " ", value: "~~----------------------------------------------------~~\n" })
                        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                        .addFields(
                            { name: config.MESSAGES.Fields.Field_1.Title, value: config.MESSAGES.Fields.Field_1.Value.replace('{user}', message.author.id), inline: true },
                            { name: config.MESSAGES.Fields.Field_2.Title, value: config.MESSAGES.Fields.Field_2.Value.replace('{username}', message.author.tag), inline: true },
                            { name: config.MESSAGES.Fields.Field_7.Title, value: attachment.name, inline: true },
                            { name: config.MESSAGES.Fields.Field_4.Title, value: config.MESSAGES.Fields.Field_4.Value.replace('{channel}', message.channel.id), inline: true },
                            { name: config.MESSAGES.Fields.Field_5.Title, value: config.MESSAGES.Fields.Field_5.Value.replace('{deletionTime}', moment().format(config.DATE_FORMATS.Default)), inline: true }
                        )
                        .setFooter({ text: config.MESSAGES.Footer.replace('{guildName}', message.guild.name), iconURL: client.user.displayAvatarURL() });

                    const buttons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel(config.BUTTONS.Download)
                                .setStyle(ButtonStyle.Link)
                                .setURL(attachment.url)
                        );

                    deleteEmbeds.push({ embed, buttons });
                }
            }

            // Embedek küldése
            while (deleteEmbeds.length > 0) {
                const { embed, buttons } = deleteEmbeds.shift();
                try {
                    if (buttons) {
                        await logChannel.send({ embeds: [embed], components: [buttons] });
                    } else {
                        await logChannel.send({ embeds: [embed] });
                    }
                    // console.log('Embed sent:', embed);
                } catch (error) {
                    console.error('Error sending embeds:', error);
                }
            }
        }, 'delete', 1000);
    }
};

async function fetchArchivedAttachment(channelId, attachmentName) {
    const archiveChannel = client.channels.cache.get(channelId);
    if (!archiveChannel) return null;

    let archivedAttachment = null;
    const messages = await archiveChannel.messages.fetch({ limit: 100 });

    for (const msg of messages.values()) {
        const attachment = msg.attachments.find(att => att.name === attachmentName);
        if (attachment) {
            archivedAttachment = attachment;
            break;
        }
    }
    return archivedAttachment;
}

function determineAttachmentType(attachment) {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const videoExtensions = ['mp4', 'mov', 'wmv', 'flv', 'avi'];

    const extension = attachment.name.split('.').pop().toLowerCase();

    if (imageExtensions.includes(extension)) {
        return 'image';
    } else if (videoExtensions.includes(extension)) {
        return 'video';
    } else {
        return 'file';
    }
}