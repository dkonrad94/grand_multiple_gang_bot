const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const cacheState = require('../libs/cacheState');
const eventQueue = require('../libs/eventQueue');
const moment = require('moment');

let config;
let read_archive_channels;

try {
    config = yaml.load(fs.readFileSync('config_files/message_update_config.yaml', 'utf8'));
    read_archive_channels = yaml.load(fs.readFileSync('config_files/create_archive_config.yaml', 'utf8'));
} catch (e) {
    console.log("Error reading Message Update or Message Create config file", e);
    process.exit(1);
}

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage, client) {
        if (!newMessage.guild || oldMessage.author.bot) return;

        if (eventQueue.isInQueue(oldMessage.id, 'update')) {
            return;
        }

        eventQueue.enqueue(oldMessage.id, async () => {
            const cachedMessage = await cacheState.waitForMessageCached(oldMessage.id);
            if (!cachedMessage) {
                console.error('No cached data found for the message');
                return;
            }
            const currentState = JSON.parse(JSON.stringify(cachedMessage));

            const logChannel = client.channels.cache.get(config.LOGS_SETTINGS.LogChannel[newMessage.guild.id]);
            if (!logChannel) {
                console.error('[ERROR] Not found (message update) log channel for guild:', newMessage.guild.id);
                return;
            }

            const extractMediaName = url => url.split('/').pop().split('#')[0].split('?')[0];
            const newMediaNames = new Set(newMessage.attachments.map(att => extractMediaName(att.url)));
            const messageLink = `https://discord.com/channels/${newMessage.guild.id}/${newMessage.channel.id}/${newMessage.id}`;

            const truncateText = (text, maxLength = 1024) => {
                if (text.length > maxLength) {
                    return text.slice(0, maxLength - 3) + '...';
                }
                return text;
            };

            if (currentState.content && newMessage.content !== currentState.content) {
                const generalEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.MessageUpdate)
                    .setTitle(config.MESSAGES.MessageUpdate.Title)
                    .setThumbnail(oldMessage.author.displayAvatarURL({ format: 'png', size: 1024 }))
                    .setAuthor({ name: `${config.MESSAGES.MessageUpdate.Author} ${oldMessage.author.tag}`, iconURL: oldMessage.author.displayAvatarURL(), url: oldMessage.author.displayAvatarURL({ format: 'png', size: 1024 }) })
                    .setDescription(config.MESSAGES.MessageUpdate.Description
                        .replace('{userId}', oldMessage.author.id)
                        .replace('{userTag}', oldMessage.author.tag)
                        .replace('{discordId}', oldMessage.author.id)
                        .replace('{timestamp}', moment().format(config.DATE_FORMATS.Default)))
                    .addFields({ name: " ", value: "~~----------------------------------------------------~~\n" })
                    .addFields(
                        { name: config.MESSAGES.Fields.OriginalMessage.Title, value: truncateText(currentState.content), inline: false },
                        { name: config.MESSAGES.Fields.NewMessage.Title, value: truncateText(newMessage.content), inline: false }
                    )
                    .setTimestamp()
                    .setFooter({ text: config.MESSAGES.Footer.replace('{guildName}', newMessage.guild.name), iconURL: client.user.displayAvatarURL() });

                const jumpToMessageButton = new ButtonBuilder()
                    .setLabel(config.BUTTONS.JumpToMessage.Label)
                    .setStyle(ButtonStyle.Link)
                    .setURL(messageLink);

                const row = new ActionRowBuilder().addComponents(jumpToMessageButton);

                await logChannel.send({ embeds: [generalEmbed], components: [row] });
            }

            const fetchArchivedAttachment = async (channelId, attachmentName) => {
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
            };

            const handleDeletedAttachments = async (deletedAttachments, type) => {
                for (const deletedAttachment of deletedAttachments) {
                    await new Promise(resolve => setTimeout(resolve, 2500)); // Delay between logs - Rate limit
                    let deleteEmbed;

                    let archiveChannelId;
                    switch (type) {
                        case 'image':
                            archiveChannelId = read_archive_channels.ArchiveChannels.Images[oldMessage.guild.id];
                            break;
                        case 'media':
                            archiveChannelId = read_archive_channels.ArchiveChannels.Videos[oldMessage.guild.id];
                            break;
                        case 'file':
                            archiveChannelId = read_archive_channels.ArchiveChannels.Attachments[oldMessage.guild.id];
                            break;
                    }

                    const archivedAttachment = await fetchArchivedAttachment(archiveChannelId, deletedAttachment.name);

                    switch (type) {
                        case 'image':
                            deleteEmbed = new EmbedBuilder()
                                .setColor(config.EMBED_COLORS.DeletedImage)
                                .setTitle(config.MESSAGES.DeletedImage.Title)
                                .setThumbnail(oldMessage.author.displayAvatarURL({ format: 'png', size: 1024 }))
                                .setAuthor({ name: `${config.MESSAGES.DeletedImage.Author} ${oldMessage.author.tag}`, iconURL: oldMessage.author.displayAvatarURL(), url: oldMessage.author.displayAvatarURL({ format: 'png', size: 1024 }) })
                                .setDescription(config.MESSAGES.DeletedImage.Description
                                    .replace('{userId}', oldMessage.author.id)
                                    .replace('{userTag}', oldMessage.author.tag)
                                    .replace('{discordId}', oldMessage.author.id)
                                    .replace('{timestamp}', moment().format(config.DATE_FORMATS.Default)))
                                .addFields({ name: " ", value: "~~----------------------------------------------------~~\n" })
                                .setTimestamp()
                                .setFooter({ text: config.MESSAGES.Footer.replace('{guildName}', newMessage.guild.name), iconURL: client.user.displayAvatarURL() });

                            if (archivedAttachment) {
                                deleteEmbed.setImage(archivedAttachment.url);
                            }

                            const jumpToImageMessageButton = new ButtonBuilder()
                                .setLabel(config.BUTTONS.JumpToMessage.Label)
                                .setStyle(ButtonStyle.Link)
                                .setURL(messageLink);

                            const openImageButton = new ButtonBuilder()
                                .setLabel(config.BUTTONS.OpenImage.Label)
                                .setStyle(ButtonStyle.Link)
                                .setURL(deletedAttachment.url);

                            const rowImage = new ActionRowBuilder().addComponents(jumpToImageMessageButton, openImageButton);

                            await logChannel.send({ embeds: [deleteEmbed], components: [rowImage] });
                            break;
                        case 'media':
                            deleteEmbed = new EmbedBuilder()
                                .setColor(config.EMBED_COLORS.DeletedMedia)
                                .setTitle(config.MESSAGES.DeletedMedia.Title)
                                .setThumbnail(oldMessage.author.displayAvatarURL({ format: 'png', size: 1024 }))
                                .setAuthor({ name: `${config.MESSAGES.DeletedMedia.Author} ${oldMessage.author.tag}`, iconURL: oldMessage.author.displayAvatarURL(), url: oldMessage.author.displayAvatarURL({ format: 'png', size: 1024 }) })
                                .setDescription(config.MESSAGES.DeletedMedia.Description
                                    .replace('{userId}', oldMessage.author.id)
                                    .replace('{userTag}', oldMessage.author.tag)
                                    .replace('{discordId}', oldMessage.author.id)
                                    .replace('{timestamp}', moment().format(config.DATE_FORMATS.Default)))
                                .addFields({ name: " ", value: "~~----------------------------------------------------~~\n" })
                                .setTimestamp()
                                .setFooter({ text: config.MESSAGES.Footer.replace('{guildName}', newMessage.guild.name), iconURL: client.user.displayAvatarURL() });


                            const jumpToMediaMessageButton = new ButtonBuilder()
                                .setLabel(config.BUTTONS.JumpToMessage.Label)
                                .setStyle(ButtonStyle.Link)
                                .setURL(messageLink);

                            const downloadButtonMedia = new ButtonBuilder()
                                .setLabel(config.BUTTONS.DownloadVideo.Label)
                                .setStyle(ButtonStyle.Link)
                                .setURL(deletedAttachment.url);

                            const rowMedia = new ActionRowBuilder().addComponents(jumpToMediaMessageButton, downloadButtonMedia);

                            await logChannel.send({ embeds: [deleteEmbed], components: [rowMedia] });
                            break;
                        case 'file':
                            deleteEmbed = new EmbedBuilder()
                                .setColor(config.EMBED_COLORS.DeletedFile)
                                .setTitle(config.MESSAGES.DeletedFile.Title)
                                .setThumbnail(oldMessage.author.displayAvatarURL({ format: 'png', size: 1024 }))
                                .setAuthor({ name: `${config.MESSAGES.DeletedFile.Author} ${oldMessage.author.tag}`, iconURL: oldMessage.author.displayAvatarURL(), url: oldMessage.author.displayAvatarURL({ format: 'png', size: 1024 }) })
                                .setDescription(config.MESSAGES.DeletedFile.Description
                                    .replace('{userId}', oldMessage.author.id)
                                    .replace('{userTag}', oldMessage.author.tag)
                                    .replace('{discordId}', oldMessage.author.id)
                                    .replace('{timestamp}', moment().format(config.DATE_FORMATS.Default)))
                                .addFields({ name: " ", value: "~~----------------------------------------------------~~\n" })
                                .setTimestamp()
                                .setFooter({ text: config.MESSAGES.Footer.replace('{guildName}', newMessage.guild.name), iconURL: client.user.displayAvatarURL() });


                            const jumpToMessageButton = new ButtonBuilder()
                                .setLabel(config.BUTTONS.JumpToMessage.Label)
                                .setStyle(ButtonStyle.Link)
                                .setURL(messageLink);

                            const downloadButtonFile = new ButtonBuilder()
                                .setLabel(config.BUTTONS.DownloadAttachment.Label)
                                .setStyle(ButtonStyle.Link)
                                .setURL(deletedAttachment.url);

                            const rowFile = new ActionRowBuilder().addComponents(jumpToMessageButton, downloadButtonFile);

                            await logChannel.send({ embeds: [deleteEmbed], components: [rowFile] });
                            break;
                    }
                }
            };

            const determineAttachmentType = (attachment) => {
                const imageExtensions = ['png', 'jpg', 'jpeg', 'gif'];
                const videoExtensions = ['mp4', 'mov', 'wmv', 'flv', 'avi'];

                const extension = attachment.name.split('.').pop().toLowerCase();

                if (imageExtensions.includes(extension)) {
                    return 'image';
                } else if (videoExtensions.includes(extension)) {
                    return 'media';
                } else {
                    return 'file';
                }
            };

            if (currentState.content && currentState.attachments.length > 0 && newMessage.attachments.size < oldMessage.attachments.size) {
                const deletedAttachments = currentState.attachments.filter(att => !newMediaNames.has(extractMediaName(att.url)));
                const imageAttachments = deletedAttachments.filter(att => determineAttachmentType(att) === 'image');
                const mediaAttachments = deletedAttachments.filter(att => determineAttachmentType(att) === 'media');
                const fileAttachments = deletedAttachments.filter(att => determineAttachmentType(att) === 'file');

                if (imageAttachments.length > 0) {
                    await handleDeletedAttachments(imageAttachments, 'image');
                }
                if (mediaAttachments.length > 0) {
                    await handleDeletedAttachments(mediaAttachments, 'media');
                }
                if (fileAttachments.length > 0) {
                    await handleDeletedAttachments(fileAttachments, 'file');
                }
            }

            if (!currentState.content && currentState.attachments.length > 1 && newMessage.attachments.size < oldMessage.attachments.size) {
                const deletedAttachments = currentState.attachments.filter(att => !newMediaNames.has(extractMediaName(att.url)));

                const imageAttachments = deletedAttachments.filter(att => determineAttachmentType(att) === 'image');
                const mediaAttachments = deletedAttachments.filter(att => determineAttachmentType(att) === 'media');
                const fileAttachments = deletedAttachments.filter(att => determineAttachmentType(att) === 'file');

                if (imageAttachments.length > 0) {
                    await handleDeletedAttachments(imageAttachments, 'image');
                }
                if (mediaAttachments.length > 0) {
                    await handleDeletedAttachments(mediaAttachments, 'media');
                }
                if (fileAttachments.length > 0) {
                    await handleDeletedAttachments(fileAttachments, 'file');
                }
            }

            // Update the cache with the new message state
            const updatedAttachments = newMessage.attachments.map(att => ({
                id: att.id,
                url: att.url,
                name: att.name,
                proxyURL: att.proxyURL,
                size: att.size,
                height: att.height,
                width: att.width,
                contentType: att.contentType
            }));
            client.messagesCache.set(newMessage.id, {
                content: newMessage.content,
                attachments: updatedAttachments,
                timestamp: Date.now()
            });
            cacheState.setMessageCached(newMessage.id, {
                content: newMessage.content,
                attachments: updatedAttachments,
                timestamp: Date.now()
            });
        }, 'update', 5000);
    }
};