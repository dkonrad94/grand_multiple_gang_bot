const { SlashCommandBuilder } = require('@discordjs/builders');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

let config;
try {
    config = yaml.load(fs.readFileSync('config_files/ban_config.yaml', 'utf8'));
} catch (e) {
    console.error("Error not found config file for ban command!");
}

function getEmbedColor(colorKey) {
    return config.EMBED_COLORS[colorKey] || config.EMBED_COLORS.Default;
}

const banCommand = {
    data: new SlashCommandBuilder()
        .setName(config.PERMISSIONS.Commands)
        .setDescription(config.PERMISSIONS.Description)
        .addUserOption(option =>
            option.setName(config.PERMISSIONS.Options.Target.Name)
                .setDescription(config.PERMISSIONS.Options.Target.Description)
                .setRequired(true))
        .addStringOption(option =>
            option.setName(config.PERMISSIONS.Options.Duration.Name)
                .setDescription(config.PERMISSIONS.Options.Duration.Description)
                .setRequired(true)
                .addChoices(
                    { name: config.BAN_DURATIONS_LABELS['3 days'], value: '3 days' },
                    { name: config.BAN_DURATIONS_LABELS['7 days'], value: '7 days' },
                    { name: config.BAN_DURATIONS_LABELS['Permanent'], value: 'Permanent' }
                )),

    async execute(interaction) {
        const target = interaction.options.getUser(config.PERMISSIONS.Options.Target.Name);
        const duration = interaction.options.getString(config.PERMISSIONS.Options.Duration.Name);

        const modal = new ModalBuilder()
            .setCustomId(`banReasonModal_${target.id}_${duration}`)
            .setTitle(config.REASON_MODALS.ReasonModal.Title.replace("{username}", target.username));

        const reasonInput = new TextInputBuilder()
            .setCustomId('banReason')
            .setLabel(config.REASON_MODALS.ReasonModal.Description)
            .setStyle(TextInputStyle.Paragraph);

        const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    },

    async handleModalSubmit(interaction) {
        const reason = interaction.fields.getTextInputValue('banReason');
        const [prefix, targetId, duration] = interaction.customId.split('_');
        const targetUser = await interaction.client.users.fetch(targetId);
        const executor = interaction.user;
        const guild = interaction.guild;

        const hasPermission = config.PERMISSIONS.CommandsGuildPermissions[guild.id]?.some(roleId =>
            interaction.member.roles.cache.has(roleId)
        );

        if (!hasPermission) {
            return interaction.reply({ content: config.TRANSLATIONS.Errors.NoPermission, ephemeral: true });
        }

        try {
            await guild.members.ban(targetUser.id, { reason });

            let unbanDate = null;
            if (duration !== 'Permanent') {
                const banDurationMs = ms(duration);
                unbanDate = new Date(Date.now() + banDurationMs);
                setTimeout(async () => {
                    try {
                        await guild.members.unban(targetUser.id);
                    } catch (error) {
                        console.error(`Error unbanning user ${targetUser.id}:`, error);
                    }
                }, banDurationMs);
            }

            const unbanDateFormatted = unbanDate ? `<t:${Math.floor(unbanDate.getTime() / 1000)}:R>` : config.BAN_DURATIONS_LABELS['Permanent'];

            const embed = new EmbedBuilder()
                .setColor(getEmbedColor('Log'))
                .setTitle(config.TRANSLATIONS.Log.Title)
                .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ size: 1024 }) })
                .addFields(
                    { name: config.TRANSLATIONS.Log.Fields.Field_1.Title, value: config.TRANSLATIONS.Log.Fields.Field_1.Value.replace('{moderator}', executor.id), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_2.Title, value: config.TRANSLATIONS.Log.Fields.Field_2.Value.replace('{moderatorName}', executor.tag), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_3.Title, value: config.TRANSLATIONS.Log.Fields.Field_3.Value.replace('{moderatorID}', executor.id), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_4.Title, value: config.TRANSLATIONS.Log.Fields.Field_4.Value.replace('{targetUser}', targetUser.id), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_5.Title, value: config.TRANSLATIONS.Log.Fields.Field_5.Value.replace('{targetUserName}', targetUser.tag), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_6.Title, value: config.TRANSLATIONS.Log.Fields.Field_6.Value.replace('{targetUserID}', targetUser.id), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_7.Title, value: config.TRANSLATIONS.Log.Fields.Field_7.Value.replace('{guildName}', guild.name), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_8.Title, value: unbanDateFormatted, inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_9.Reason, value: config.TRANSLATIONS.Log.Fields.Field_9.Value.replace('{reason}', reason), inline: false }
                )
                .setFooter({ text: config.TRANSLATIONS.Log.Footer.replace('{guildName}', guild.name), iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            const logChannelIds = config.LOGS_SETTINGS.LogChannel[guild.id];
            if (logChannelIds) {
                for (const logChannelId of logChannelIds) {
                    const logChannel = guild.channels.cache.get(logChannelId);
                    if (logChannel) {
                        await logChannel.send({ embeds: [embed] });
                    }
                }
            }

            try {
                const dmChannel = await targetUser.createDM();
                await dmChannel.send({ embeds: [embed] });
            } catch (error) {
                // console.error(`Error sending DM to ${targetUser.tag}:`, error);

                const errorEmbed = new EmbedBuilder()
                    .setColor(getEmbedColor('DMFailed'))
                    .setTitle(config.TRANSLATIONS.Log.Title)
                    .setDescription(config.TRANSLATIONS.Log.DmFailed)
                    .setTimestamp();

                if (logChannelIds) {
                    for (const logChannelId of logChannelIds) {
                        const logChannel = guild.channels.cache.get(logChannelId);
                        if (logChannel) {
                            await logChannel.send({ embeds: [errorEmbed] });
                        }
                    }
                }
            }

            await interaction.reply({ content: config.TRANSLATIONS.Success.BanSuccess.replace('{userTag}', targetUser.tag), ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: config.TRANSLATIONS.Errors.ExecutionError, ephemeral: true });
        }
    }
};

module.exports = banCommand;
