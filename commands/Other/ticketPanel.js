const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType } = require('discord.js');

const getDb = require('./createdb');
const discordTranscripts = require('discord-html-transcripts');

const fs = require('fs');
const yaml = require('js-yaml');

let ticketConfig;
try {
    const fileContents = fs.readFileSync('config_files/ticket_config.yaml', 'utf8');
    ticketConfig = yaml.load(fileContents);
} catch (e) {
    console.error('Error reading ticket_config.yaml', e);
    process.exit(1);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName(ticketConfig.PERMISSIONS.Commands)
        .setDescription(ticketConfig.PERMISSIONS.Description),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const guildName = interaction.guild.name;
        const guildIcon = interaction.guild.iconURL();

        const allowedRoles = ticketConfig.PERMISSIONS.CommandsGuildPermissions[guildId] || [];
        const memberRoles = interaction.member.roles.cache.map(role => role.id);
        const hasPermission = allowedRoles.some(roleId => memberRoles.includes(roleId));

        if (!hasPermission) {
            const noPermissionEmbed = new EmbedBuilder()
                .setColor(ticketConfig.EMBED_COLORS.Error)
                .setDescription(ticketConfig.PERMISSIONS.SubmittedMessage.Embed.NoPermission);
            return interaction.reply({ embeds: [noPermissionEmbed], ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(ticketConfig.TICKET_PANEL.Embed.Color || ticketConfig.EMBED_COLORS.Info)
            .setTitle(ticketConfig.TICKET_PANEL.Embed.Title.replace('{guildName}', guildName))
            .setDescription(ticketConfig.TICKET_PANEL.Embed.Description);

        const authorIconURL = ticketConfig.TICKET_PANEL.Embed.Author.IconURL.replace('{guildIcon}', guildIcon) || guildIcon;
        const authorName = ticketConfig.TICKET_PANEL.Embed.Author.Name.replace('{guildName}', guildName);

        if (authorIconURL || authorName) {
            embed.setAuthor({
                name: authorName,
                iconURL: authorIconURL,
            });
        }

        // Panel kép beállítása
        if (ticketConfig.TICKET_PANEL.Embed.PanelImage) {
            embed.setImage(ticketConfig.TICKET_PANEL.Embed.PanelImage);
        }

        // Thumbnail beállítása
        if (ticketConfig.TICKET_PANEL.Embed.Thumbnail) {
            embed.setThumbnail(ticketConfig.TICKET_PANEL.Embed.Thumbnail.replace('{guildIcon}', guildIcon));
        }

        // Timestamp beállítása
        if (ticketConfig.TICKET_PANEL.Embed.Timestamp) {
            embed.setTimestamp();
        }

        // Lábjegyzet beállítása
        const footerIconURL = ticketConfig.TICKET_PANEL.Embed.Footer.CustomIconURL.replace('{guildIcon}', guildIcon) || null;
        const footerText = ticketConfig.TICKET_PANEL.Embed.Footer.text.replace('{guildName}', guildName);

        if (footerText) {
            embed.setFooter({
                text: footerText,
                iconURL: footerIconURL,
            });
        }

        try {
            const categories = ['Category1', 'Category2', 'Category3', 'Category4', 'Category5', 'Category6'];

            let row;
            if (ticketConfig.SETTINGS.SelectMenu) {
                const menuOptions = categories.map(categoryKey => {
                    const category = ticketConfig[categoryKey];
                    if (category.Enabled !== false) {
                        return new StringSelectMenuOptionBuilder()
                            .setLabel(category.Name)
                            .setDescription(category.Description)
                            .setValue(categoryKey)
                            .setEmoji(category.MenuEmoji);
                    }
                }).filter(Boolean);

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('ticketSelectMenu')
                    .setPlaceholder(ticketConfig.TRANSLATE.ChooseCategory)
                    .addOptions(menuOptions);

                row = new ActionRowBuilder().addComponents(selectMenu);

            } else {
                const buttons = categories.map(categoryKey => {
                    const category = ticketConfig[categoryKey];
                    if (category.Enabled !== false) {
                        let buttonStyle;
                        const buttonColor = category.ButtonColor?.toLowerCase();

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
                                buttonStyle = ButtonStyle.Primary;
                        }

                        if (typeof category.Name === 'string' && category.Name.trim() !== '' && typeof category.MenuEmoji === 'string') {
                            return new ButtonBuilder()
                                .setCustomId(`ticketButton_${categoryKey}`)
                                .setLabel(category.Name)
                                .setStyle(buttonStyle)
                                .setEmoji(category.MenuEmoji);
                        } else {
                            console.error(`Invalid Name or MenuEmoji for category key: ${categoryKey}`);
                        }
                    }
                }).filter(Boolean);

                row = new ActionRowBuilder().addComponents(buttons);
            }

            const successEmbed = new EmbedBuilder()
                .setColor(ticketConfig.EMBED_COLORS.Success)
                .setDescription(ticketConfig.PERMISSIONS.SubmittedMessage.Embed.Success);

            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ embeds: [successEmbed], ephemeral: true });

        } catch (error) {
            console.error('An error occurred while creating the ticket panel');

            const errorEmbed = new EmbedBuilder()
                .setColor(ticketConfig.EMBED_COLORS.Error)
                .setDescription(ticketConfig.PERMISSIONS.SubmittedMessage.Error);

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    handleTicketModalSubmit,
    handleComponentInteraction,
    handleTicketReview,
    handleModalSubmit,
    createTicket,
    closeTicket,
    deleteTicket,
    reopenTicket,
    transcriptTicket
};




async function handleComponentInteraction(interaction) {
    try {
        if (interaction.isStringSelectMenu()) {
            const categoryKey = interaction.values[0];
            await createTicket(interaction, categoryKey);

            const categories = ['Category1', 'Category2', 'Category3', 'Category4', 'Category5', 'Category6'];
            const menuOptions = categories.map(categoryKey => {
                const category = ticketConfig[categoryKey];
                if (category.Enabled !== false) {
                    return new StringSelectMenuOptionBuilder()
                        .setLabel(category.Name)
                        .setDescription(category.Description)
                        .setValue(categoryKey)
                        .setEmoji(category.MenuEmoji);
                }
            }).filter(Boolean);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticketSelectMenu')
                .setPlaceholder(ticketConfig.TRANSLATE.ChooseCategory)
                .addOptions(menuOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.message.edit({ components: [row] });
        } else if (interaction.isButton()) {
            const customId = interaction.customId;

            if (customId.startsWith('ticketButton_')) {
                const categoryKey = customId.split('_')[1];
                await createTicket(interaction, categoryKey);
            } else if (customId === 'closeTicket') {
                await closeTicket(interaction);
            } else if (customId === 'collectTicket') {
                await collectTicket(interaction);
            } else if (customId === 'unclaimTicket') {
                await unclaimTicket(interaction);
            } else if (customId === 'reopenTicket') {
                await reopenTicket(interaction);
            } else if (customId === 'transcriptTicket') {
                await transcriptTicket(interaction);
            } else if (customId.startsWith('ticketModal_')) { // Új hozzáadás
                await handleTicketModalSubmit(interaction);
            }
        }
    } catch (error) {
        console.error('Error during interaction handling:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while handling the interaction.', ephemeral: true });
        }
    }
}




async function createTicket(interaction, categoryKey) {
    try {
        const category = ticketConfig[categoryKey];
        if (!category) {
            console.error(`Category not found for key: ${categoryKey}`);
            const embed = new EmbedBuilder()
                .setColor(ticketConfig.EMBED_COLORS.Error)
                .setTitle(ticketConfig.TRANSLATE.ErrorTitle)
                .setDescription(ticketConfig.TRANSLATE.UnknownCategory.replace('{categoryKey}', categoryKey));
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (typeof category.Enabled !== 'undefined' && !category.Enabled) {
            const embed = new EmbedBuilder()
                .setColor(ticketConfig.EMBED_COLORS.Warning)
                .setTitle(ticketConfig.TRANSLATE.ErrorTitle)
                .setDescription(ticketConfig.TRANSLATE.CategoryDisabled.replace('{categoryName}', category.Name));
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const guild = interaction.guild;
        const member = interaction.member;
        const db = getDb();

        const blacklistQuery = `SELECT * FROM ticket_blacklist WHERE discord_user_id = ?`;
        db.query(blacklistQuery, [member.user.id], async (err, result) => {
            if (err) {
                console.error('Error querying the database for blacklist:', err);
                const errorEmbed = new EmbedBuilder()
                    .setColor(ticketConfig.EMBED_COLORS.Error)
                    .setTitle(ticketConfig.TRANSLATE.ErrorTitle)
                    .setDescription(ticketConfig.TRANSLATE.BlacklistCheckError || 'Error checking blacklist.');
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            if (result.length > 0) {
                const embed = new EmbedBuilder()
                    .setColor(ticketConfig.EMBED_COLORS.Blacklisted)
                    .setTitle(ticketConfig.TRANSLATE.ErrorTitle)
                    .setDescription(ticketConfig.TRANSLATE.BlacklistedRoleMessage || 'You are not allowed to open tickets.');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const openTicketsQuery = `SELECT COUNT(*) AS openTickets FROM tickets WHERE userid_by_opened = ? AND ticket_status = 'open'`;
            db.query(openTicketsQuery, [member.user.id], async (err, result) => {
                if (err) {
                    console.error('Error querying the database for open tickets:', err);
                    const errorEmbed = new EmbedBuilder()
                        .setColor(ticketConfig.EMBED_COLORS.Error)
                        .setTitle(ticketConfig.TRANSLATE.ErrorTitle)
                        .setDescription(ticketConfig.TRANSLATE.OpenTicketErrorDesc);
                    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }

                const openTickets = result[0].openTickets;
                const maxTickets = ticketConfig.SETTINGS.MaxTickets;

                if (openTickets >= maxTickets) {
                    const maxTicketsEmbed = new EmbedBuilder()
                        .setColor(ticketConfig.EMBED_COLORS.Warning)
                        .setTitle(ticketConfig.TRANSLATE.MaxTicketReached)
                        .setDescription(ticketConfig.TRANSLATE.OpenedTicketNumber.replace('{maxTickets}', maxTickets).replace('{openTickets}', openTickets));
                    return interaction.reply({ embeds: [maxTicketsEmbed], ephemeral: true });
                }

                if (category.Questions?.Enabled && category.Questions.List?.length > 0) {
                    const modal = new ModalBuilder()
                        .setCustomId(`ticketModal_${categoryKey}`)
                        .setTitle(`Válaszolj a kérdésekre - ${category.Name}`);

                    category.Questions.List.forEach(question => {
                        modal.addComponents(
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId(question.customId)
                                    .setLabel(question.question)
                                    .setStyle(question.style === 'Paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                                    .setRequired(question.required)
                            )
                        );
                    });

                    await interaction.showModal(modal);
                    return;
                }

                await createTicketChannel(interaction, category, member, db);
            });
        });
    } catch (error) {
        console.error('Error creating ticket:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor(ticketConfig.EMBED_COLORS.Error)
            .setTitle(ticketConfig.TRANSLATE.ErrorTitle)
            .setDescription(ticketConfig.TRANSLATE.ErrorCreatingTicket);

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}


async function handleTicketModalSubmit(interaction) {
    const db = getDb();
    const customIdParts = interaction.customId.split('_');
    const categoryKey = customIdParts[1];

    const category = ticketConfig[categoryKey];
    if (!category) {
        if (!interaction.replied) {
            return interaction.reply({ content: 'Category not found.', ephemeral: true });
        }
        return;
    }

    try {
        const responses = {};
        category.Questions.List.forEach(question => {
            responses[question.customId] = interaction.fields.getTextInputValue(question.customId);
        });

        await createTicketChannelWithResponses(interaction, category, interaction.member, db, responses);

        // if (!interaction.replied) {
        //     await interaction.reply({ content: 'Ticket created successfully!', ephemeral: true });
        // }
    } catch (error) {
        if (!interaction.replied) {
            try {
                await interaction.reply({ content: 'There was an error while processing this modal!', ephemeral: true });
            } catch (err) {
                console.error('Failed to send modal error message:', err);
            }
        }
    }
}




// async function createTicketChannelWithResponses(interaction, category, member, db, responses) {
//     const guild = interaction.guild;

//     const channel = await guild.channels.create({
//         name: category.CreatedChannelName.replace('{tag}', member.user.tag),
//         type: ChannelType.GuildText,
//         parent: category.CategoryID,
//         topic: category.TopicMessage.replace('{username}', member.user.username).replace('{category-name}', category.Name),
//         permissionOverwrites: [
//             {
//                 id: guild.id,
//                 deny: ['ViewChannel'],
//             },
//             {
//                 id: member.id,
//                 allow: [
//                     'ViewChannel',
//                     'SendMessages',
//                     'EmbedLinks',
//                     'AttachFiles',
//                     'AddReactions',
//                     'UseExternalEmojis',
//                     'MentionEveryone',
//                     'ReadMessageHistory',
//                 ],
//             },
//             ...(ticketConfig.CLAIMING_SYSTEM.Enabled
//                 ? category.SupportRoles.map(roleId => ({
//                     id: roleId,
//                     allow: ['ViewChannel', 'ReadMessageHistory'],
//                     deny: ['SendMessages'],
//                 }))
//                 : category.SupportRoles.map(roleId => ({
//                     id: roleId,
//                     allow: [
//                         'ViewChannel',
//                         'SendMessages',
//                         'EmbedLinks',
//                         'AttachFiles',
//                         'AddReactions',
//                         'UseExternalEmojis',
//                         'MentionEveryone',
//                         'ReadMessageHistory',
//                     ],
//                 }))
//             )
//         ],
//     });

//     const claimedFieldName = ticketConfig.CLAIMING_SYSTEM.NotRequested.Name;
//     const claimedFieldValue = ticketConfig.CLAIMING_SYSTEM.NotRequested.Value;

//     const welcomeEmbed = new EmbedBuilder()
//         .setColor(category.EmbedColor || ticketConfig.EMBED_COLORS.Info)
//         .setTitle(category.TicketMessageTitle.replace('{category}', category.Name))
//         .setDescription(category.TicketMessage.replace('{category}', category.Name))
//         .addFields(
//             { name: claimedFieldName, value: claimedFieldValue }
//         );

//     const closeButton = new ButtonBuilder()
//         .setCustomId('closeTicket')
//         .setLabel(ticketConfig.BUTTONS.closeTicketButton.Label)
//         .setEmoji(ticketConfig.BUTTONS.closeTicketButton.emoji)
//         .setStyle(ButtonStyle.Danger);

//     let row;
//     if (ticketConfig.CLAIMING_SYSTEM.Enabled) {
//         const collectButton = new ButtonBuilder()
//             .setCustomId('collectTicket')
//             .setLabel(ticketConfig.BUTTONS.claimTicketButton.Label)
//             .setEmoji(ticketConfig.BUTTONS.claimTicketButton.emoji)
//             .setStyle(ButtonStyle.Success);

//         row = new ActionRowBuilder().addComponents(closeButton, collectButton);
//     } else {
//         row = new ActionRowBuilder().addComponents(closeButton);
//     }

//     const welcomeMessage = await channel.send({ embeds: [welcomeEmbed], components: [row] });

//     const responseEmbed = new EmbedBuilder()
//         // .setColor(category.EmbedColor || ticketConfig.EMBED_COLORS.Info)
//         .setTitle(`${category.Name} Kérdések és válaszok`)
//         .setDescription('A jegy nyitásakor megadott válaszok:')
//         .addFields(Object.keys(responses).map(key => ({
//             name: category.Questions.List.find(q => q.customId === key).question,
//             value: responses[key],
//             inline: false
//         })));


//     await channel.send({ embeds: [responseEmbed] });

//     const successEmbed = new EmbedBuilder()
//         .setColor(ticketConfig.EMBED_COLORS.Success)
//         .setTitle(ticketConfig.TRANSLATE.TicketCreatedTitle)
//         .setDescription(ticketConfig.TRANSLATE.TicketCreatedDesc.replace('{channel}', `https://discord.com/channels/${guild.id}/${channel.id}`))
//         .setFooter({
//             text: ticketConfig.TRANSLATE.TicketCreatedFooterText.replace('{username}', member.user.username).replace('{category-name}', category.Name),
//             iconURL: member.user.displayAvatarURL({ format: 'png', size: 1024 })
//         });

//     const channelLinkButton = new ButtonBuilder()
//         .setLabel(ticketConfig.BUTTONS.channelLinkButton.Label || 'Ticket URL Button')
//         .setStyle(ButtonStyle.Link)
//         .setEmoji(ticketConfig.BUTTONS.channelLinkButton.emoji)
//         .setURL(`https://discord.com/channels/${guild.id}/${channel.id}`);

//     const ticketLinkrow = new ActionRowBuilder().addComponents(channelLinkButton);

//     await interaction.reply({ embeds: [successEmbed], components: [ticketLinkrow], ephemeral: true });

//     const insertQuery = `
//         INSERT INTO tickets (guild_id, support_role, user_by_opened, userid_by_opened, ticket_channel_id, channel_name, category_id, category_name, welcome_message_id, ticket_status) 
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
//     `;

//     db.query(insertQuery, [
//         interaction.guild.id,
//         category.SupportRoles.join(','),
//         member.user.tag,
//         member.user.id,
//         channel.id,
//         channel.name,
//         category.CategoryID,
//         category.Name,
//         welcomeMessage.id
//     ], (err, result) => {
//         if (err) {
//             console.error('Error inserting into the database:', err);
//         } else {
//             console.log('Data successfully inserted:', result);
//         }
//     });
// }



async function createTicketChannelWithResponses(interaction, category, member, db, responses) {
    const guild = interaction.guild;

    const channel = await guild.channels.create({
        name: category.CreatedChannelName.replace('{tag}', member.user.tag),
        type: ChannelType.GuildText,
        parent: category.CategoryID,
        topic: category.TopicMessage.replace('{username}', member.user.username).replace('{category-name}', category.Name),
        permissionOverwrites: [
            {
                id: guild.id,
                deny: ['ViewChannel'],
            },
            {
                id: member.id,
                allow: [
                    'ViewChannel',
                    'SendMessages',
                    'EmbedLinks',
                    'AttachFiles',
                    'AddReactions',
                    'UseExternalEmojis',
                    'MentionEveryone',
                    'ReadMessageHistory',
                ],
            },
            ...(ticketConfig.CLAIMING_SYSTEM.Enabled
                ? category.SupportRoles.map(roleId => ({
                    id: roleId,
                    allow: ['ViewChannel', 'ReadMessageHistory'],
                    deny: ['SendMessages'],
                }))
                : category.SupportRoles.map(roleId => ({
                    id: roleId,
                    allow: [
                        'ViewChannel',
                        'SendMessages',
                        'EmbedLinks',
                        'AttachFiles',
                        'AddReactions',
                        'UseExternalEmojis',
                        'MentionEveryone',
                        'ReadMessageHistory',
                    ],
                }))
            )
        ],
    });

    const claimedFieldName = ticketConfig.CLAIMING_SYSTEM.NotRequested.Name;
    const claimedFieldValue = ticketConfig.CLAIMING_SYSTEM.NotRequested.Value;

    const welcomeEmbed = new EmbedBuilder()
        .setColor(category.EmbedColor || ticketConfig.EMBED_COLORS.Info)
        .setTitle(category.TicketMessageTitle.replace('{category}', category.Name))
        .setDescription(category.TicketMessage.replace('{category}', category.Name))
        .addFields(
            { name: claimedFieldName, value: claimedFieldValue }
        );

    const closeButton = new ButtonBuilder()
        .setCustomId('closeTicket')
        .setLabel(ticketConfig.BUTTONS.closeTicketButton.Label)
        .setEmoji(ticketConfig.BUTTONS.closeTicketButton.emoji)
        .setStyle(ButtonStyle.Danger);

    let row;
    if (ticketConfig.CLAIMING_SYSTEM.Enabled) {
        const collectButton = new ButtonBuilder()
            .setCustomId('collectTicket')
            .setLabel(ticketConfig.BUTTONS.claimTicketButton.Label)
            .setEmoji(ticketConfig.BUTTONS.claimTicketButton.emoji)
            .setStyle(ButtonStyle.Success);

        row = new ActionRowBuilder().addComponents(closeButton, collectButton);
    } else {
        row = new ActionRowBuilder().addComponents(closeButton);
    }

    const welcomeMessage = await channel.send({ embeds: [welcomeEmbed], components: [row] });

    const responseEmbed = new EmbedBuilder()
        .setTitle(`${category.Name} Kérdések és válaszok`)
        .setDescription('A jegy nyitásakor megadott válaszok:')
        .addFields(Object.keys(responses).map(key => ({
            name: category.Questions.List.find(q => q.customId === key).question,
            value: responses[key],
            inline: false
        })));

    await channel.send({ embeds: [responseEmbed] });

    // Pingelés a támogatói szerepekre, ha be van kapcsolva a configban
    if (ticketConfig.SETTINGS.MentionSupportRoles) {
        const rolesToMention = ticketConfig.SETTINGS[guild.id]; // Dinamikus szerver ID alapján keresés
        if (rolesToMention && rolesToMention.length > 0) {
            const mentions = rolesToMention.map(roleId => `<@&${roleId}>`).join(', ');
            await channel.send(mentions);
        }
    }

    const successEmbed = new EmbedBuilder()
        .setColor(ticketConfig.EMBED_COLORS.Success)
        .setTitle(ticketConfig.TRANSLATE.TicketCreatedTitle)
        .setDescription(ticketConfig.TRANSLATE.TicketCreatedDesc.replace('{channel}', `https://discord.com/channels/${guild.id}/${channel.id}`))
        .setFooter({
            text: ticketConfig.TRANSLATE.TicketCreatedFooterText.replace('{username}', member.user.username).replace('{category-name}', category.Name),
            iconURL: member.user.displayAvatarURL({ format: 'png', size: 1024 })
        });

    const channelLinkButton = new ButtonBuilder()
        .setLabel(ticketConfig.BUTTONS.channelLinkButton.Label || 'Ticket URL Button')
        .setStyle(ButtonStyle.Link)
        .setEmoji(ticketConfig.BUTTONS.channelLinkButton.emoji)
        .setURL(`https://discord.com/channels/${guild.id}/${channel.id}`);

    const ticketLinkrow = new ActionRowBuilder().addComponents(channelLinkButton);

    await interaction.reply({ embeds: [successEmbed], components: [ticketLinkrow], ephemeral: true });

    const insertQuery = `
        INSERT INTO tickets (guild_id, support_role, user_by_opened, userid_by_opened, ticket_channel_id, channel_name, category_id, category_name, welcome_message_id, ticket_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
    `;

    db.query(insertQuery, [
        interaction.guild.id,
        category.SupportRoles.join(','),
        member.user.tag,
        member.user.id,
        channel.id,
        channel.name,
        category.CategoryID,
        category.Name,
        welcomeMessage.id
    ], (err, result) => {
        if (err) {
            console.error('Error inserting into the database:', err);
        } else {
            console.log('Data successfully inserted:', result);
        }
    });
}





// async function createTicketChannel(interaction, category, member, db) {
//     const guild = interaction.guild;

//     const channel = await guild.channels.create({
//         name: category.CreatedChannelName.replace('{tag}', member.user.tag),
//         type: ChannelType.GuildText,
//         parent: category.CategoryID,
//         topic: category.TopicMessage.replace('{username}', member.user.username).replace('{category-name}', category.Name),
//         permissionOverwrites: [
//             {
//                 id: guild.id,
//                 deny: ['ViewChannel'],
//             },
//             {
//                 id: member.id,
//                 allow: [
//                     'ViewChannel',
//                     'SendMessages',
//                     'EmbedLinks',
//                     'AttachFiles',
//                     'AddReactions',
//                     'UseExternalEmojis',
//                     'MentionEveryone',
//                     'ReadMessageHistory',
//                 ],
//             },
//             ...(ticketConfig.CLAIMING_SYSTEM.Enabled
//                 ? category.SupportRoles.map(roleId => ({
//                     id: roleId,
//                     allow: ['ViewChannel', 'ReadMessageHistory'],
//                     deny: ['SendMessages'],
//                 }))
//                 : category.SupportRoles.map(roleId => ({
//                     id: roleId,
//                     allow: [
//                         'ViewChannel',
//                         'SendMessages',
//                         'EmbedLinks',
//                         'AttachFiles',
//                         'AddReactions',
//                         'UseExternalEmojis',
//                         'MentionEveryone',
//                         'ReadMessageHistory',
//                     ],
//                 }))
//             )
//         ],
//     });

//     const claimedFieldName = ticketConfig.CLAIMING_SYSTEM.NotRequested.Name;
//     const claimedFieldValue = ticketConfig.CLAIMING_SYSTEM.NotRequested.Value;

//     const welcomeEmbed = new EmbedBuilder()
//         .setColor(category.EmbedColor || ticketConfig.EMBED_COLORS.Info)
//         .setTitle(category.TicketMessageTitle.replace('{category}', category.Name))
//         .setDescription(category.TicketMessage.replace('{category}', category.Name))
//         .addFields(
//             { name: claimedFieldName, value: claimedFieldValue }
//         );

//     const closeButton = new ButtonBuilder()
//         .setCustomId('closeTicket')
//         .setLabel(ticketConfig.BUTTONS.closeTicketButton.Label)
//         .setEmoji(ticketConfig.BUTTONS.closeTicketButton.emoji)
//         .setStyle(ButtonStyle.Danger);

//     let row;
//     if (ticketConfig.CLAIMING_SYSTEM.Enabled) {
//         const collectButton = new ButtonBuilder()
//             .setCustomId('collectTicket')
//             .setLabel(ticketConfig.BUTTONS.claimTicketButton.Label)
//             .setEmoji(ticketConfig.BUTTONS.claimTicketButton.emoji)
//             .setStyle(ButtonStyle.Success);

//         row = new ActionRowBuilder().addComponents(closeButton, collectButton);
//     } else {
//         row = new ActionRowBuilder().addComponents(closeButton);
//     }

//     const welcomeMessage = await channel.send({ embeds: [welcomeEmbed], components: [row] });

//     const successEmbed = new EmbedBuilder()
//         .setColor(ticketConfig.EMBED_COLORS.Success)
//         .setTitle(ticketConfig.TRANSLATE.TicketCreatedTitle)
//         .setDescription(ticketConfig.TRANSLATE.TicketCreatedDesc.replace('{channel}', `https://discord.com/channels/${guild.id}/${channel.id}`))
//         .setFooter({
//             text: ticketConfig.TRANSLATE.TicketCreatedFooterText.replace('{username}', member.user.username).replace('{category-name}', category.Name),
//             iconURL: member.user.displayAvatarURL({ format: 'png', size: 1024 })
//         });

//     const channelLinkButton = new ButtonBuilder()
//         .setLabel(ticketConfig.BUTTONS.channelLinkButton.Label || 'Ticket URL Button')
//         .setStyle(ButtonStyle.Link)
//         .setEmoji(ticketConfig.BUTTONS.channelLinkButton.emoji)
//         .setURL(`https://discord.com/channels/${guild.id}/${channel.id}`);

//     const ticketLinkrow = new ActionRowBuilder().addComponents(channelLinkButton);

//     await interaction.reply({ embeds: [successEmbed], components: [ticketLinkrow], ephemeral: true });

//     const insertQuery = `
//         INSERT INTO tickets (guild_id, support_role, user_by_opened, userid_by_opened, ticket_channel_id, channel_name, category_id, category_name, welcome_message_id, ticket_status) 
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
//     `;

//     db.query(insertQuery, [
//         interaction.guild.id,
//         category.SupportRoles.join(','),
//         member.user.tag,
//         member.user.id,
//         channel.id,
//         channel.name,
//         category.CategoryID,
//         category.Name,
//         welcomeMessage.id
//     ], (err, result) => {
//         if (err) {
//             console.error('Error inserting into the database:', err);
//         } else {
//             console.log('Data successfully inserted:', result);
//         }
//     });
// }


async function createTicketChannel(interaction, category, member, db) {
    const guild = interaction.guild;

    const channel = await guild.channels.create({
        name: category.CreatedChannelName.replace('{tag}', member.user.tag),
        type: ChannelType.GuildText,
        parent: category.CategoryID,
        topic: category.TopicMessage.replace('{username}', member.user.username).replace('{category-name}', category.Name),
        permissionOverwrites: [
            {
                id: guild.id,
                deny: ['ViewChannel'],
            },
            {
                id: member.id,
                allow: [
                    'ViewChannel',
                    'SendMessages',
                    'EmbedLinks',
                    'AttachFiles',
                    'AddReactions',
                    'UseExternalEmojis',
                    'MentionEveryone',
                    'ReadMessageHistory',
                ],
            },
            ...(ticketConfig.CLAIMING_SYSTEM.Enabled
                ? category.SupportRoles.map(roleId => ({
                    id: roleId,
                    allow: ['ViewChannel', 'ReadMessageHistory'],
                    deny: ['SendMessages'],
                }))
                : category.SupportRoles.map(roleId => ({
                    id: roleId,
                    allow: [
                        'ViewChannel',
                        'SendMessages',
                        'EmbedLinks',
                        'AttachFiles',
                        'AddReactions',
                        'UseExternalEmojis',
                        'MentionEveryone',
                        'ReadMessageHistory',
                    ],
                }))
            )
        ],
    });

    const claimedFieldName = ticketConfig.CLAIMING_SYSTEM.NotRequested.Name;
    const claimedFieldValue = ticketConfig.CLAIMING_SYSTEM.NotRequested.Value;

    const welcomeEmbed = new EmbedBuilder()
        .setColor(category.EmbedColor || ticketConfig.EMBED_COLORS.Info)
        .setTitle(category.TicketMessageTitle.replace('{category}', category.Name))
        .setDescription(category.TicketMessage.replace('{category}', category.Name))
        .addFields(
            { name: claimedFieldName, value: claimedFieldValue }
        );

    const closeButton = new ButtonBuilder()
        .setCustomId('closeTicket')
        .setLabel(ticketConfig.BUTTONS.closeTicketButton.Label)
        .setEmoji(ticketConfig.BUTTONS.closeTicketButton.emoji)
        .setStyle(ButtonStyle.Danger);

    let row;
    if (ticketConfig.CLAIMING_SYSTEM.Enabled) {
        const collectButton = new ButtonBuilder()
            .setCustomId('collectTicket')
            .setLabel(ticketConfig.BUTTONS.claimTicketButton.Label)
            .setEmoji(ticketConfig.BUTTONS.claimTicketButton.emoji)
            .setStyle(ButtonStyle.Success);

        row = new ActionRowBuilder().addComponents(closeButton, collectButton);
    } else {
        row = new ActionRowBuilder().addComponents(closeButton);
    }

    const welcomeMessage = await channel.send({ embeds: [welcomeEmbed], components: [row] });

    // Pingelés a támogatói szerepekre, ha be van kapcsolva a configban
    if (ticketConfig.SETTINGS.MentionSupportRoles) {
        const rolesToMention = ticketConfig.SETTINGS[guild.id]; // Dinamikus szerver ID alapján keresés
        if (rolesToMention && rolesToMention.length > 0) {
            const mentions = rolesToMention.map(roleId => `<@&${roleId}>`).join(', ');
            await channel.send(mentions);
        }
    }

    const successEmbed = new EmbedBuilder()
        .setColor(ticketConfig.EMBED_COLORS.Success)
        .setTitle(ticketConfig.TRANSLATE.TicketCreatedTitle)
        .setDescription(ticketConfig.TRANSLATE.TicketCreatedDesc.replace('{channel}', `https://discord.com/channels/${guild.id}/${channel.id}`))
        .setFooter({
            text: ticketConfig.TRANSLATE.TicketCreatedFooterText.replace('{username}', member.user.username).replace('{category-name}', category.Name),
            iconURL: member.user.displayAvatarURL({ format: 'png', size: 1024 })
        });

    const channelLinkButton = new ButtonBuilder()
        .setLabel(ticketConfig.BUTTONS.channelLinkButton.Label || 'Ticket URL Button')
        .setStyle(ButtonStyle.Link)
        .setEmoji(ticketConfig.BUTTONS.channelLinkButton.emoji)
        .setURL(`https://discord.com/channels/${guild.id}/${channel.id}`);

    const ticketLinkrow = new ActionRowBuilder().addComponents(channelLinkButton);

    await interaction.reply({ embeds: [successEmbed], components: [ticketLinkrow], ephemeral: true });

    const insertQuery = `
        INSERT INTO tickets (guild_id, support_role, user_by_opened, userid_by_opened, ticket_channel_id, channel_name, category_id, category_name, welcome_message_id, ticket_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
    `;

    db.query(insertQuery, [
        interaction.guild.id,
        category.SupportRoles.join(','),
        member.user.tag,
        member.user.id,
        channel.id,
        channel.name,
        category.CategoryID,
        category.Name,
        welcomeMessage.id
    ], (err, result) => {
        if (err) {
            console.error('Error inserting into the database:', err);
        } else {
            console.log('Data successfully inserted:', result);
        }
    });
}


async function collectTicket(interaction) {
    const db = getDb();
    const channelId = interaction.channel.id;
    const member = interaction.member;
    const guild = interaction.guild;

    await interaction.deferUpdate();

    const ticketQuery = `SELECT support_role, category_id, userid_by_opened FROM tickets WHERE ticket_channel_id = ?`;
    const ticketResult = await new Promise((resolve, reject) => {
        db.query(ticketQuery, [channelId], (err, results) => {
            if (err) {
                // console.error('Error fetching ticket details:', err);
                reject(err);
            } else {
                resolve(results[0]);
            }
        });
    });

    if (!ticketResult) {
        return interaction.followUp({ content: ticketConfig.TRANSLATE.NotFoundThisTicket, ephemeral: true });
    }

    const supportRoles = ticketResult.support_role.split(',');
    const hasSupportRole = supportRoles.some(roleId => member.roles.cache.has(roleId));

    if (!hasSupportRole) {
        return interaction.followUp({ content: ticketConfig.TRANSLATE.NoPermissionToClaim, ephemeral: true });
    }

    let supportCategory;
    if (ticketConfig.CLAIMING_SYSTEM.MoveTicketToSupport) {
        const supportCategoryName = ticketConfig.CLAIMING_SYSTEM.SupportCategoryName.replace('{support-category-name}', member.displayName);
        supportCategory = guild.channels.cache.find(channel => channel.name === supportCategoryName && channel.type === ChannelType.GuildCategory);

        if (!supportCategory) {
            // Create the support category if it doesn't exist
            supportCategory = await guild.channels.create({
                name: supportCategoryName,
                type: ChannelType.GuildCategory,
            });

            // Move the ticket channel to the support's category immediately
            await interaction.channel.setParent(supportCategory.id);

            // Place the newly created category at the top
            await supportCategory.setPosition(0);
        } else {
            // If the category already exists, just move the ticket
            await interaction.channel.setParent(supportCategory.id);
        }
    }

    // Update the database to reflect who claimed the ticket and the support category ID
    const updateQuery = `
        UPDATE tickets 
        SET claimed_by_id = ?, claimed_by_name = ?, support_category_id = ?
        WHERE ticket_channel_id = ?
    `;

    db.query(updateQuery, [member.id, member.user.tag, supportCategory.id, channelId], async (err, result) => {
        if (err) {
            console.error('Error updating the ticket:', err);
            return interaction.followUp({ content: ticketConfig.TRANSLATE.ErrorWhileUpdateTicket, ephemeral: true });
        }

        const channel = interaction.channel;

        if (ticketConfig.CLAIMING_SYSTEM.Enabled) {
            await channel.permissionOverwrites.set([
                {
                    id: interaction.guild.id, // Everyone role (mindenki)
                    deny: ['ViewChannel'], // Mindenki számára megtagadjuk a csatorna megtekintését
                },
                {
                    id: ticketResult.userid_by_opened, // A jegyet nyitó felhasználó
                    allow: [
                        'ViewChannel', // Csatorna megtekintése
                        'SendMessages', // Üzenetek küldése
                        'EmbedLinks', // Hivatkozások beágyazása
                        'AttachFiles', // Fájlok csatolása
                        'AddReactions', // Reakciók hozzáadása
                        'UseExternalEmojis', // Külső emotikonok használata
                        'MentionEveryone', // Mindenki és itt említése
                        'ReadMessageHistory', // Üzenet előzmények olvasása
                    ],
                },
                {
                    id: member.id, // A jegyet igénylő támogatói tag
                    allow: [
                        'ViewChannel', // Csatorna megtekintése
                        'SendMessages', // Üzenetek küldése
                        'EmbedLinks', // Hivatkozások beágyazása
                        'AttachFiles', // Fájlok csatolása
                        'AddReactions', // Reakciók hozzáadása
                        'UseExternalEmojis', // Külső emotikonok használata
                        'MentionEveryone', // Mindenki és itt említése
                        'ReadMessageHistory', // Üzenet előzmények olvasása
                    ],
                },
                ...supportRoles.map(roleId => ({
                    id: roleId, // Támogatói szerepkörök
                    allow: [
                        'ViewChannel', // Csatorna megtekintése
                        'ReadMessageHistory', // Üzenet előzmények olvasása
                    ],
                    deny: ['SendMessages'], // Üzenetek küldésének megtagadása
                })),
            ]);
        }

        const embed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(embed)
            .spliceFields(0, 1, {
                name: ticketConfig.CLAIMING_SYSTEM.RequesterField.Title,
                value: ticketConfig.CLAIMING_SYSTEM.RequesterField.Value
                    .replace('{memberId}', member.id)
                    .replace('{memberTag}', member.user.tag)
            });

        // Disable the "Igénylés" button and add an "Unclaim" button
        const collectedButton = new ButtonBuilder()
            .setCustomId('collectTicket')
            .setLabel(ticketConfig.BUTTONS.ticketClaimed.Label)
            .setEmoji(ticketConfig.BUTTONS.ticketClaimed.emoji)
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const unclaimButton = new ButtonBuilder()
            .setCustomId('unclaimTicket')
            .setLabel(ticketConfig.BUTTONS.unclaimTicketButton.Label)
            .setEmoji(ticketConfig.BUTTONS.unclaimTicketButton.emoji)
            .setStyle(ButtonStyle.Secondary);

        const closeButton = new ButtonBuilder()
            .setCustomId('closeTicket')
            .setLabel(ticketConfig.BUTTONS.closeTicketButton.Label)
            .setEmoji(ticketConfig.BUTTONS.closeTicketButton.emoji)
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(closeButton, collectedButton, unclaimButton);
        await interaction.editReply({ embeds: [updatedEmbed], components: [row] });
        // console.log(`Ticket claimed by ${member.user.tag} (${member.id})`);
    });

    if (supportCategory) {
        await supportCategory.setPosition(0);
    }
}




async function unclaimTicket(interaction) {
    const db = getDb();
    const channelId = interaction.channel.id;
    const member = interaction.member;

    const query = `SELECT claimed_by_id, guild_id, support_role, userid_by_opened, category_id FROM tickets WHERE ticket_channel_id = ?`;
    const ticket = await new Promise((resolve, reject) => {
        db.query(query, [channelId], (err, results) => {
            if (err) {
                console.error('Error fetching ticket data:', err);
                return reject(err);
            }
            resolve(results[0]);
        });
    });

    if (!ticket) {
        return interaction.reply({ content: ticketConfig.TRANSLATE.NotFoundThisTicket, ephemeral: true });
    }

    const isClaimer = ticket.claimed_by_id === member.id;
    let canUnclaim = false;

    if (ticketConfig.CLAIMING_SYSTEM.SupportCanUnclaim === true && isClaimer) {
        canUnclaim = true;
    } else if (ticketConfig.CLAIMING_SYSTEM.SupportCanUnclaim === false) {
        const hasHigherRole = ticketConfig.CLAIMING_SYSTEM.UnclaimRole[ticket.guild_id]?.some(roleId =>
            member.roles.cache.has(roleId)
        );

        if (hasHigherRole) {
            canUnclaim = true;
        } else {
            return interaction.reply({ content: ticketConfig.TRANSLATE.NoPermissionTuUnclaim, ephemeral: true });
        }
    }

    if (!canUnclaim) {
        return interaction.reply({ content: ticketConfig.TRANSLATE.NoPermissionTuUnclaim2, ephemeral: true });
    }

    if (ticketConfig.CLAIMING_SYSTEM.MoveTicketToSupport) {
        const originalCategoryId = ticket.category_id;

        await interaction.channel.setParent(originalCategoryId);
    }

    const updateQuery = `
        UPDATE tickets 
        SET claimed_by_id = NULL, claimed_by_name = NULL, support_category_id = NULL
        WHERE ticket_channel_id = ?
    `;

    db.query(updateQuery, [channelId], async (err, result) => {
        if (err) {
            console.error('Error unclaiming the ticket:', err);
            return interaction.reply({ content: ticketConfig.TRANSLATE.ErrorWhileUpdateTicket, ephemeral: true });
        }

        const channel = interaction.channel;
        await channel.permissionOverwrites.set([
            {
                id: interaction.guild.id,
                deny: ['ViewChannel'],
            },
            {
                id: ticket.userid_by_opened,
                allow: [
                    'ViewChannel', // Csatorna megtekintése
                    'SendMessages', // Üzenetek küldése
                    'EmbedLinks', // Hivatkozások beágyazása
                    'AttachFiles', // Fájlok csatolása
                    'AddReactions', // Reakciók hozzáadása
                    'UseExternalEmojis', // Külső emotikonok használata
                    'MentionEveryone', // Mindenki és itt említése
                    'ReadMessageHistory', // Üzenet előzmények olvasása
                ],
            },
            ...ticket.support_role.split(',').map(roleId => ({
                id: roleId,
                allow: ['ViewChannel', 'ReadMessageHistory'],
                deny: ['SendMessages'],
            })),
        ]);

        const embed = interaction.message.embeds[0];

        const updatedEmbed = EmbedBuilder.from(embed)
            .spliceFields(0, 1, {
                name: ticketConfig.CLAIMING_SYSTEM.NotRequested.Name,
                value: ticketConfig.CLAIMING_SYSTEM.NotRequested.Value
                    .replace('{memberId}', member.id)
                    .replace('{memberTag}', member.user.tag)
            });

        const collectButton = new ButtonBuilder()
            .setCustomId('collectTicket')
            .setLabel(ticketConfig.BUTTONS.claimTicketButton.Label)
            .setEmoji(ticketConfig.BUTTONS.claimTicketButton.emoji)
            .setStyle(ButtonStyle.Success);

        const closeButton = new ButtonBuilder()
            .setCustomId('closeTicket')
            .setLabel(ticketConfig.BUTTONS.closeTicketButton.Label)
            .setEmoji(ticketConfig.BUTTONS.closeTicketButton.emoji)
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(closeButton, collectButton);
        await interaction.update({ embeds: [updatedEmbed], components: [row] });
        // console.log(`Ticket unclaimed by ${member.user.tag} (${member.id})`);
    });
}



async function closeTicket(interaction) {
    const channel = interaction.channel;
    await interaction.deferUpdate();

    const query = `SELECT support_role, userid_by_opened, channel_name, category_id, category_name, claimed_by_id, claimed_by_name, guild_id FROM tickets WHERE ticket_channel_id = ?`;
    const db = getDb();
    db.query(query, [channel.id], async (err, results) => {
        if (err) {
            console.error('Error querying the database:', err);
            return interaction.followUp({ content: 'Error checking permissions.', ephemeral: true });
        }

        if (results.length === 0) {
            return interaction.followUp({ content: ticketConfig.TRANSLATE.NoPermissionToClose, ephemeral: true });
        }

        const supportRoles = results[0].support_role.split(',');
        const hasPermission = supportRoles.some(roleId => interaction.member.roles.cache.has(roleId));
        const isTicketCreator = interaction.member.id === results[0].userid_by_opened;

        if (!hasPermission && (!isTicketCreator || !ticketConfig.ARCHIVE_SETTINGS.UserCanClose)) {
            return interaction.followUp({ content: ticketConfig.TRANSLATE.NoPermissionToClose, ephemeral: true });
        }

        if (ticketConfig.ARCHIVE_SETTINGS.Enabled) {
            const embed = new EmbedBuilder()
                .setColor(ticketConfig.EMBED_COLORS.Success)
                .setTitle(ticketConfig.TRANSLATE.TicketArchived)
                .setDescription(ticketConfig.TRANSLATE.TicketArchivedDesc
                    .replace('{userId}', interaction.user.id)
                    .replace('{userTag}', interaction.user.tag));

            const reopenButton = new ButtonBuilder()
                .setCustomId('reopenTicket')
                .setLabel(ticketConfig.BUTTONS.reopenTicketButton.Label)
                .setEmoji(ticketConfig.BUTTONS.reopenTicketButton.emoji)
                .setStyle(ButtonStyle.Success);

            const transcriptButton = new ButtonBuilder()
                .setCustomId('transcriptTicket')
                .setLabel(ticketConfig.BUTTONS.transcriptTicketButton.Label)
                .setEmoji(ticketConfig.BUTTONS.transcriptTicketButton.emoji)
                .setStyle(ButtonStyle.Secondary);

            const deleteButton = new ButtonBuilder()
                .setCustomId('deleteTicket')
                .setLabel(ticketConfig.BUTTONS.deleteTicketButton.Label)
                .setEmoji(ticketConfig.BUTTONS.deleteTicketButton.emoji)
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(reopenButton, transcriptButton, deleteButton);
            await interaction.followUp({ embeds: [embed], components: [row] });

            if (ticketConfig.ARCHIVE_SETTINGS.MoveToArchiveCategory) {
                const archiveCategoryId = ticketConfig.ARCHIVE_SETTINGS.ArchiveCategory[results[0].guild_id];

                if (!archiveCategoryId) {
                    console.warn(`No archive category ID found for guild: ${results[0].guild_id}`);
                    return interaction.followUp({ content: ticketConfig.TRANSLATE.NoArchivedCategory, ephemeral: true });
                }

                const archiveCategory = interaction.guild.channels.cache.get(archiveCategoryId);

                if (!archiveCategory || archiveCategory.type !== ChannelType.GuildCategory) {
                    return interaction.followUp({ content: ticketConfig.TRANSLATE.NotValidArchiveType, ephemeral: true });
                }

                await channel.setParent(archiveCategoryId, { lockPermissions: false });

                if (ticketConfig.ARCHIVE_SETTINGS.RenameClosedTicket) {
                    const closedChannelName = ticketConfig.ARCHIVE_SETTINGS.ClosedTicketName.replace('{channel-name}', results[0].channel_name);
                    await channel.setName(closedChannelName);
                }

                const userId = results[0].userid_by_opened;
                await channel.permissionOverwrites.edit(userId, { ViewChannel: ticketConfig.SETTINGS.ViewClosedTicket, SendMessages: ticketConfig.ARCHIVE_SETTINGS.SendMessages, ReadMessageHistory: ticketConfig.ARCHIVE_SETTINGS.ReadMessage });

                await Promise.all(supportRoles.map(async (roleId) => {
                    await channel.permissionOverwrites.edit(roleId, {
                        ViewChannel: true,
                        SendMessages: false,
                        ReadMessageHistory: true
                    });
                }));
            }
        } else {
            if (hasPermission || (ticketConfig.ARCHIVE_SETTINGS.UserCanClose && isTicketCreator)) {
                const deleteTime = ticketConfig.SETTINGS.DeleteTime;

                const deletionEmbed = new EmbedBuilder()
                    .setColor(ticketConfig.EMBED_COLORS.Error)
                    .setTitle(ticketConfig.TRANSLATE.TicketDeletion)
                    .setDescription(ticketConfig.TRANSLATE.DeleteTicketDesc.replace('{time}', deleteTime));

                await interaction.followUp({ embeds: [deletionEmbed], ephemeral: false });

                const updateStatusQuery = `UPDATE tickets SET ticket_status = 'closed' WHERE ticket_channel_id = ?`;
                db.query(updateStatusQuery, [channel.id], (err, result) => {
                    if (err) {
                        console.error('Error updating ticket status:', err);
                    }
                });

                setTimeout(async () => {
                    try {
                        const allMessages = await channel.messages.fetch();
                        const userMessages = allMessages.filter(message => !message.author.bot);
                        const messageCount = userMessages.size;

                        const user = await interaction.guild.members.fetch(results[0].userid_by_opened);

                        let reviewText = '';
                        if (ticketConfig.REVIEW_SETTINGS.Enabled) {
                            const reviewQuery = `SELECT review_message, review_rating FROM ticket_reviews WHERE ticket_channel_id = ? AND review_already_sent = 'true'`;
                            const reviewResult = await new Promise((resolve, reject) => {
                                db.query(reviewQuery, [channel.id], (err, results) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve(results[0]);
                                    }
                                });
                            });

                            if (reviewResult) {
                                const starEmojis = ticketConfig.REVIEW_SETTINGS.reviewEmoji.repeat(reviewResult.review_rating);
                                reviewText = `${starEmojis} | ${reviewResult.review_rating}/5\n ${ticketConfig.TICKET_DM_SETTINGS.Embed.Field.Value2} ${reviewResult.review_message}`;
                            }
                        }

                        const claimedBy = results[0].claimed_by_id && results[0].claimed_by_name
                            ? `<@${results[0].claimed_by_id}> (${results[0].claimed_by_name})`
                            : ticketConfig.TICKET_DM_SETTINGS.Embed.Field.IfNotClaimed;

                        let embedFieldValue = ticketConfig.TICKET_DM_SETTINGS.Embed.Field.Value
                            .replace('{openedCategory}', results[0].category_name)
                            .replace('{closedBy}', interaction.user.tag)
                            .replace('{messageCount}', messageCount)
                            .replace('{reviewText}', reviewText || `${ticketConfig.TICKET_DM_SETTINGS.Embed.Field.NoAddedReview}`);

                        if (ticketConfig.CLAIMING_SYSTEM.Enabled) {
                            embedFieldValue = embedFieldValue.replace('{claimedBy}', claimedBy);
                        } else {
                            embedFieldValue = embedFieldValue.replace(/\n.*{claimedBy}.*\n/, '');
                        }

                        const dmEmbed = new EmbedBuilder()
                            .setColor(ticketConfig.TICKET_DM_SETTINGS.Embed.Color)
                            .setTitle(ticketConfig.TICKET_DM_SETTINGS.Embed.Title)
                            .setAuthor({ name: user.user.tag, iconURL: user.user.displayAvatarURL({ format: 'png', size: 1024 }) })
                            .setDescription(ticketConfig.TICKET_DM_SETTINGS.Embed.Description.replace('{guildName}', interaction.guild.name))
                            .setThumbnail(user.user.displayAvatarURL({ format: 'png', size: 1024 }))
                            .addFields({
                                name: ticketConfig.TICKET_DM_SETTINGS.Embed.Field.Title,
                                value: embedFieldValue,
                                inline: false
                            });

                        if (ticketConfig.TICKET_DM_SETTINGS.Embed.Timestamp) {
                            dmEmbed.setTimestamp();
                        }

                        dmEmbed.setFooter({
                            text: ticketConfig.TICKET_DM_SETTINGS.Embed.FooterText.replace('{guildName}', interaction.guild.name),
                            iconURL: interaction.guild.iconURL()
                        });

                        const dmOptions = { embeds: [dmEmbed] };

                        if (ticketConfig.TICKET_DM_SETTINGS.Transcript.Enabled && messageCount >= ticketConfig.TICKET_DM_SETTINGS.Transcript.MinMessage) {
                            const transcriptAttachment = await discordTranscripts.createTranscript(channel, {
                                returnType: 'buffer',
                                fileName: `${channel.name}.html`
                            });
                            dmOptions.files = [{ attachment: transcriptAttachment, name: `${results[0].channel_name}.html` }];

                            if (ticketConfig.REVIEW_SETTINGS.Enabled) {
                                const selectMenu = new StringSelectMenuBuilder()
                                    .setCustomId(`ticketRating_${results[0].guild_id}_${channel.id}`)
                                    .setPlaceholder(ticketConfig.REVIEW_SETTINGS.reviewPlaceholder)
                                    .addOptions([
                                        { label: ticketConfig.REVIEW_SETTINGS.OptionsLabel[1], value: '1', emoji: ticketConfig.REVIEW_SETTINGS.reviewEmoji },
                                        { label: ticketConfig.REVIEW_SETTINGS.OptionsLabel[2], value: '2', emoji: ticketConfig.REVIEW_SETTINGS.reviewEmoji },
                                        { label: ticketConfig.REVIEW_SETTINGS.OptionsLabel[3], value: '3', emoji: ticketConfig.REVIEW_SETTINGS.reviewEmoji },
                                        { label: ticketConfig.REVIEW_SETTINGS.OptionsLabel[4], value: '4', emoji: ticketConfig.REVIEW_SETTINGS.reviewEmoji },
                                        { label: ticketConfig.REVIEW_SETTINGS.OptionsLabel[5], value: '5', emoji: ticketConfig.REVIEW_SETTINGS.reviewEmoji }
                                    ]);

                                const reviewRow = new ActionRowBuilder().addComponents(selectMenu);
                                dmOptions.components = [reviewRow];
                            }
                        }

                        const DmMessage = await user.send(dmOptions);

                        // Store the DM message ID in the database
                        const insertReviewQuery = `
                            INSERT INTO ticket_reviews (guild_id, user_by_opened, userid_by_opened, ticket_channel_id, channel_name, category_id, category_name, total_messages, dm_review_message_id, review_already_sent, claimed_by_id, claimed_by_name)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `;
                        db.query(insertReviewQuery, [
                            results[0].guild_id,
                            results[0].userid_by_opened,
                            interaction.user.id,
                            interaction.channel.id,
                            results[0].channel_name,
                            results[0].category_id,
                            results[0].category_name,
                            messageCount,
                            DmMessage.id, // Store the DM message ID here
                            'false',
                            results[0].claimed_by_id,
                            results[0].claimed_by_name
                        ], (err, res) => {
                            if (err) {
                                console.error('Error inserting review interaction to the database:', err);
                            }
                        });

                        // **Update the ticket with the total number of user messages**
                        const updateMessageCountQuery = `
                            UPDATE tickets
                            SET total_messages = ?
                            WHERE ticket_channel_id = ?
                        `;
                        db.query(updateMessageCountQuery, [messageCount, channel.id], (err, res) => {
                            if (err) {
                                console.error('Error updating total_messages in the database:', err);
                            } else {
                                // console.log(`Successfully updated total_messages to ${messageCount} for channel ${channel.id}`);
                            }
                        });

                        await channel.delete();

                    } catch (error) {
                        console.error('Error deleting the channel:', error);
                    }
                }, deleteTime * 1000);
            } else {
                return interaction.followUp({ content: 'You are not authorized to close this ticket.', ephemeral: true });
            }
        }
    });
}




async function deleteTicket(interaction) {
    const channel = interaction.channel;
    const db = getDb();

    const query = `SELECT support_role, userid_by_opened, ticket_channel_id, channel_name, category_name, category_id, guild_id, claimed_by_id, claimed_by_name FROM tickets WHERE ticket_channel_id = ?`;
    const result = await new Promise((resolve, reject) => {
        db.query(query, [channel.id], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results[0]);
            }
        });
    });

    if (!result || !result.guild_id) {
        return interaction.reply({ content: ticketConfig.TRANSLATE.NotFoundDataToThisTicket, ephemeral: true });
    }

    const guild = interaction.client.guilds.cache.get(result.guild_id);
    if (!guild) {
        return interaction.reply({ content: ticketConfig.TRANSLATE.NotFoundGuildData, ephemeral: true });
    }

    const supportRoles = result.support_role.split(',');
    const hasPermission = supportRoles.some(roleId => interaction.member.roles.cache.has(roleId));
    const isTicketCreator = interaction.member.id === result.userid_by_opened;

    if (!hasPermission && (!isTicketCreator && !ticketConfig.ARCHIVE_SETTINGS.UserCanClose)) {
        return interaction.reply({ content: ticketConfig.TRANSLATE.NoPermissionToDeleteTicket, ephemeral: true });
    }

    let reviewText = '';  // Default empty review text

    if (ticketConfig.REVIEW_SETTINGS.Enabled) {
        const reviewQuery = `SELECT review_message, review_rating FROM ticket_reviews WHERE ticket_channel_id = ? AND review_already_sent = 'true'`;
        const reviewResult = await new Promise((resolve, reject) => {
            db.query(reviewQuery, [result.ticket_channel_id], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results[0]);
                }
            });
        });

        if (reviewResult) {
            const starEmojis = ticketConfig.REVIEW_SETTINGS.reviewEmoji.repeat(reviewResult.review_rating);
            reviewText = `${starEmojis} | ${reviewResult.review_rating}/5\ ${ticketConfig.TICKET_DM_SETTINGS.Embed.Field.Value2} ${reviewResult.review_message}`;
        }
    }

    const embed = new EmbedBuilder()
        .setColor(ticketConfig.EMBED_COLORS.Error)
        .setTitle(ticketConfig.TRANSLATE.TicketDeletion)
        .setDescription(ticketConfig.TRANSLATE.DeleteTicketDesc.replace('{time}', ticketConfig.SETTINGS.DeleteTime));

    await interaction.reply({ embeds: [embed], ephemeral: false });

    setTimeout(async () => {
        try {
            const user = await guild.members.fetch(result.userid_by_opened);

            const allMessages = await channel.messages.fetch({ limit: 100 });
            // console.log(`Total messages fetched: ${allMessages.size}`);
            const userMessages = allMessages.filter(message => !message.author.bot);
            // console.log(`User messages (non-bot) count: ${userMessages.size}`);

            const messageCount = userMessages.size;

            const claimedBy = result.claimed_by_id && result.claimed_by_name
                ? `<@${result.claimed_by_id}> (${result.claimed_by_name})`
                : ticketConfig.TICKET_DM_SETTINGS.Embed.Field.IfNotClaimed;

            let embedFieldValue = ticketConfig.TICKET_DM_SETTINGS.Embed.Field.Value
                .replace('{openedCategory}', result.category_name)
                .replace('{closedBy}', interaction.user.tag)
                .replace('{messageCount}', messageCount)
                .replace('{reviewText}', reviewText || `${ticketConfig.TICKET_DM_SETTINGS.Embed.Field.NoAddedReview}`);

            if (ticketConfig.CLAIMING_SYSTEM.Enabled) {
                embedFieldValue = embedFieldValue.replace('{claimedBy}', claimedBy);
            } else {
                embedFieldValue = embedFieldValue.replace(/\n.*{claimedBy}.*\n/, '');
            }

            const dmEmbed = new EmbedBuilder()
                .setColor(ticketConfig.TICKET_DM_SETTINGS.Embed.Color)
                .setTitle(ticketConfig.TICKET_DM_SETTINGS.Embed.Title)
                .setAuthor({ name: user.user.tag, iconURL: user.user.displayAvatarURL({ format: 'png', size: 1024 }) })
                .setDescription(ticketConfig.TICKET_DM_SETTINGS.Embed.Description.replace('{guildName}', guild.name))
                .setThumbnail(user.user.displayAvatarURL({ format: 'png', size: 1024 }))
                .addFields({ name: ticketConfig.TICKET_DM_SETTINGS.Embed.Field.Title, value: embedFieldValue, inline: false });

            if (ticketConfig.TICKET_DM_SETTINGS.Embed.Timestamp) {
                dmEmbed.setTimestamp();
            }

            dmEmbed.setFooter({
                text: ticketConfig.TICKET_DM_SETTINGS.Embed.FooterText.replace('{guildName}', guild.name),
                iconURL: guild.iconURL()
            });

            const dmOptions = { embeds: [dmEmbed] };

            if (ticketConfig.TICKET_DM_SETTINGS.Transcript.Enabled && messageCount >= ticketConfig.TICKET_DM_SETTINGS.Transcript.MinMessage) {
                const transcriptAttachment = await discordTranscripts.createTranscript(channel, {
                    returnType: 'buffer',
                    fileName: `${channel.name}.html`
                });
                dmOptions.files = [{ attachment: transcriptAttachment, name: `${result.channel_name}.html` }];

                if (ticketConfig.REVIEW_SETTINGS.Enabled) {
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`ticketRating_${result.guild_id}_${channel.id}`)
                        .setPlaceholder(ticketConfig.REVIEW_SETTINGS.reviewPlaceholder)
                        .addOptions([
                            { label: ticketConfig.REVIEW_SETTINGS.OptionsLabel[1], value: '1', emoji: ticketConfig.REVIEW_SETTINGS.reviewEmoji },
                            { label: ticketConfig.REVIEW_SETTINGS.OptionsLabel[2], value: '2', emoji: ticketConfig.REVIEW_SETTINGS.reviewEmoji },
                            { label: ticketConfig.REVIEW_SETTINGS.OptionsLabel[3], value: '3', emoji: ticketConfig.REVIEW_SETTINGS.reviewEmoji },
                            { label: ticketConfig.REVIEW_SETTINGS.OptionsLabel[4], value: '4', emoji: ticketConfig.REVIEW_SETTINGS.reviewEmoji },
                            { label: ticketConfig.REVIEW_SETTINGS.OptionsLabel[5], value: '5', emoji: ticketConfig.REVIEW_SETTINGS.reviewEmoji }
                        ]);

                    const reviewRow = new ActionRowBuilder().addComponents(selectMenu);
                    dmOptions.components = [reviewRow];
                }
            }

            const DmMessage = await user.send(dmOptions);

            // Store the DM message ID in the database
            const insertReviewQuery = `
                INSERT INTO ticket_reviews (guild_id, user_by_opened, userid_by_opened, ticket_channel_id, channel_name, category_id, category_name, total_messages, dm_review_message_id, review_already_sent, claimed_by_id, claimed_by_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.query(insertReviewQuery, [
                result.guild_id,
                result.userid_by_opened,
                interaction.user.id,
                result.ticket_channel_id,
                result.channel_name,
                result.category_id,
                result.category_name,
                messageCount,
                DmMessage.id,
                'false',
                result.claimed_by_id,
                result.claimed_by_name
            ], (err, res) => {
                if (err) {
                    console.error('Error inserting review interaction to the database:', err);
                }
            });

            const updateMessageCountQuery = `
            UPDATE tickets
            SET total_messages = ?
            WHERE ticket_channel_id = ?
        `;

            db.query(updateMessageCountQuery, [messageCount, channel.id], (err, res) => {
                if (err) {
                    console.error('Error updating total_messages in the database:', err);
                } else {
                    // console.log(`Successfully updated total_messages to ${messageCount} for channel ${channel.id}`);
                }
            });


            // Update the ticket status
            const updateTicketStatusQuery = `
                UPDATE tickets
                SET ticket_status = 'closed'
                WHERE ticket_channel_id = ?
            `;
            db.query(updateTicketStatusQuery, [result.ticket_channel_id], (err, res) => {
                if (err) {
                    console.error('Error updating ticket status in the database:', err);
                }
            });

            // Logging the ticket deletion
            if (ticketConfig.LOGS_SETTINGS && ticketConfig.LOGS_SETTINGS.LogTypes.DeleteTicket.Enabled) {
                const logChannelId = ticketConfig.LOGS_SETTINGS.LogTypes.DeleteTicket.Channels[result.guild_id];

                if (logChannelId) {
                    const logChannel = await guild.channels.fetch(logChannelId);
                    if (logChannel) {
                        let description = ticketConfig.LOGS_SETTINGS.LogTypes.DeleteTicket.Description
                            .replace('{openedBy}', `<@${result.userid_by_opened}> | (${user.user.tag})`)
                            .replace('{openedCategory}', result.category_name)
                            .replace('{closedBy}', `<@${interaction.user.id}> | (${interaction.user.tag})`)
                            .replace('{channelName}', result.channel_name)
                            .replace('{channelId}', channel.id)
                            .replace('{messageCount}', messageCount);

                        if (ticketConfig.CLAIMING_SYSTEM.Enabled) {
                            const claimedBy = result.claimed_by_id && result.claimed_by_name
                                ? `<@${result.claimed_by_id}> (${result.claimed_by_name})`
                                : ticketConfig.LOGS_SETTINGS.LogTypes.DeleteTicket.IfNotClaimed;
                            description = description.replace('{claimedBy}', claimedBy);
                        } else {
                            description = description.replace(/\n.*{claimedBy}.*\n/, '');
                        }

                        await logChannel.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(ticketConfig.LOGS_SETTINGS.LogTypes.DeleteTicket.EmbedColor)
                                    .setAuthor({ name: user.user.tag, iconURL: user.user.displayAvatarURL({ format: 'png', size: 1024 }) })
                                    .setTitle(ticketConfig.LOGS_SETTINGS.LogTypes.DeleteTicket.Title)
                                    .setThumbnail(user.user.displayAvatarURL({ format: 'png', size: 1024 }))
                                    .setDescription(description)
                                    .setTimestamp()
                                    .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                            ],
                            files: dmOptions.files ? [{ attachment: dmOptions.files[0].attachment, name: `${result.channel_name}.html` }] : []
                        });
                    } else {
                        console.warn(`Log channel not found in guild with ID ${result.guild_id}`);
                    }
                } else {
                    console.warn(`No log channel configured for guild ID ${result.guild_id} in DeleteTicket settings.`);
                }
            }

            await channel.delete();

            if (DmMessage) {
                console.log(`DM sent successfully to ${user.user.tag}. Message ID: ${DmMessage.id}`);
            }

        } catch (error) {
            console.error('Error deleting the channel:', error);
        }
    }, ticketConfig.SETTINGS.DeleteTime * 1000);
}




async function handleTicketReview(interaction) {
    const db = getDb();
    const userId = interaction.user.id;

    const reviewQuery = `
        SELECT * FROM ticket_reviews 
        WHERE dm_review_message_id = ? 
        AND user_by_opened = ? 
        AND review_already_sent = 'false'
    `;

    // console.log('Lekérdezés indul a következő adatokkal:');
    // console.log('dm_review_message_id (interaction.message.id):', interaction.message.id); // interaction.message.id az üzenet ID
    // console.log('user_by_opened (userId):', userId);

    const reviewResult = await new Promise((resolve, reject) => {
        db.query(reviewQuery, [interaction.message.id, userId], (err, results) => {
            if (err) {
                console.error('An error occurred while querying the database:', err);
                reject(err);
            } else if (results.length > 0) {
                // console.log('Query result:', results[0]);
                resolve(results[0]);
            } else {
                console.log('No results for your query.');
                resolve(null);
            }
        });
    });

    if (!reviewResult) {
        console.error('No review data found or review already submitted for this interaction.');
        return interaction.reply({ content: ticketConfig.TRANSLATE.NoValidData, ephemeral: true });
    }

    const rating = interaction.values[0];
    // console.log('Selected rating (rating):', rating);

    const inputStyle = ticketConfig.REVIEW_MODAL.InputStyle === 'Short'
        ? TextInputStyle.Short
        : TextInputStyle.Paragraph;

    const modal = new ModalBuilder()
        .setCustomId(`ticketReviewModal_${reviewResult.guild_id}_${rating}`)
        .setTitle(ticketConfig.REVIEW_MODAL.Title)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('reviewMessage')
                    .setLabel(ticketConfig.REVIEW_MODAL.Label)
                    .setStyle(inputStyle)
                    .setMinLength(ticketConfig.REVIEW_MODAL.MinLength)
                    .setMaxLength(ticketConfig.REVIEW_MODAL.MaxLength)
                    .setRequired(true)
            )
        );

    await interaction.showModal(modal);
}



async function handleModalSubmit(interaction) {
    const db = getDb();

    if (interaction.customId.startsWith('ticketReviewModal')) {
        const reviewMessage = interaction.fields.getTextInputValue('reviewMessage');
        const [modalType, guildId, selectedValue] = interaction.customId.split('_');

        const query = `SELECT * FROM ticket_reviews WHERE guild_id = ? AND dm_review_message_id = ? AND review_already_sent = 'false'`;
        const result = await new Promise((resolve, reject) => {
            db.query(query, [guildId, interaction.message.id], (err, results) => {
                if (err) {
                    console.error('Database query error:', err);
                    reject(err);
                } else {
                    resolve(results[0]);
                }
            });
        });

        if (!result) {
            return interaction.reply({ content: ticketConfig.TRANSLATE.NoValidData, ephemeral: true });
        }

        const ticketQuery = `SELECT claimed_by_name, category_name FROM tickets WHERE ticket_channel_id = ?`;
        const ticketResult = await new Promise((resolve, reject) => {
            db.query(ticketQuery, [result.ticket_channel_id], (err, results) => {
                if (err) {
                    console.error('Database query error:', err);
                    reject(err);
                } else {
                    resolve(results[0]);
                }
            });
        });

        let claimedByText = ticketConfig.REVIEW_MESSAGE.ClaimedByDefault;
        if (ticketResult && ticketResult.claimed_by_name) {
            claimedByText = ticketResult.claimed_by_name;
        }

        const reviewChannelID = ticketConfig.REVIEW_SETTINGS.reviewChannelID[result.guild_id];
        if (!reviewChannelID) {
            return interaction.reply({ content: ticketConfig.TRANSLATE.NotFoundReviewChannel, ephemeral: true });
        }

        try {
            const guild = interaction.client.guilds.cache.get(result.guild_id);
            const reviewChannel = await guild.channels.fetch(reviewChannelID);
            if (!reviewChannel) {
                return interaction.reply({ content: ticketConfig.TRANSLATE.NotFoundReviewChannel, ephemeral: true });
            }

            const starEmojis = ticketConfig.REVIEW_SETTINGS.reviewEmoji.repeat(selectedValue);
            const userProfileURL = `https://discord.com/users/${interaction.user.id}`;

            const description = ticketConfig.REVIEW_MESSAGE.DescriptionTemplate
                .replace('{starEmojis}', starEmojis)
                .replace('{rating}', selectedValue)
                .replace('{reviewMessage}', reviewMessage);

            const reviewLogEmbed = new EmbedBuilder()
                .setAuthor({ name: ticketConfig.REVIEW_MESSAGE.AuthorName, iconURL: interaction.user.displayAvatarURL({ format: 'png', size: 1024 }), url: userProfileURL })
                .setTitle(ticketConfig.REVIEW_MESSAGE.Title)
                .setColor(ticketConfig.REVIEW_MESSAGE.Color)
                .setThumbnail(interaction.user.displayAvatarURL({ format: 'png', size: 1024 }))
                .setDescription(description)
                .addFields(
                    { name: ticketConfig.REVIEW_MESSAGE.Divider, value: ' ' },
                    { name: ticketConfig.REVIEW_MESSAGE.InformationTitle, value: ' ', inline: false },
                    { name: ticketConfig.REVIEW_MESSAGE.Fields.User, value: `<@${interaction.user.id}> | ${interaction.user.tag}`, inline: true },
                    { name: ticketConfig.REVIEW_MESSAGE.Fields.UserID, value: `${interaction.user.id}`, inline: true },
                    { name: ' ', value: ' ', inline: true },
                    { name: ticketConfig.REVIEW_MESSAGE.Fields.OpenCategory, value: `${ticketResult.category_name}`, inline: true },
                    { name: ticketConfig.REVIEW_MESSAGE.Fields.ClaimedBy, value: claimedByText, inline: true },
                    { name: ' ', value: ' ', inline: true },
                )
                .setFooter({ text: ticketConfig.REVIEW_MESSAGE.FooterText.replace('{guildName}', guild.name), iconURL: guild.iconURL() })
                .setTimestamp();

            await reviewChannel.send({ embeds: [reviewLogEmbed] });

            // Update the review in the database
            const updateQuery = `
                UPDATE ticket_reviews 
                SET review_already_sent = 'true', 
                    review_message = ?, 
                    review_rating = ?, 
                    updated_at = NOW() 
                WHERE id = ?
            `;
            db.query(updateQuery, [reviewMessage, selectedValue, result.id], async (err, res) => {
                if (err) {
                    console.error('Error updating review interaction in the database:', err);
                } else {
                    // console.log('Review interaction updated:', res);
                    try {
                        const user = await guild.members.fetch(result.userid_by_opened);
                        const dmChannel = await user.createDM();
                        const originalMessage = await dmChannel.messages.fetch(result.dm_review_message_id);

                        const updatedFieldValue = ticketConfig.TICKET_DM_SETTINGS.Embed.Field.Value
                            .replace('{openedCategory}', ticketResult.category_name)
                            .replace('{closedBy}', interaction.user.tag)
                            .replace('{messageCount}', result.total_messages || 'N/A')
                            .replace('{reviewText}', `${starEmojis} | ${selectedValue}/5\n ${ticketConfig.TICKET_DM_SETTINGS.Embed.Field.Value2} ${reviewMessage}`);

                        const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
                            .spliceFields(0, 1, { name: ticketConfig.TICKET_DM_SETTINGS.Embed.Field.Title, value: updatedFieldValue });

                        // Update the original DM message
                        await originalMessage.edit({ embeds: [updatedEmbed] });
                    } catch (error) {
                        console.error('Error updating the original DM message:', error);
                    }
                }
            });

            const updatedMessage = {
                embeds: interaction.message.embeds,
                components: []
            };
            await interaction.update(updatedMessage);

            await interaction.followUp({ content: ticketConfig.TRANSLATE.ThankYouForReview, ephemeral: true });

        } catch (error) {
            console.error('Error sending review log:', error);
            await interaction.reply({ content: ticketConfig.TRANSLATE.ReviewProcessingError, ephemeral: true });
        }
    }
}




async function reopenTicket(interaction) {
    const channel = interaction.channel;
    // console.log(`Reopening ticket in channel: ${channel.id}`);

    await interaction.deferUpdate();

    const query = `SELECT support_role, userid_by_opened, channel_name, category_id FROM tickets WHERE ticket_channel_id = ?`;
    const db = getDb();
    db.query(query, [channel.id], async (err, results) => {
        if (err) {
            console.error('Error querying the database:', err);
            return interaction.followUp({ content: ticketConfig.TRANSLATE.ErrorPermissionCheck, ephemeral: true });
        }

        // console.log(`Database query results: ${JSON.stringify(results)}`);

        if (results.length === 0) {
            return interaction.followUp({ content: ticketConfig.TRANSLATE.NoPermissionToReopen, ephemeral: true });
        }

        const supportRoles = results[0].support_role.split(',');
        const hasPermission = supportRoles.some(roleId => interaction.member.roles.cache.has(roleId));
        const isTicketCreator = interaction.member.id === results[0].userid_by_opened;

        // console.log(`Support roles: ${supportRoles}`);
        // console.log(`Has permission: ${hasPermission}`);
        // console.log(`Is ticket creator: ${isTicketCreator}`);

        // If the user is not authorized to reopen the ticket
        if (!hasPermission && !(isTicketCreator && ticketConfig.ARCHIVE_SETTINGS.UserCanReopen && ticketConfig.ARCHIVE_SETTINGS.ViewClosedTicket)) {
            return interaction.followUp({ content: ticketConfig.TRANSLATE.NoPermissionToReopen, ephemeral: true });
        }

        await channel.setParent(results[0].category_id, { lockPermissions: false });

        if (ticketConfig.ARCHIVE_SETTINGS.RenameClosedTicket) {
            await channel.setName(results[0].channel_name);
        }

        const userId = results[0].userid_by_opened;
        await channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });

        await Promise.all(supportRoles.map(async (roleId) => {
            await channel.permissionOverwrites.edit(roleId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
        }));

        const embed = new EmbedBuilder()
            .setColor(ticketConfig.EMBED_COLORS.Warning)
            .setTitle(ticketConfig.TRANSLATE.TicketReopenedTitle)
            .setDescription(
                ticketConfig.TRANSLATE.TicketReopenedDesc
                    .replace('{userId}', interaction.user.id)
                    .replace('{userTag}', interaction.user.tag)
            );

        // console.log('Sending message indicating the ticket has been reopened.');
        await channel.send({ embeds: [embed] });

        const messages = await channel.messages.fetch({ limit: 100 });
        const closedMessage = messages.find(msg => msg.embeds[0]?.title === ticketConfig.TRANSLATE.TicketClosedTitle);
        if (closedMessage) {
            await closedMessage.delete();
        }
    });
}




async function transcriptTicket(interaction) {
    const channel = interaction.channel;
    const user = interaction.user; // Get the user who requested the transcript
    const db = getDb();

    // Check if the user is authorized to create the transcript
    const query = `SELECT support_role, userid_by_opened FROM tickets WHERE ticket_channel_id = ?`;
    const result = await new Promise((resolve, reject) => {
        db.query(query, [channel.id], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results[0]);
            }
        });
    });

    const supportRoles = result.support_role.split(',');
    const hasPermission = supportRoles.some(roleId => interaction.member.roles.cache.has(roleId));
    const isTicketCreator = interaction.member.id === result.userid_by_opened;

    // If the user is not authorized to create the transcript
    if (!hasPermission && (!isTicketCreator || !ticketConfig.ARCHIVE_SETTINGS.UserCanClose)) {
        return interaction.reply({ content: ticketConfig.TRANSLATE.NoPermissionToCreateTranscript, ephemeral: true });
    }

    // Generating the transcript as a buffer
    const attachment = await discordTranscripts.createTranscript(channel, {
        returnType: 'buffer',
        fileName: `${channel.name}.html` // Ensure the file name is set to the channel name with .html extension
    });

    // Create the embed message
    const embed = new EmbedBuilder()
        .setColor(ticketConfig.TICKET_DM_SETTINGS.Embed.Color)
        .setTitle(ticketConfig.TICKET_DM_SETTINGS.Embed.Title)
        .setDescription(
            ticketConfig.TICKET_DM_SETTINGS.Embed.Description
                .replace('{userId}', user.id)
                .replace('{userTag}', user.tag)
        );

    // Send the embed message with the transcript attached
    await channel.send({ embeds: [embed], files: [{ attachment, name: `${channel.name}.html` }] });

    // Reply to the interaction
    await interaction.reply({ content: ticketConfig.TRANSLATE.TranscriptGenerated, ephemeral: true });

    // Send log message with transcript to specified channel
    if (ticketConfig.LOGS_SETTINGS && ticketConfig.LOGS_SETTINGS.Enabled) {
        const transcriptEmbed = new EmbedBuilder()
            .setColor(ticketConfig.TICKET_DM_SETTINGS.Embed.Color)
            .setTitle(ticketConfig.TICKET_DM_SETTINGS.Embed.Title)
            .setDescription(ticketConfig.TICKET_DM_SETTINGS.Embed.Description)
            .addFields(
                {
                    name: ticketConfig.TRANSLATE.TranscriptRequestedByTitle,
                    value: ticketConfig.TRANSLATE.TranscriptRequestedBy.replace('{userId}', user.id).replace('{userTag}', user.tag),
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

        const guildId = Object.keys(ticketConfig.LOGS_SETTINGS.transcriptChannelID)[0];
        const logChannelId = ticketConfig.LOGS_SETTINGS.transcriptChannelID[guildId][0];
        const guild = interaction.client.guilds.cache.get(guildId);
        const logChannel = guild.channels.cache.get(logChannelId);

        if (logChannel) {
            await logChannel.send({ embeds: [transcriptEmbed], files: [{ attachment, name: `${channel.name}.html` }] });
        } else {
            console.warn(`Log channel not found in guild ${guildId} with channel ID ${logChannelId}`);
        }
    }
}