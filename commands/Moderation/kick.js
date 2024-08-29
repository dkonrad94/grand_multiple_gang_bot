const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, ActionRowBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder, TextInputStyle } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

let config;
try {
    config = yaml.load(fs.readFileSync('config_files/kick_config.yaml', 'utf8'));
} catch (e) {
    console.error("[ERROR] Not found kick_config.yaml file.");
}

function getEmbedColor(colorKey) {
    return config.EMBED_COLORS[colorKey] || config.EMBED_COLORS.Default;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.PERMISSIONS.Commands)
        .setDescription(config.PERMISSIONS.Description)
        .addUserOption(option =>
            option.setName(config.PERMISSIONS.Options.User.Name)
                .setDescription(config.PERMISSIONS.Options.User.Description)
                .setRequired(config.PERMISSIONS.Options.ReasonModal.Required)),

    async execute(interaction) {
        const user = interaction.options.getUser(config.PERMISSIONS.Options.User.Name);
        const guildId = interaction.guild.id;

        let member;
        try {
            member = await interaction.guild.members.fetch(user.id);
        } catch (error) {
            return interaction.reply({ content: config.TRANSLATE.Errors.UserNotFoound, ephemeral: true });
        }

        const requiredRoles = config.PERMISSIONS.CommandsGuildPermissions[guildId];
        if (!requiredRoles || !requiredRoles.length) {
            return interaction.reply({ content: config.TRANSLATE.Errors.NoPermission, ephemeral: true });
        }

        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: config.TRANSLATE.Errors.CannotKick, ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`kickModal-${user.id}`)
            .setTitle(config.PERMISSIONS.Options.ReasonModal.Title);

        const reasonInput = new TextInputBuilder()
            .setCustomId('reasonInput')
            .setLabel(config.PERMISSIONS.Options.ReasonModal.Label)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(config.PERMISSIONS.Options.ReasonModal.Placeholder)
            .setRequired(config.PERMISSIONS.Options.ReasonModal.Required)
            .setMaxLength(3500);

        const actionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    },

    async handleModalSubmit(interaction) {
        const reason = interaction.fields.getTextInputValue('reasonInput');
        const userId = interaction.customId.split('-')[1];
        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!member) {
            return interaction.reply({ content: config.TRANSLATE.Errors.UserNotFoound, ephemeral: true });
        }

        const kickerId = interaction.user.id;
        const kickerName = interaction.user.tag;
        const guildIconUrl = interaction.guild.iconURL({ size: 1024, dynamic: true });

        await interaction.reply({ content: config.TRANSLATE.Success.KickInitiated.replace('{userId}', userId), ephemeral: true });

        (async () => {
            try {
                const guildName = interaction.guild.name;
                const kickTime = new Date().toLocaleString();

                // DM üzenet összeállítása
                const userEmbed = new EmbedBuilder()
                    .setColor(getEmbedColor('DmMessage'))
                    .setThumbnail(guildIconUrl)
                    .setTitle(config.TRANSLATE.DM.Title)
                    .setDescription(
                        config.TRANSLATE.DM.Description
                            .replace('{guildName}', guildName)
                            .replace('{kickerName}', kickerName)
                            .replace('{kickTime}', kickTime)
                            .replace('{reason}', reason)
                    )
                    .addFields({ name: config.TRANSLATE.DM.Field.Name, value: config.TRANSLATE.DM.Field.Value })
                    .setTimestamp()
                    .setFooter({ text: config.TRANSLATE.Log.Footer.replace('{guildName}', guildName), iconURL: interaction.client.user.displayAvatarURL() });

                let dmFailed = false;

                try {
                    await member.send({ embeds: [userEmbed] });
                } catch (err) {
                    dmFailed = true;
                }

                await new Promise(resolve => setTimeout(resolve, 500));
                await member.kick(reason);

                const logChannelId = config.LOGS_SETTINGS.LogChannel[interaction.guild.id];
                if (config.LOGS_SETTINGS.Enabled && logChannelId) {
                    const logChannel = interaction.guild.channels.cache.get(logChannelId);
                    if (logChannel) {
                        const thumbnailUrl = member.user.displayAvatarURL({ size: 1024 });

                        let logMessage = config.TRANSLATE.Log.Field.Value;
                        logMessage = logMessage
                            .replace(/{userId}/g, member.user.id)
                            .replace(/{userTag}/g, member.user.tag)
                            .replace(/{kickerId}/g, kickerId)
                            .replace(/{kickerName}/g, kickerName)
                            .replace(/{reason}/g, reason);

                        const embed = new EmbedBuilder()
                            .setAuthor({ name: member.user.tag, iconURL: thumbnailUrl })
                            .setColor(dmFailed ? getEmbedColor('DmFailed') : getEmbedColor('DmSucces'))
                            .setTitle(config.TRANSLATE.Log.Title)
                            .setDescription(dmFailed ? config.TRANSLATE.Log.DmFailedDescription : config.TRANSLATE.Log.DmSuccessDescription)
                            .setThumbnail(thumbnailUrl)
                            .addFields({ name: config.TRANSLATE.Log.Field.Name, value: logMessage })
                            .setTimestamp()
                            .setFooter({ text: config.TRANSLATE.Log.Footer.replace('{guildName}', guildName), iconURL: interaction.client.user.displayAvatarURL() });

                        logChannel.send({ embeds: [embed] });
                    }
                }
            } catch (error) {
                console.error('Error during the DM send and kick process:', error);
            }
        })();
    }
};