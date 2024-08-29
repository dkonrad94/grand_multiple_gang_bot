const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

let config;
try {
    config = yaml.load(fs.readFileSync('config_files/clear_config.yaml', 'utf8'));
} catch (e) {
    console.error("Error reading clear_config.yaml");
}

function getEmbedColor(colorKey) {
    return config.EMBED_COLORS[colorKey] || config.EMBED_COLORS.Default;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.PERMISSIONS.Commands)
        .setDescription(config.PERMISSIONS.Description)
        .addIntegerOption(option =>
            option.setName(config.PERMISSIONS.Options.Name)
                .setDescription(config.PERMISSIONS.Options.Description)
                .setRequired(true)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const roleIds = config.PERMISSIONS.CommandsGuildPermissions[guildId];
        const logChannelId = config.LOGS_SETTINGS.LogChannel[guildId];

        if (!roleIds || !roleIds.some(roleId => interaction.member.roles.cache.has(roleId))) {
            const errorEmbed = new EmbedBuilder()
                .setColor(getEmbedColor('Error'))
                .setDescription(config.translate.Errors.NoPermission);

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const amount = interaction.options.getInteger(config.PERMISSIONS.Options.Name);

        if (amount < 1 || amount > 100) {
            const errorEmbed = new EmbedBuilder()
                .setColor(getEmbedColor('Error'))
                .setDescription(config.translate.Errors.InvalidAmount);

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        if (!logChannelId) {
            console.error(config.translate.Errors.LogChannelNotFound.replace('{guildId}', guildId));
            return interaction.reply(config.translate.Errors.ExecutionError);
        }

        const logChannel = interaction.client.channels.cache.get(logChannelId);

        if (!logChannel) {
            console.error(config.translate.Errors.LogChannelNotFound);
            return interaction.reply(config.translate.Errors.ExecutionError);
        }

        await interaction.channel.bulkDelete(amount, true).catch(err => {
            console.error(err);
            const errorEmbed = new EmbedBuilder()
                .setColor(getEmbedColor('Error'))
                .setDescription(config.translate.Errors.DeletionError);

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        });

        const successEmbed = new EmbedBuilder()
            .setColor(getEmbedColor('Success'))
            .setDescription(config.translate.Success.MessageDeleted.replace('{amount}', amount));

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });

        const timestamp = Math.floor(Date.now() / 1000);

        const commandLogEmbed = new EmbedBuilder()
            .setColor(getEmbedColor('Log'))
            .setAuthor({ name: config.translate.Log.Author, iconURL: interaction.user.displayAvatarURL() })
            .setTitle(config.translate.Log.Command)
            .setDescription(config.translate.Log.Description.replace('{amount}', amount))
            .addFields({ name: " ", value: "~~----------------------------------------------------~~\n" })
            .addFields(
                { name: config.translate.Log.ChannelUrl, value: `${interaction.channel.url}`, inline: true },
                { name: config.translate.Log.DeletionTime, value: `<t:${timestamp}:F>`, inline: true },
                { name: " ", value: " ", inline: false },
                { name: config.translate.Log.User, value: `<@${interaction.user.id}>`, inline: true },
                { name: config.translate.Log.Username, value: `${interaction.user.tag}`, inline: true },
                { name: config.translate.Log.UserID, value: `${interaction.user.id}`, inline: true },
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: config.translate.Log.Footer.replace('{guildName}', interaction.guild.name), iconURL: interaction.client.user.displayAvatarURL() });

        await logChannel.send({ embeds: [commandLogEmbed] });
    },
};