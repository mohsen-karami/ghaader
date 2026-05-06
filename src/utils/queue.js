import logger from './logger.js';

/**
 * Simple in-memory serial queue that processes tasks one at a time.
 */
class ProcessingQueue {
	/**
	 * Creates a ProcessingQueue instance.
	 */
	constructor() {
		this.queue = [];
		this.processing = false;
	}

	/**
	 * Adds a task to the queue for serial execution.
	 * @param {Function} task - Async function to execute
	 */
	enqueue(task) {
		this.queue.push(task);
		logger.info(`Task queued (queue size: ${this.queue.length})`);
		this.processNext();
	}

	/**
	 * Processes the next task if not already processing.
	 */
	async processNext() {
		if (this.processing || this.queue.length === 0) {
			return;
		}

		this.processing = true;
		const task = this.queue.shift();

		try {
			await task();
		} catch (err) {
			logger.error(`Queue task failed: ${err.message}`);
		} finally {
			this.processing = false;
			this.processNext();
		}
	}
}

const processingQueue = new ProcessingQueue();

export default processingQueue;
