import fs from 'fs';

import { Octokit } from '@octokit/rest';

import { ISSUE_LABELS, MAX_ATTACHMENTS_PER_COMMENT } from '../config/constants.js';
import environment from '../config/environment.js';
import logger from '../utils/logger.js';

/**
 * Handles GitHub API interactions for issues.
 */
class GitHubService {
	/**
	 * Creates a GitHubService instance.
	 */
	constructor() {
		this.octokit = new Octokit({ auth: environment.githubToken });
	}

	/**
	 * Posts file attachments as comments on an issue.
	 * @param {object} options - Comment options
	 * @param {string} options.owner - Repository owner
	 * @param {string} options.repo - Repository name
	 * @param {number} options.issueNumber - Issue number
	 * @param {object[]} options.files - Array of file objects
	 * @returns {Promise<void>} Resolves when all comments are posted
	 */
	async postFileComments({ files, issueNumber, owner, repo }) {
		const batches = this.batchFiles(files);

		for (let index = 0; index < batches.length; index++) {
			const batch = batches[index];
			const description = this.buildCommentBody(batch, index, batches.length);
			await this.postCommentWithFiles({ description, files: batch, issueNumber, owner, repo });
		}
	}

	/**
	 * Posts a single comment with file attachments.
	 * @param {object} options - Post options
	 * @param {string} options.description - Comment body text
	 * @param {object[]} options.files - Files to attach
	 * @param {number} options.issueNumber - Issue number
	 * @param {string} options.owner - Repository owner
	 * @param {string} options.repo - Repository name
	 * @returns {Promise<void>} Resolves when comment is posted
	 */
	async postCommentWithFiles({ description, files, issueNumber, owner, repo }) {
		try {
			const uploadedUrls = [];

			for (const file of files) {
				const url = await this.uploadAsset({ file, issueNumber, owner, repo });
				uploadedUrls.push(`[${file.filename}](${url})`);
			}

			const body = `${description}\n\n${uploadedUrls.join('\n')}`;

			await this.octokit.issues.createComment({
				body,
				'issue_number': issueNumber,
				owner,
				repo,
			});

			logger.info(`Posted comment with ${files.length} files on issue #${issueNumber}`);
		} catch (err) {
			throw new Error(`Failed to post comment on issue #${issueNumber}: ${err.message}`);
		}
	}

	/**
	 * Uploads a file to the repository and returns its download URL.
	 * @param {object} options - Upload options
	 * @param {object} options.file - File object with filePath and filename
	 * @param {number} options.issueNumber - Issue number for context
	 * @param {string} options.owner - Repository owner
	 * @param {string} options.repo - Repository name
	 * @returns {Promise<string>} Download URL for the uploaded file
	 */
	async uploadAsset({ file, issueNumber, owner, repo }) {
		const content = fs.readFileSync(file.filePath);
		const base64Content = content.toString('base64');
		const uploadPath = `downloads/issue-${issueNumber}/${file.filename}`;

		const response = await this.octokit.repos.createOrUpdateFileContents({
			content: base64Content,
			message: `Upload ${file.filename} for issue #${issueNumber}`,
			owner,
			path: uploadPath,
			repo,
		});

		return response.data.content.download_url;
	}

	/**
	 * Posts an error comment listing failed downloads.
	 * @param {object} options - Error comment options
	 * @param {string} options.owner - Repository owner
	 * @param {string} options.repo - Repository name
	 * @param {number} options.issueNumber - Issue number
	 * @param {object[]} options.failures - Array of failure objects
	 * @returns {Promise<void>} Resolves when comment is posted
	 */
	async postErrorComment({ failures, issueNumber, owner, repo }) {
		const lines = failures.map((fail) => `- ${fail.url}: ${fail.error}`);
		const body = `**The following URLs could not be downloaded:**\n\n${lines.join('\n')}`;

		try {
			await this.octokit.issues.createComment({
				body,
				'issue_number': issueNumber,
				owner,
				repo,
			});
		} catch (err) {
			logger.error(`Failed to post error comment on issue #${issueNumber}: ${err.message}`);
		}
	}

	/**
	 * Applies a label to an issue based on processing outcome.
	 * @param {object} options - Label options
	 * @param {string} options.owner - Repository owner
	 * @param {string} options.repo - Repository name
	 * @param {number} options.issueNumber - Issue number
	 * @param {string} options.outcome - One of 'completed', 'failed', 'partial'
	 * @returns {Promise<void>} Resolves when label is applied
	 */
	async applyLabel({ issueNumber, outcome, owner, repo }) {
		const label = ISSUE_LABELS[outcome];

		try {
			await this.ensureLabelExists({ label, owner, repo });
			await this.octokit.issues.addLabels({
				'issue_number': issueNumber,
				labels: [label],
				owner,
				repo,
			});
		} catch (err) {
			logger.error(`Failed to apply label "${label}" to issue #${issueNumber}: ${err.message}`);
		}
	}

	/**
	 * Closes an issue.
	 * @param {object} options - Close options
	 * @param {string} options.owner - Repository owner
	 * @param {string} options.repo - Repository name
	 * @param {number} options.issueNumber - Issue number
	 * @returns {Promise<void>} Resolves when issue is closed
	 */
	async closeIssue({ issueNumber, owner, repo }) {
		try {
			await this.octokit.issues.update({
				'issue_number': issueNumber,
				owner,
				repo,
				state: 'closed',
			});
			logger.info(`Closed issue #${issueNumber}`);
		} catch (err) {
			logger.error(`Failed to close issue #${issueNumber}: ${err.message}`);
		}
	}

	/**
	 * Ensures a label exists in the repository.
	 * @param {object} options - Label options
	 * @param {string} options.label - Label name
	 * @param {string} options.owner - Repository owner
	 * @param {string} options.repo - Repository name
	 * @returns {Promise<void>} Resolves when label exists
	 */
	async ensureLabelExists({ label, owner, repo }) {
		try {
			await this.octokit.issues.getLabel({ name: label, owner, repo });
		} catch {
			await this.octokit.issues.createLabel({
				color: this.getLabelColor(label),
				name: label,
				owner,
				repo,
			});
		}
	}

	/**
	 * Returns the color for a given label name.
	 * @param {string} label - The label name
	 * @returns {string} Hex color code without hash
	 */
	getLabelColor(label) {
		const colors = {
			completed: '0e8a16',
			failed: 'e11d48',
			partial: 'f59e0b',
		};
		return colors[label] || '6b7280';
	}

	/**
	 * Splits files into batches respecting attachment limit.
	 * @param {object[]} files - Array of file objects
	 * @returns {object[][]} Array of file batches
	 */
	batchFiles(files) {
		const batches = [];
		for (let index = 0; index < files.length; index += MAX_ATTACHMENTS_PER_COMMENT) {
			batches.push(files.slice(index, index + MAX_ATTACHMENTS_PER_COMMENT));
		}
		return batches;
	}

	/**
	 * Builds descriptive comment body for a batch of files.
	 * @param {object[]} batch - Files in this batch
	 * @param {number} batchIndex - Current batch index
	 * @param {number} totalBatches - Total number of batches
	 * @returns {string} Formatted comment body
	 */
	buildCommentBody(batch, batchIndex, totalBatches) {
		const fileNames = batch.map((file) => `\`${file.filename}\``).join(', ');

		if (totalBatches === 1) {
			return `**Downloaded files:** ${fileNames}`;
		}

		const partLabel = `(Part ${batchIndex + 1}/${totalBatches})`;
		return `**Downloaded files ${partLabel}:** ${fileNames}`;
	}
}

export default GitHubService;
