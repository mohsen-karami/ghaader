import logger from '../utils/logger.js';

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

		await this.processIssue({
			body: issue.body,
			issueNumber: issue.number,
			owner: repo.owner.login,
			repo: repo.name,
			title: issue.title,
		});
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

		const results = await this.downloadAll(urls, title);
		await this.postResults({ issueNumber, owner, repo, results });
	}

	/**
	 * Downloads all URLs and collects results.
	 * @param {string[]} urls - URLs to download
	 * @param {string} title - Issue title for quality parsing
	 * @returns {Promise<object>} Results with successes and failures
	 */
	async downloadAll(urls, title) {
		const failures = [];
		const successes = [];

		for (const url of urls) {
			try {
				const result = await this.downloadService.download(url, title);
				const files = await this.fileService.process(result.filePath, result.filename);
				successes.push({ files, url });
			} catch (err) {
				logger.error(`Download failed for ${url}: ${err.message}`);
				failures.push({ error: err.message, url });
			}
		}

		return { failures, successes };
	}

	/**
	 * Posts download results as issue comments and closes issue.
	 * @param {object} options - Result posting options
	 * @param {number} options.issueNumber - Issue number
	 * @param {string} options.owner - Repository owner
	 * @param {string} options.repo - Repository name
	 * @param {object} options.results - Download results
	 * @returns {Promise<void>} Resolves when posting is complete
	 */
	async postResults({ issueNumber, owner, repo, results }) {
		const { failures, successes } = results;
		const allFiles = successes.flatMap((success) => success.files);
		const filePaths = allFiles.map((file) => file.filePath);

		try {
			if (allFiles.length > 0) {
				await this.gitHubService.postFileComments({
					files: allFiles,
					issueNumber,
					owner,
					repo,
				});
			}

			if (failures.length > 0) {
				await this.gitHubService.postErrorComment({ failures, issueNumber, owner, repo });
			}

			const outcome = this.determineOutcome(successes, failures);
			await this.gitHubService.applyLabel({ issueNumber, outcome, owner, repo });
			await this.gitHubService.closeIssue({ issueNumber, owner, repo });
		} finally {
			this.downloadService.cleanup(filePaths);
		}
	}

	/**
	 * Determines the processing outcome label.
	 * @param {object[]} successes - Successful downloads
	 * @param {object[]} failures - Failed downloads
	 * @returns {string} Outcome label key
	 */
	determineOutcome(successes, failures) {
		if (failures.length === 0) {
			return 'completed';
		}
		if (successes.length === 0) {
			return 'failed';
		}
		return 'partial';
	}
}

export default WebhookController;
