const { PermissionsBitField } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

let config;
try {
    config = yaml.load(fs.readFileSync('config_files/timeout_config.yaml', 'utf8'));
} catch (e) {
    console.error("Error not found config file for timeout command!");
}

function getEmbedColor(colorKey) {
    return config.EMBED_COLORS[colorKey] || config.EMBED_COLORS.Default;
}

const TIMEOUT_DURATIONS = {
    "60 seconds": 60000,
    "5 minutes": 300000,
    "10 minutes": 600000,
    "1 hour": 3600000,
    "1 day": 86400000,
    "1 week": 604800000
};

const timeoutCommand = {
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
                    { name: config.TIMEOUT_DURATIONS_LABELS['60 seconds'], value: '60 seconds' },
                    { name: config.TIMEOUT_DURATIONS_LABELS['5 minutes'], value: '5 minutes' },
                    { name: config.TIMEOUT_DURATIONS_LABELS['10 minutes'], value: '10 minutes' },
                    { name: config.TIMEOUT_DURATIONS_LABELS['1 hour'], value: '1 hour' },
                    { name: config.TIMEOUT_DURATIONS_LABELS['1 day'], value: '1 day' },
                    { name: config.TIMEOUT_DURATIONS_LABELS['1 week'], value: '1 week' }
                )),

    async execute(interaction) {
        const target = interaction.options.getUser(config.PERMISSIONS.Options.Target.Name);
        const duration = interaction.options.getString(config.PERMISSIONS.Options.Duration.Name);
        const guild = interaction.guild;

        let targetMember;
        try {
            targetMember = await guild.members.fetch(target.id);
        } catch (error) {
            return interaction.reply({ content: config.TRANSLATIONS.Errors.TimeoutError, ephemeral: true });
        }

        const hasAdminPermission = targetMember.permissions.has(PermissionsBitField.Flags.Administrator);

        if (hasAdminPermission) {
            return interaction.reply({ content: config.TRANSLATIONS.Errors.HigherPermission, ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`timeoutReasonModal_${target.id}_${duration}`)
            .setTitle(config.REASON_MODALS.ReasonModal.Title);

        const reasonInput = new TextInputBuilder()
            .setCustomId('timeoutReason')
            .setLabel(config.REASON_MODALS.ReasonModal.Description)
            .setStyle(TextInputStyle.Paragraph);

        const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    },

    async handleModalSubmit(interaction) {
        const reason = interaction.fields.getTextInputValue('timeoutReason');
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
            const member = await guild.members.fetch(targetUser.id);
            await member.timeout(TIMEOUT_DURATIONS[duration], reason);

            const timestampEnd = Math.floor((Date.now() + TIMEOUT_DURATIONS[duration]) / 1000);

            const timeoutMinuteText = config.TRANSLATIONS.Log.Fields.Field_8.Value_minute.replace('{timeoutMinute}', `<t:${timestampEnd}:R>`);
            const timeoutSecondText = config.TRANSLATIONS.Log.Fields.Field_8.Value_second.replace('{timeoutSecond}', `<t:${timestampEnd}:S>`);

            const profileUrl = `https://discord.com/users/${targetUser.id}`;
            let dmStatusMessage;

            const dmEmbed = new EmbedBuilder()
                .setColor(getEmbedColor('DM'))
                .setTitle(config.TRANSLATIONS.DM.Title)
                .setDescription(config.TRANSLATIONS.DM.Description.replace('{guildName}', guild.name))
                .addFields({ name: " ", value: "~~----------------------------------------------------~~\n" })
                .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ size: 1024 }), url: profileUrl })
                .setThumbnail(targetUser.displayAvatarURL({ size: 1024 }))
                .addFields(
                    { name: config.TRANSLATIONS.DM.Fields.Field_1.Title, value: config.TRANSLATIONS.DM.Fields.Field_1.Value.replace('{moderatorName}', executor.tag), inline: true },
                    { name: config.TRANSLATIONS.DM.Fields.Field_2.Title, value: config.TRANSLATIONS.DM.Fields.Field_2.Value.replace('{guildName}', guild.name), inline: true },
                    { name: config.TRANSLATIONS.DM.Fields.Field_3.Title, value: timeoutMinuteText, inline: true },
                    { name: config.TRANSLATIONS.DM.Fields.Field_4.Title, value: config.TRANSLATIONS.DM.Fields.Field_4.Value.replace('{reason}', reason), inline: false }
                )
                .setFooter({ text: config.TRANSLATIONS.DM.Footer.replace('{guildName}', guild.name), iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            try {
                await targetUser.send({ embeds: [dmEmbed] });
                dmStatusMessage = config.TRANSLATIONS.Log.DmSuccess;
            } catch (dmError) {
                dmStatusMessage = config.TRANSLATIONS.Log.DmFailed;
            }

            const embed = new EmbedBuilder()
                .setColor(getEmbedColor('Log'))
                .setTitle(config.TRANSLATIONS.Log.Title)
                .setDescription(dmStatusMessage)  // Itt állítjuk be a DM küldés sikerességének visszajelzését
                .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ size: 1024 }), url: profileUrl })
                .setThumbnail(targetUser.displayAvatarURL({ size: 1024 }))
                .addFields(
                    { name: config.TRANSLATIONS.Log.Fields.Field_1.Title, value: config.TRANSLATIONS.Log.Fields.Field_1.Value.replace('{moderator}', executor.id), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_2.Title, value: config.TRANSLATIONS.Log.Fields.Field_2.Value.replace('{moderatorName}', executor.tag), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_3.Title, value: config.TRANSLATIONS.Log.Fields.Field_3.Value.replace('{moderatorID}', executor.id), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_4.Title, value: config.TRANSLATIONS.Log.Fields.Field_4.Value.replace('{targetUser}', targetUser.id), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_5.Title, value: config.TRANSLATIONS.Log.Fields.Field_5.Value.replace('{targetUserName}', targetUser.tag), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_6.Title, value: config.TRANSLATIONS.Log.Fields.Field_6.Value.replace('{targetUserID}', targetUser.id), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_7.Title, value: config.TRANSLATIONS.Log.Fields.Field_7.Value.replace('{guildName}', guild.name), inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_8.Title, value: timeoutMinuteText, inline: true },
                    { name: config.TRANSLATIONS.Log.Fields.Field_9.Reason, value: config.TRANSLATIONS.Log.Fields.Field_9.Value.replace('{reason}', reason), inline: false }
                )
                .setFooter({ text: config.TRANSLATIONS.Log.Footer.replace('{guildName}', guild.name), iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            const logChannelId = config.LOGS_SETTINGS.LogChannel[guild.id];
            if (logChannelId) {
                const logChannel = guild.channels.cache.get(logChannelId);
                if (logChannel) {
                    await logChannel.send({ embeds: [embed] });
                }
            }

            await interaction.reply({ content: config.TRANSLATIONS.Success.TimeoutSuccess.replace('{userTag}', targetUser.tag), ephemeral: true });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: config.TRANSLATIONS.Errors.ExecutionError, ephemeral: true });
        }
    }
};

module.exports = timeoutCommand;