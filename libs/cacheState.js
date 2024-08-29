const cacheState = {
    messageCache: global.client.messagesCache,
    setMessageCached: function (messageId, messageData) {
        this.messageCache.set(messageId, messageData);
    },
    getMessageCache: function (messageId) {
        return this.messageCache.get(messageId);
    },
    isMessageCached: function (messageId) {
        return this.messageCache.has(messageId);
    },
    waitForMessageCached: function (messageId) {
        return new Promise((resolve) => {
            const checkCache = () => {
                if (this.isMessageCached(messageId)) {
                    resolve(this.getMessageCache(messageId));
                } else {
                    setTimeout(checkCache, 100); // Check every 100ms
                }
            };
            checkCache();
        });
    }
};

module.exports = cacheState;
