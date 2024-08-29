// const { Events } = require('discord.js');
// const banCommand = require('../commands/Moderation/ban');
// const timeoutCommand = require('../commands/Moderation/timeout');
// const kickCommand = require('../commands/Moderation/kick');
// const setNicknameCommand = require('../commands/Other/setNickname');
// const ticketPanelCommand = require('../commands/Other/ticketPanel');
// const getRoleCommand = require('../commands/Other/getAuthentication');
// const renameTicketCommand = require('../commands/Other/renameTicket');

// module.exports = {
//     name: Events.InteractionCreate,
//     async execute(interaction) {

//         if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
//             console.log(`Interaction received: ${interaction.customId}`);
//         } else if (interaction.isChatInputCommand()) {
//             console.log(`Executing command: ${interaction.commandName}`);
//         }

//         if (interaction.isChatInputCommand()) {
//             const command = interaction.client.commands.get(interaction.commandName);

//             if (!command) {
//                 console.error(`[ERROR] No command matching ${interaction.commandName} was found.`);
//                 return;
//             }

//             try {
//                 await command.execute(interaction);
//             } catch (error) {
//                 console.error(error);

//                 if (error.code === 'InteractionAlreadyReplied') {
//                     console.log('The interaction has already been replied to.');
//                 } else if (error.code === 10008) {
//                     console.log('Unknown message error detected. The message might have been deleted.');
//                 } else {
//                     try {
//                         await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
//                     } catch (err) {
//                         console.error('Failed to send error message:', err);
//                     }
//                 }
//             }
//         } else if (interaction.isModalSubmit()) {
//             try {
//                 console.log('Modal submit detected');
//                 if (interaction.customId.startsWith('banReasonModal')) {
//                     await banCommand.handleModalSubmit(interaction);
//                 } else if (interaction.customId.startsWith('timeoutReasonModal')) {
//                     await timeoutCommand.handleModalSubmit(interaction);
//                 } else if (interaction.customId.startsWith('kickModal')) {
//                     await kickCommand.handleModalSubmit(interaction);
//                 } else if (interaction.customId.startsWith('setNicknameModal')) {
//                     await setNicknameCommand.handleModalSubmit(interaction);
//                 } else if (interaction.customId.startsWith('ticketReviewModal')) {
//                     await ticketPanelCommand.handleModalSubmit(interaction);
//                 } else if (interaction.customId.startsWith('custom-rename-modal')) {
//                     await renameTicketCommand.handleModalInteraction(interaction);
//                 }
//             } catch (error) {
//                 console.error(error);
//                 try {
//                     await interaction.reply({ content: 'There was an error while processing this modal!', ephemeral: true });
//                 } catch (err) {
//                     console.error('Failed to send modal error message:', err);
//                 }
//             }
//         } else if (interaction.isStringSelectMenu()) {
//             try {
//                 if (interaction.customId === 'ticketSelectMenu') {
//                     await ticketPanelCommand.handleComponentInteraction(interaction);
//                 } else if (interaction.customId.startsWith('ticketRating_')) {
//                     await ticketPanelCommand.handleTicketReview(interaction);
//                 }
//             } catch (error) {
//                 console.error(error);
//                 try {
//                     await interaction.reply({ content: 'There was an error while processing this interaction!', ephemeral: true });
//                 } catch (err) {
//                     console.error('Failed to send select menu error message:', err);
//                 }
//             }
//         } else if (interaction.isButton()) {
//             try {
//                 console.log('Button interaction detected');
//                 if (interaction.customId.startsWith('ticketButton_') ||
//                     interaction.customId === 'closeTicket' ||
//                     interaction.customId === 'collectTicket' ||
//                     interaction.customId === 'reopenTicket' ||
//                     interaction.customId === 'transcriptTicket' ||
//                     interaction.customId === 'deleteTicket' ||
//                     interaction.customId === 'unclaimTicket') {
//                     await ticketPanelCommand.handleComponentInteraction(interaction);
//                 } else if (interaction.customId === 'toggleRole') {
//                     await getRoleCommand.execute(interaction);
//                 }
//             } catch (error) {
//                 console.error(error);
//                 try {
//                     await interaction.reply({ content: 'There was an error while processing this interaction!', ephemeral: true });
//                 } catch (err) {
//                     console.error('Failed to send button error message:', err);
//                 }
//             }
//         }
//     },
// };



const { Events } = require('discord.js');
const banCommand = require('../commands/Moderation/ban');
const timeoutCommand = require('../commands/Moderation/timeout');
const kickCommand = require('../commands/Moderation/kick');
const setNicknameCommand = require('../commands/Other/setNickname');
const ticketPanelCommand = require('../commands/Other/ticketPanel');
const getRoleCommand = require('../commands/Other/getAuthentication');
const renameTicketCommand = require('../commands/Other/renameTicket');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            if (interaction.isChatInputCommand()) {
                await handleChatInputCommand(interaction);
            } else if (interaction.isModalSubmit()) {
                await handleModalSubmit(interaction);
            } else if (interaction.isStringSelectMenu()) {
                await handleSelectMenu(interaction);
            } else if (interaction.isButton()) {
                await handleButton(interaction);
            }
        } catch (error) {
            console.error('Unexpected error during interaction handling:', error);
            if (!interaction.replied) {
                try {
                    await interaction.reply({ content: 'An unexpected error occurred.', ephemeral: true });
                } catch (err) {
                    console.error('Failed to send error message:', err);
                }
            }
        }
    },
};

async function handleChatInputCommand(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`[ERROR] No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);

        if (!interaction.replied) {
            try {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            } catch (err) {
                console.error('Failed to send error message:', err);
            }
        }
    }
}

async function handleModalSubmit(interaction) {
    try {
        if (interaction.customId.startsWith('banReasonModal')) {
            await banCommand.handleModalSubmit(interaction);
        } else if (interaction.customId.startsWith('timeoutReasonModal')) {
            await timeoutCommand.handleModalSubmit(interaction);
        } else if (interaction.customId.startsWith('kickModal')) {
            await kickCommand.handleModalSubmit(interaction);
        } else if (interaction.customId.startsWith('setNicknameModal')) {
            await setNicknameCommand.handleModalSubmit(interaction);
        } else if (interaction.customId.startsWith('ticketReviewModal')) {
            await ticketPanelCommand.handleModalSubmit(interaction);
        } else if (interaction.customId.startsWith('custom-rename-modal')) {
            await renameTicketCommand.handleModalInteraction(interaction);
        } else if (interaction.customId.startsWith('ticketModal_')) {
            await ticketPanelCommand.handleTicketModalSubmit(interaction);
        }
    } catch (error) {
        console.error(error);
        if (!interaction.replied) {
            try {
                await interaction.reply({ content: 'There was an error while processing this modal!', ephemeral: true });
            } catch (err) {
                console.error('Failed to send modal error message:', err);
            }
        }
    }
}

async function handleSelectMenu(interaction) {
    try {
        if (interaction.customId === 'ticketSelectMenu') {
            await ticketPanelCommand.handleComponentInteraction(interaction);
        } else if (interaction.customId.startsWith('ticketRating_')) {
            await ticketPanelCommand.handleTicketReview(interaction);
        }
    } catch (error) {
        console.error(error);
        if (!interaction.replied) {
            try {
                await interaction.reply({ content: 'There was an error while processing this interaction!', ephemeral: true });
            } catch (err) {
                console.error('Failed to send select menu error message:', err);
            }
        }
    }
}

async function handleButton(interaction) {
    try {
        if (interaction.customId.startsWith('ticketButton_') ||
            interaction.customId === 'closeTicket' ||
            interaction.customId === 'collectTicket' ||
            interaction.customId === 'reopenTicket' ||
            interaction.customId === 'transcriptTicket' ||
            interaction.customId === 'deleteTicket' ||
            interaction.customId === 'unclaimTicket') {
            await ticketPanelCommand.handleComponentInteraction(interaction);
        } else if (interaction.customId === 'toggleRole') {
            await getRoleCommand.execute(interaction);
        }
    } catch (error) {
        console.error(error);
        if (!interaction.replied) {
            try {
                await interaction.reply({ content: 'There was an error while processing this interaction!', ephemeral: true });
            } catch (err) {
                console.error('Failed to send button error message:', err);
            }
        }
    }
}
