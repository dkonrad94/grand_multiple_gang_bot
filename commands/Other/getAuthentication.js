const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

let config;
try {
    const fileContents = fs.readFileSync('config_files/authentication_config.yaml', 'utf8');
    config = yaml.load(fileContents);
} catch (e) {
    console.log('Error reading authentication_config.yaml');
    process.exit(1);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.PERMISSIONS.Commands)
        .setDescription(config.PERMISSIONS.Description),

    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;

            const guildConfig = config.EMBED_SETTINGS.find(setting => setting.GuildID.includes(guildId));

            if (!guildConfig) {
                console.error('Guild configuration not found in EmbedSettings.');
                const errorEmbed = new EmbedBuilder()
                    .setColor(config.INTERACTION_MESSAGES.Error.Color)
                    .setTitle(config.INTERACTION_MESSAGES.Error.Title)
                    .setDescription(config.INTERACTION_MESSAGES.Error.Description);

                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            if (interaction.isChatInputCommand()) {
                if (!interaction.member.permissions.has(config.PERMISSIONS.CommandsGuildPermissions[guildId])) {

                    const noPermissionEmbed = new EmbedBuilder()
                        .setColor(config.INTERACTION_MESSAGES.NoPermission.Color)
                        .setTitle(config.INTERACTION_MESSAGES.NoPermission.Title)
                        .setDescription(config.INTERACTION_MESSAGES.NoPermission.Description);

                    return interaction.reply({ embeds: [noPermissionEmbed], ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setColor(guildConfig.Color)
                    .setTitle(guildConfig.Title)
                    .setDescription(guildConfig.Description)
                    .setFooter({
                        text: guildConfig.Footer.replace('{guildName}', interaction.guild.name),
                        iconURL: interaction.client.user.avatarURL()
                    });

                if (guildConfig.Timestamp) {
                    embed.setTimestamp();
                }

                const buttonConfig = guildConfig.Button;
                const buttonColor = buttonConfig?.ButtonColor?.toLowerCase();

                let buttonStyle;
                switch (buttonColor) {
                    case 'blurple':
                        buttonStyle = ButtonStyle.Primary;
                        break;
                    case 'gray':
                        buttonStyle = ButtonStyle.Secondary;
                        break;
                    case 'green':
                        buttonStyle = ButtonStyle.Success;
                        break;
                    case 'red':
                        buttonStyle = ButtonStyle.Danger;
                        break;
                    default:
                        console.error(`Invalid ButtonColor value for guild ID: ${guildId}. Using default.`);
                        buttonStyle = ButtonStyle.Primary;
                        break;
                }

                const button = new ButtonBuilder()
                    .setCustomId('toggleRole')
                    .setLabel(buttonConfig.Label)
                    .setEmoji(buttonConfig.Emoji)
                    .setStyle(buttonStyle);

                const row = new ActionRowBuilder().addComponents(button);

                await interaction.deferReply({ ephemeral: true });
                await interaction.channel.send({ embeds: [embed], components: [row] });

                const successEmbed = new EmbedBuilder()
                    .setColor(config.INTERACTION_MESSAGES.Success.Color)
                    .setTitle(config.INTERACTION_MESSAGES.Success.Title)
                    .setDescription(config.INTERACTION_MESSAGES.Success.Description);

                await interaction.followUp({ embeds: [successEmbed], ephemeral: true });
            } else if (interaction.isButton() && interaction.customId === 'toggleRole') {
                if (!guildConfig.ToggleRoleId || guildConfig.ToggleRoleId.length === 0) {
                    console.error('No ToggleRoleId found in the configuration.');
                    return;
                }

                const roleId = guildConfig.ToggleRoleId[0];

                const role = interaction.guild.roles.cache.get(roleId);
                if (!role) {
                    const roleNotFoundEmbed = new EmbedBuilder()
                        .setColor(config.INTERACTION_MESSAGES.RoleNotFound.Color)
                        .setTitle(config.INTERACTION_MESSAGES.RoleNotFound.Title)
                        .setDescription(config.INTERACTION_MESSAGES.RoleNotFound.Description);

                    return interaction.reply({ embeds: [roleNotFoundEmbed], ephemeral: true });
                }

                const member = interaction.member;

                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId);

                    const roleRemovedEmbed = new EmbedBuilder()
                        .setColor(config.INTERACTION_MESSAGES.RoleRemoved.Color)
                        .setTitle(config.INTERACTION_MESSAGES.RoleRemoved.Title)
                        .setDescription(config.INTERACTION_MESSAGES.RoleRemoved.Description.replace('{roleName}', `<@&${roleId}>`));

                    await interaction.reply({ embeds: [roleRemovedEmbed], ephemeral: true });
                } else {
                    await member.roles.add(roleId);

                    const roleAddedEmbed = new EmbedBuilder()
                        .setColor(config.INTERACTION_MESSAGES.RoleAdded.Color)
                        .setTitle(config.INTERACTION_MESSAGES.RoleAdded.Title)
                        .setDescription(config.INTERACTION_MESSAGES.RoleAdded.Description.replace('{roleName}', `<@&${roleId}>`));

                    await interaction.reply({ embeds: [roleAddedEmbed], ephemeral: true });
                }
            } else if (interaction.isButton()) {
                console.error('Interaction was recognized as a button interaction, but customId did not match.');
            }
        } catch (error) {
            const errorEmbed = new EmbedBuilder()
                .setColor(config.INTERACTION_MESSAGES.Error.Color)
                .setTitle(config.INTERACTION_MESSAGES.Error.Title)
                .setDescription(config.INTERACTION_MESSAGES.Error.Description);

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};