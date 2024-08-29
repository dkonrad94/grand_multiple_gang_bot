const EventEmitter = require('events');

class EventQueue extends EventEmitter {
    constructor() {
        super();
        this.queues = new Map();
        this.processing = new Set();
    }

    async enqueue(messageId, fn, type) {
        if (!this.queues.has(messageId)) {
            this.queues.set(messageId, []);
        }

        const queue = this.queues.get(messageId);
        if (type === 'update') {
            const updateEventIndex = queue.findIndex(event => event.type === 'update');
            if (updateEventIndex !== -1) {
                queue.splice(updateEventIndex, 1);
            }
        }

        queue.push({ fn, type });

        if (!this.processing.has(messageId)) {
            this.processing.add(messageId);
            await this.runQueue(messageId);
        }
    }

    async runQueue(messageId) {
        const queue = this.queues.get(messageId);

        while (queue.length > 0) {
            const { fn, type } = queue[0];

            try {
                if (type !== 'create' && queue.some(event => event.type === 'create')) {
                    continue;
                }

                await fn();
            } catch (err) {
                console.error('Error processing queue:', err);
            }

            queue.shift();
        }

        this.processing.delete(messageId);
        this.queues.delete(messageId);
    }
    isInQueue(messageId, type) {
        const queue = this.queues.get(messageId);
        return queue && queue.some(event => event.type === type);
    }
}

module.exports = new EventQueue();
