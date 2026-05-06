import logger from '../utils/logger.js';
import processingQueue from '../utils/queue.js';

/**
 * Handles incoming GitHub webhook requests.
 */
class WebhookController {
	/**
	 * Creates a WebhookController instance.
	 * @param {object} options - Controller dependencies
	 * @param {object} options.downloadService - DownloadService instance
	 * @param {object} options.fileService - FileService instance
	 * @param {object} options.gitHubService - GitHubService instance
	 */
	constructor({ downloadService, fileService, gitHubService }) {
		this.downloadService = downloadService;
		this.fileService = fileService;
		this.gitHubService = gitHubService;
	}

	/**
	 * Handles a webhook event from GitHub.
	 * @param {object} req - Express request object
	 * @param {object} res - Express response object
	 * @returns {Promise<void>} Resolves when processing is complete
	 */
	async handle(req, res) {
		const event = req.headers['x-github-event'];

		if (event !== 'issues') {
			res.status(200).json({ message: 'Event ignored' });
			return;
		}

		const { action } = req.body;
		if (action !== 'opened') {
			res.status(200).json({ message: 'Action ignored' });
			return;
		}

		res.status(202).json({ message: 'Processing started' });

		const issue = req.body.issue;
		const repo = req.body.repository;

		processingQueue.enqueue(() => this.processIssue({
			body: issue.body,
			issueNumber: issue.number,
			owner: repo.owner.login,
			repo: repo.name,
			title: issue.title,
		}));
	}

	/**
	 * Processes an issue by downloading files and posting results.
	 * @param {object} options - Issue processing options
	 * @param {string} options.body - Issue body text
	 * @param {number} options.issueNumber - Issue number
	 * @param {string} options.owner - Repository owner
	 * @param {string} options.repo - Repository name
	 * @param {string} options.title - Issue title
	 * @returns {Promise<void>} Resolves when processing is complete
	 */
	async processIssue({ body, issueNumber, owner, repo, title }) {
		logger.info(`Processing issue #${issueNumber}: ${title}`);

		const urls = this.downloadService.extractUrls(body);
		if (urls.length === 0) {
			logger.info(`No URLs found in issue #${issueNumber}`);
			return;
		}

		const failures = [];
		let successCount = 0;

		for (const url of urls) {
			try {
				await this.processUrl({ issueNumber, owner, repo, title, url });
				successCount++;
			} catch (err) {
				logger.error(`Download failed for ${url}: ${err.message}`);
				failures.push({ error: err.message, url });
			}
		}

		await this.finalizeIssue({ failures, issueNumber, owner, repo, successCount });
	}

	/**
	 * Downloads, splits, and uploads a single URL.
	 * @param {object} options - URL processing options
	 * @param {number} options.issueNumber - Issue number
	 * @param {string} options.owner - Repository owner
	 * @param {string} options.repo - Repository name
	 * @param {string} options.title - Issue title
	 * @param {string} options.url - URL to process
	 * @returns {Promise<void>} Resolves when upload is complete
	 */
	async processUrl({ issueNumber, owner, repo, title, url }) {
		const result = await this.downloadService.download(url, title);

		try {
			if (!this.fileService.needsSplit(result.filePath)) {
				await this.uploadSingleFile({ file: result, issueNumber, owner, repo });
			} else {
				await this.uploadSplitFile({ issueNumber, owner, repo, result });
			}
		} finally {
			this.downloadService.cleanupFile(result.filePath);
		}
	}

	/**
	 * Uploads a single file that does not need splitting.
	 * @param {object} options - Upload options
	 * @param {object} options.file - File object with filePath and filename
	 * @param {number} options.issueNumber - Issue number
	 * @param {string} options.owner - Repository owner
	 * @param {string} options.repo - Repository name
	 * @returns {Promise<void>} Resolves when upload is complete
	 */
	async uploadSingleFile({ file, issueNumber, owner, repo }) {
		await this.gitHubService.postFileComments({
			files: [file],
			issueNumber,
			owner,
			repo,
		});
	}

	/**
	 * Splits a file and uploads parts one at a time to save memory.
	 * @param {object} options - Split upload options
	 * @param {number} options.issueNumber - Issue number
	 * @param {string} options.owner - Repository owner
	 * @param {string} options.repo - Repository name
	 * @param {object} options.result - Download result with filePath/filename
	 * @returns {Promise<void>} Resolves when all parts are uploaded
	 */
	async uploadSplitFile({ issueNumber, owner, repo, result }) {
		const plan = await this.fileService.getSplitPlan(result.filePath, result.filename);

		for (const part of plan.parts) {
			try {
				await this.gitHubService.postFileComments({
					files: [part],
					issueNumber,
					owner,
					repo,
				});
			} finally {
				this.downloadService.cleanupFile(part.filePath);
			}
		}
	}

	/**
	 * Posts errors, applies label, and closes the issue.
	 * @param {object} options - Finalization options
	 * @param {object[]} options.failures - Failed download list
	 * @param {number} options.issueNumber - Issue number
	 * @param {string} options.owner - Repository owner
	 * @param {string} options.repo - Repository name
	 * @param {number} options.successCount - Number of successful downloads
	 * @returns {Promise<void>} Resolves when issue is finalized
	 */
	async finalizeIssue({ failures, issueNumber, owner, repo, successCount }) {
		if (failures.length > 0) {
			await this.gitHubService.postErrorComment({ failures, issueNumber, owner, repo });
		}

		const outcome = this.determineOutcome(successCount, failures.length);
		await this.gitHubService.applyLabel({ issueNumber, outcome, owner, repo });
		await this.gitHubService.closeIssue({ issueNumber, owner, repo });
	}

	/**
	 * Determines the processing outcome label.
	 * @param {number} successCount - Number of successful downloads
	 * @param {number} failureCount - Number of failed downloads
	 * @returns {string} Outcome label key
	 */
	determineOutcome(successCount, failureCount) {
		if (failureCount === 0) {
			return 'completed';
		}
		if (successCount === 0) {
			return 'failed';
		}
		return 'partial';
	}
}

export default WebhookController;
