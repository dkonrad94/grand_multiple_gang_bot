const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, ActionRowBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');

let config;
try {
    const fileContents = fs.readFileSync('config_files/setnickname_config.yaml', 'utf8');
    config = yaml.load(fileContents);
} catch (e) {
    console.error('Error reading setnickname_config.yaml');
    process.exit(1);
}

const { PERMISSIONS, MODAL_SETTINGS, LOGS_SETTINGS, INTERACTION_MESSAGES } = config;

module.exports = {
    data: new SlashCommandBuilder()
        .setName(PERMISSIONS.Commands)
        .setDescription(PERMISSIONS.Description)
        .addUserOption(option =>
            option.setName(PERMISSIONS.UserOption.Name)
                .setDescription(PERMISSIONS.UserOption.Description)
                .setRequired(PERMISSIONS.UserOption.Required))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(interaction) {
        const user = interaction.options.getUser(PERMISSIONS.UserOption.Name);
        const guildId = interaction.guildId;

        let member;
        try {
            member = await interaction.guild.members.fetch(user.id);
        } catch (error) {
            return interaction.reply({ content: INTERACTION_MESSAGES.Error, ephemeral: true });
        }

        const requiredRoles = PERMISSIONS.CommandsGuildPermissions[guildId];
        if (!requiredRoles || !requiredRoles.some(role => interaction.member.roles.cache.has(role))) {
            return interaction.reply({ content: INTERACTION_MESSAGES.NoPermission, ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`setNicknameModal-${user.id}`)
            .setTitle(MODAL_SETTINGS.Title);

        const nicknameInput = new TextInputBuilder()
            .setCustomId(MODAL_SETTINGS.Nickname_Input.CustomId)
            .setLabel(MODAL_SETTINGS.Nickname_Input.Label)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(MODAL_SETTINGS.Nickname_Input.Placeholder)
            .setRequired(MODAL_SETTINGS.Nickname_Input.Required);

        const resetNicknameInput = new TextInputBuilder()
            .setCustomId(MODAL_SETTINGS.Reset_Input.CustomId)
            .setLabel(MODAL_SETTINGS.Reset_Input.Label)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(MODAL_SETTINGS.Reset_Input.Placeholder)
            .setRequired(MODAL_SETTINGS.Reset_Input.Required);

        const actionRow1 = new ActionRowBuilder().addComponents(nicknameInput);
        const actionRow2 = new ActionRowBuilder().addComponents(resetNicknameInput);
        modal.addComponents(actionRow1, actionRow2);

        await interaction.showModal(modal);
    },

    async handleModalSubmit(interaction) {
        const newNickname = interaction.fields.getTextInputValue(MODAL_SETTINGS.Nickname_Input.CustomId);
        const resetNickname = interaction.fields.getTextInputValue(MODAL_SETTINGS.Reset_Input.CustomId) === 'reset';
        const userId = interaction.customId.split('-')[1];
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        const guildId = interaction.guildId;

        if (interaction.user.id === userId) {
            return interaction.reply({ content: INTERACTION_MESSAGES.SelfNicknameChangeError, ephemeral: true });
        }

        if (!member) {
            return interaction.reply({ content: INTERACTION_MESSAGES.Error, ephemeral: true });
        }

        try {
            const originalNickname = member.nickname || member.user.username;
            let updatedNickname;
            let embedColor;
            let description;

            if (resetNickname) {
                await member.setNickname(null);
                updatedNickname = member.user.globalName;
                embedColor = LOGS_SETTINGS.ResetEmbedColor;
                description = LOGS_SETTINGS.ResetDescription;
            } else {
                await member.setNickname(newNickname);
                updatedNickname = newNickname;
                embedColor = LOGS_SETTINGS.EmbedColor;
                description = LOGS_SETTINGS.Description;
            }

            const logChannelId = LOGS_SETTINGS.Channels[guildId];
            if (LOGS_SETTINGS.Enabled && logChannelId) {
                const logChannel = interaction.guild.channels.cache.get(logChannelId);
                if (logChannel) {
                    description = description
                        .replace('{staff}', `<@${interaction.user.id}>`)
                        .replace('{staffuserName}', interaction.user.tag)
                        .replace('{user}', `<@${member.user.id}>`)
                        .replace('{userName}', member.user.tag)
                        .replace('{useroldName}', originalNickname)
                        .replace('{userNewName}', updatedNickname)
                        .replace('{userId}', member.user.id);

                    const embed = new EmbedBuilder()
                        .setColor(embedColor)
                        .setTitle(LOGS_SETTINGS.Title)
                        .setDescription(description)
                        .setFooter({ text: LOGS_SETTINGS.Footer.replace('{guildName}', interaction.guild.name), iconURL: interaction.client.user.avatarURL() })
                        .setTimestamp();

                    logChannel.send({ embeds: [embed] });
                }
            }

            return interaction.reply({ content: INTERACTION_MESSAGES.NicknameChangeSuccess.replace('{nickname}', updatedNickname), ephemeral: true });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: INTERACTION_MESSAGES.Error, ephemeral: true });
        }
    }
};