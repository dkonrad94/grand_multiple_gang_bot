const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ModalBuilder, TextInputBuilder, ActionRowBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const getDb = require('./createdb');

let config;
let renamingChannels = new Set();
let cooldownChannels = new Map();

try {
    const fileContents = fs.readFileSync('config_files/ticket_config.yaml', 'utf8');
    config = yaml.load(fileContents);
} catch (e) {
    console.error('Error reading ticket_config.yaml for renameTicket command');
    process.exit(1);
}

async function logEvent(logType, interaction, additionalData = {}) {
    const logSettings = config.LOGS_SETTINGS.LogTypes[logType];

    if (!logSettings || !logSettings.Enabled) {
        console.warn(`Log type ${logType} is not enabled or not defined.`);
        return;
    }

    const guildId = interaction.guildId;
    const logChannelId = logSettings.Channels[guildId];

    if (!logChannelId) {
        console.warn(`No log channel configured for guild ${guildId} and log type ${logType}.`);
        return;
    }

    const logChannel = interaction.guild.channels.cache.get(logChannelId);
    if (!logChannel || logChannel.type !== ChannelType.GuildText) {
        console.warn(`Log channel ${logChannelId} not found or not a text channel.`);
        return;
    }

    const guildName = interaction.guild.name;
    const botAvatarUrl = interaction.client.user.displayAvatarURL();

    const embed = new EmbedBuilder()
        .setColor(logSettings.EmbedColor || config.EMBED_COLORS.Default)
        .setTitle(logSettings.Title || 'N/A')
        .setAuthor({ name: interaction.user.tag || 'N/A', iconURL: additionalData.openedByAvatarUrl })
        .setDescription(
            logSettings.Description
                .replace('{userId}', interaction.user.id)
                .replace('{userTag}', interaction.user.tag || 'N/A')
                .replace('{channelName}', interaction.channel.name || 'N/A')
                .replace('{newName}', additionalData.newName || 'N/A')
                .replace('{categoryName}', interaction.channel.parent ? interaction.channel.parent.name : 'N/A')
                .replace('{channel}', interaction.channel.toString())
                .replace('{openedBy}', additionalData.openedBy || 'N/A')
        )
        .setTimestamp()
        .setFooter({ text: guildName, iconURL: botAvatarUrl })
        .setThumbnail(additionalData.openedByAvatarUrl);

    await logChannel.send({ embeds: [embed] });
}

async function getTicketCreatorInfo(db, client, channelId) {
    return new Promise((resolve, reject) => {
        db.query(
            'SELECT userid_by_opened, user_by_opened FROM tickets WHERE ticket_channel_id = ? AND ticket_status = "open"',
            [channelId],
            async (err, result) => {
                if (err) {
                    return reject(err);
                }
                if (result.length > 0) {
                    const userId = result[0].userid_by_opened;
                    const user = await client.users.fetch(userId);
                    resolve({
                        userId,
                        userTag: result[0].user_by_opened,
                        avatarUrl: user.displayAvatarURL({ format: 'png', size: 1024 }),
                    });
                } else {
                    resolve(null);
                }
            }
        );
    });
}


async function updateEmbedAndDatabase(channel, newCategoryName, newChannelName, interaction, db) {

    if (cooldownChannels.has(channel.id)) {
        const cooldownData = cooldownChannels.get(channel.id);
        const cooldownRemaining = Math.max(0, Math.ceil((cooldownData.endTime - Date.now()) / 1000));
        const minutesRemaining = Math.floor(cooldownRemaining / 60);
        const secondsRemaining = cooldownRemaining % 60;

        if (cooldownRemaining > 0) {
            if (!cooldownData.message) {

                const countdownEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.Info)
                    .setDescription(config.TRANSLATE.CountdownMessage.replace('{minutes}', minutesRemaining).replace('{seconds}', secondsRemaining));

                const message = await interaction.reply({ embeds: [countdownEmbed], fetchReply: true });
                cooldownData.message = message;
            } else {
                const countdownEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.Info)
                    .setDescription(config.TRANSLATE.CountdownMessage.replace('{minutes}', minutesRemaining).replace('{seconds}', secondsRemaining));

                await cooldownData.message.edit({ embeds: [countdownEmbed] });
            }

            return false;
        } else {
            if (cooldownData.message) {
                await cooldownData.message.delete();
            }
            cooldownChannels.delete(channel.id);
        }
    }

    try {
        const category = Object.values(config).find(cat => cat.Name === newCategoryName);

        if (!category) {
            throw new Error('Selected category not found in config.');
        }

        const welcomeMessageResult = await new Promise((resolve, reject) => {
            db.query(`SELECT welcome_message_id FROM tickets WHERE ticket_channel_id = ? AND ticket_status = 'open'`, [channel.id], (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });

        if (welcomeMessageResult.length > 0) {
            const welcomeMessageId = welcomeMessageResult[0].welcome_message_id;
            const welcomeMessage = await channel.messages.fetch(welcomeMessageId);

            if (welcomeMessage && welcomeMessage.embeds.length > 0) {
                const originalEmbed = welcomeMessage.embeds[0];

                if (originalEmbed) {
                    const updatedEmbed = new EmbedBuilder(originalEmbed)
                        .setTitle(category.TicketMessageTitle.replace('{category}', category.Name))
                        .setDescription(category.TicketMessage.replace('{category}', category.Name))
                        .setColor(category.EmbedColor || '#23272a');

                    await welcomeMessage.edit({ embeds: [updatedEmbed] });
                    await channel.setName(newChannelName);

                    const cooldownEndTime = Date.now() + 10 * 60 * 1000;
                    cooldownChannels.set(channel.id, { endTime: cooldownEndTime, message: null });

                    const cooldownEmbed = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.Success)
                        .setDescription(config.TRANSLATE.RenameSuccess.replace('{channelName}', channel.name).replace('{channelUrl}', channel.url));
                    await interaction.reply({ embeds: [cooldownEmbed] });

                    const creatorInfo = await getTicketCreatorInfo(db, interaction.client, channel.id);
                    const openedBy = creatorInfo ? `<@${creatorInfo.userId}> | (${creatorInfo.userTag})` : 'N/A';

                    await logEvent('RenameTicket', interaction, { newName: newChannelName, openedBy, openedByAvatarUrl: creatorInfo.avatarUrl });

                    const interval = setInterval(async () => {
                        const cooldownData = cooldownChannels.get(channel.id);
                        if (!cooldownData) {
                            clearInterval(interval);
                            return;
                        }

                        const cooldownRemaining = Math.max(0, Math.ceil((cooldownData.endTime - Date.now()) / 1000));
                        const minutesRemaining = Math.floor(cooldownRemaining / 60);
                        const secondsRemaining = cooldownRemaining % 60;

                        if (cooldownRemaining <= 0) {

                            if (cooldownData.message) {
                                await cooldownData.message.delete();
                            }

                            cooldownChannels.delete(channel.id);
                            clearInterval(interval);

                        } else if (cooldownData.message) {

                            const countdownEmbed = new EmbedBuilder()
                                .setColor(config.EMBED_COLORS.Info)
                                .setDescription(config.TRANSLATE.CountdownMessage.replace('{minutes}', minutesRemaining).replace('{seconds}', secondsRemaining));

                            await cooldownData.message.edit({ embeds: [countdownEmbed] });
                        }

                    }, 60000);

                    await new Promise((resolve, reject) => {
                        db.query(`UPDATE tickets SET channel_name = ?, category_name = ? WHERE ticket_channel_id = ? AND ticket_status = 'open'`, [newChannelName, category.Name, channel.id], (updateErr, result) => {
                            if (updateErr) {
                                reject(updateErr);
                            } else {
                                resolve(true);
                            }
                        });
                    });

                    return true;
                }
            }
        }
    } catch (error) {
        console.error('Error updating embed and database:', error);
    }
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.RENAME_SETTINGS.Command)
        .setDescription(config.RENAME_SETTINGS.Description)
        .addStringOption(option => {
            const optionBuilder = option.setName(config.RENAME_SETTINGS.OptionName)
                .setDescription(config.TRANSLATE.ChooseCategory)
                .setRequired(true);

            Object.keys(config).forEach(key => {
                const category = config[key];
                if (category.CreatedChannelName) {
                    const cleanName = category.CreatedChannelName.replace('-{tag}', '');
                    optionBuilder.addChoices({ name: category.Name, value: cleanName });
                }
            });

            if (config.RENAME_SETTINGS.CustomName) {
                optionBuilder.addChoices({ name: config.RENAME_SETTINGS.Modal.Title, value: 'custom-rename' });
            }

            return optionBuilder;
        }),

    async execute(interaction) {
        const selectedOption = interaction.options.getString(config.RENAME_SETTINGS.OptionName);
        const channel = interaction.channel;
        const db = getDb();

        if (selectedOption === 'custom-rename' && config.RENAME_SETTINGS.CustomName) {
            const guildId = interaction.guildId;
            const userRoles = interaction.member.roles.cache.map(role => role.id);
            const supportRoles = config.RENAME_SETTINGS.Modal.SupportRoles[guildId];
            const hasPermission = supportRoles && supportRoles.some(role => userRoles.includes(role));

            if (!hasPermission) {
                const permissionEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.Error)
                    .setDescription(config.TRANSLATE.NoPermission);
                await interaction.reply({ embeds: [permissionEmbed], ephemeral: true });
                return;
            }

            const modal = new ModalBuilder()
                .setCustomId('custom-rename-modal')
                .setTitle(config.RENAME_SETTINGS.Modal.Title);

            const customRenameInput = new TextInputBuilder()
                .setCustomId('custom-rename-input')
                .setLabel(config.RENAME_SETTINGS.Modal.Description)
                .setStyle('Short');

            const actionRow = new ActionRowBuilder().addComponents(customRenameInput);
            modal.addComponents(actionRow);

            await interaction.showModal(modal);

        } else {

            const matchedCategoryKey = Object.keys(config).find(key => {
                const category = config[key];
                if (category.CreatedChannelName) {
                    const cleanName = category.CreatedChannelName.replace('-{tag}', '');
                    return selectedOption === cleanName;
                }
                return false;
            });

            const category = config[matchedCategoryKey];
            const newChannelName = `${selectedOption}-${interaction.user.tag}`;

            try {
                const updateSuccess = await updateEmbedAndDatabase(channel, category.Name, newChannelName, interaction, db);

                if (!updateSuccess && !interaction.replied && !interaction.deferred) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.Error)
                        .setDescription(config.TRANSLATE.ErrorWhileRenaming);
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }

            } catch (error) {

                console.error('Unexpected error occurred:', error);

                if (!interaction.replied && !interaction.deferred) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.Error)
                        .setDescription(config.TRANSLATE.UnexpectedError);
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }

            }
        }
    },

    async handleModalInteraction(interaction) {
        if (!interaction.isModalSubmit() || interaction.customId !== 'custom-rename-modal') return;

        const customName = interaction.fields.getTextInputValue('custom-rename-input');
        const channel = interaction.channel;
        const db = getDb();

        try {
            await channel.setName(customName);
            const successEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.Success)
                .setDescription(config.TRANSLATE.RenameSuccess.replace('{channelName}', customName).replace('{channelUrl}', channel.url));
            await interaction.reply({ embeds: [successEmbed] });

            const creatorInfo = await getTicketCreatorInfo(db, interaction.client, channel.id);
            const openedBy = creatorInfo ? `<@${creatorInfo.userId}> | (${creatorInfo.userTag})` : 'N/A';

            await logEvent('RenameTicket', interaction, { newName: customName, openedBy, openedByAvatarUrl: creatorInfo.avatarUrl });

        } catch (error) {
            console.error('Error renaming channel:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.Error)
                .setDescription(config.TRANSLATE.ErrorWhileRenaming);
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};