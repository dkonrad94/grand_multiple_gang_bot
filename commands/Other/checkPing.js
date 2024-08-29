const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

let config;
try {
    config = yaml.load(fs.readFileSync('config_files/ping_config.yaml', 'utf8'));
} catch (e) {
    console.log("Error reading ping_config.yaml");
    process.exit(1);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.PERMISSIONS.Commands)
        .setDescription(config.PERMISSIONS.Description),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const member = interaction.member;
        const requiredRoles = config.PERMISSIONS.CommandsGuildPermissions[guildId];

        if (!requiredRoles || !requiredRoles.some(roleId => member.roles.cache.has(roleId))) {
            const errorEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.error || config.EMBED_COLORS.default)
                .setTitle(config.INTERACTION_MESSAGES.Errors.Title)
                .setDescription(config.INTERACTION_MESSAGES.Errors.No_permission);

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(console.error);
        }

        const sent = await interaction.reply({ content: config.INTERACTION_MESSAGES.Success.Pinging, fetchReply: true });

        const embed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.success || config.EMBED_COLORS.default)
            .setTitle(config.INTERACTION_MESSAGES.Success.Title)
            .addFields(
                { name: config.INTERACTION_MESSAGES.Success.BotPing, value: `${sent.createdTimestamp - interaction.createdTimestamp}ms`, inline: true },
                { name: config.INTERACTION_MESSAGES.Success.ApiPing, value: `${Math.round(interaction.client.ws.ping)}ms`, inline: true },
            )
            .setTimestamp();

        await interaction.editReply({ content: config.INTERACTION_MESSAGES.Success.Pinging, embeds: [embed] });
    },
};