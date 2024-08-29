module.exports = {
    name: 'logvoiceStateUpdate',
    async execute(oldState, newState) {

        voiceLog.logVoiceStateUpdate(oldState, newState, client);

    },
};