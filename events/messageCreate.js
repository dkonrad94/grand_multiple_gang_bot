const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const moment = require('moment');
const yaml = require('js-yaml');
const fs = require('fs');

const cacheState = require('../libs/cacheState');
const eventQueue = require('../libs/eventQueue');

let config;
try {
  config = yaml.load(fs.readFileSync('config_files/create_archive_config.yaml', 'utf8'));
} catch (e) {
  console.error("[ERROR] Not found Message Create config file!");
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message.guild || message.author.bot) return;

    eventQueue.enqueue(message.id, async () => {
      try {
        const guildId = message.guild.id;

        const logChannelId = config.LOGS_SETTINGS.LogChannel[guildId];
        const logChannel = client.channels.cache.get(logChannelId);

        if (!logChannel) {
          console.error('[ERROR] Not found (message create) log channel for guild:', guildId);
          return;
        }

        const imageChannelId = config.ArchiveChannels.Images[guildId];
        const videoChannelId = config.ArchiveChannels.Videos[guildId];
        const attachmentChannelId = config.ArchiveChannels.Attachments[guildId];
        const imageChannel = client.channels.cache.get(imageChannelId);
        const videoChannel = client.channels.cache.get(videoChannelId);
        const attachmentChannel = client.channels.cache.get(attachmentChannelId);

        const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
        const formattedTimestamp = moment().format(config.DATE_FORMATS.Default);
        const footerText = config.MESSAGES.Footer.replace('{guildName}', message.guild.name);
        const avatarUrl = message.author.displayAvatarURL({ format: 'png', size: 1024 });

        const attachmentPromises = [];
        const logEmbeds = [];

        if (message.attachments.size > 0) {
          for (const attachment of message.attachments.values()) {
            let embedColor;
            let embedTitle;
            let embedDescription;
            let archiveChannel;

            if (attachment.contentType && attachment.contentType.startsWith('video')) {
              if (attachment.size > config.MEDIA_UPLOAD_SIZE_LIMIT.Value * 1024 * 1024) {
                const ephemeralEmbed = new EmbedBuilder()
                  .setColor(config.EMBED_COLORS.VideoTooLarge)
                  .setDescription(config.MESSAGES.VideoTooLarge.Description)
                  .setTimestamp()
                  .setFooter({ text: footerText, iconURL: message.guild.iconURL() });

                const replyMessage = await message.channel.send({ embeds: [ephemeralEmbed] });

                setTimeout(() => replyMessage.delete(), config.WARNING_DELETE_DELAY.Value);
                await message.delete();

                return;
              } else {
                archiveChannel = videoChannel;
                embedColor = config.EMBED_COLORS.ArchiveMedia;
                embedTitle = config.MESSAGES.ArchiveMedia.Title;
                embedDescription = config.MESSAGES.ArchiveMedia.Description
                  .replace('{channelId}', message.channel.id)
                  .replace('{user}', `<@${message.author.id}>`)
                  .replace('{username}', message.author.tag)
                  .replace('{discordId}', message.author.id)
                  .replace('{fileName}', attachment.name)
                  .replace('{timestamp}', formattedTimestamp);
              }
            } else if (attachment.contentType && attachment.contentType.startsWith('image')) {
              archiveChannel = imageChannel;
              embedColor = config.EMBED_COLORS.ImageAttachment;
              embedTitle = config.MESSAGES.ImageAttachment.Title;
              embedDescription = config.MESSAGES.ImageAttachment.Description
                .replace('{channelId}', message.channel.id)
                .replace('{user}', `<@${message.author.id}>`)
                .replace('{username}', message.author.tag)
                .replace('{discordId}', message.author.id)
                .replace('{fileName}', attachment.name)
                .replace('{timestamp}', formattedTimestamp);
            } else {
              archiveChannel = attachmentChannel;
              embedColor = config.EMBED_COLORS.ArchiveAttachment;
              embedTitle = config.MESSAGES.ArchiveAttachment.Title;
              embedDescription = config.MESSAGES.ArchiveAttachment.Description
                .replace('{channelId}', message.channel.id)
                .replace('{user}', `<@${message.author.id}>`)
                .replace('{username}', message.author.tag)
                .replace('{discordId}', message.author.id)
                .replace('{fileName}', attachment.name)
                .replace('{timestamp}', formattedTimestamp);
            }

            if (archiveChannel) {
              attachmentPromises.push(archiveChannel.send({ files: [attachment.url] }));
            }

            const embed = new EmbedBuilder()
              .setColor(embedColor)
              .setTitle(embedTitle)
              .setAuthor({ name: `${config.MESSAGES.ArchiveMedia.Author} ${message.author.tag}`, iconURL: avatarUrl, url: avatarUrl })
              .setDescription(embedDescription)
              .setTimestamp()
              .setFooter({ text: footerText, iconURL: message.guild.iconURL() });

            const jumpToMessageButton = new ButtonBuilder()
              .setLabel(config.BUTTONS.JumpToMessage.Label)
              .setStyle(ButtonStyle.Link)
              .setURL(messageLink);

            const downloadButton = new ButtonBuilder()
              .setLabel(config.BUTTONS.DownloadAttachment.Label)
              .setStyle(ButtonStyle.Link)
              .setURL(attachment.url);

            const row = new ActionRowBuilder().addComponents(jumpToMessageButton, downloadButton);

            logEmbeds.push({ embeds: [embed], components: [row] });
          }
        }

        const archiveMessages = await Promise.all(attachmentPromises);

        const attachmentsToArchive = archiveMessages.map(archiveMessage => ({
          id: archiveMessage.attachments.first().id,
          url: archiveMessage.attachments.first().url,
          name: archiveMessage.attachments.first().name,
          proxyURL: archiveMessage.attachments.first().proxyURL,
          size: archiveMessage.attachments.first().size,
          height: archiveMessage.attachments.first().height,
          width: archiveMessage.attachments.first().width
        }));

        for (const logEmbed of logEmbeds) {
          await logChannel.send(logEmbed);
        }

        const cachedMessage = {
          content: message.content,
          attachments: attachmentsToArchive,
          timestamp: Date.now(),
        };

        client.messagesCache.set(message.id, cachedMessage);
        cacheState.setMessageCached(message.id, cachedMessage);

      } catch (err) {
        console.error('Failed to archive message attachments', err);
      }
    }, 'create');
  },
};