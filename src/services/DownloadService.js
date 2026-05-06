import { execFile } from 'child_process';
import fs from 'fs';
import { createWriteStream } from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';

import { DEFAULT_VIDEO_QUALITY, DOWNLOAD_TIMEOUT_MS, MAX_REDIRECTS, YOUTUBE_PATTERNS } from '../config/constants.js';
import environment from '../config/environment.js';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

/**
 * Handles downloading files from URLs and YouTube videos.
 */
class DownloadService {
	/**
	 * Creates a DownloadService instance.
	 * @param {string} tmpDir - Temporary directory for downloads
	 */
	constructor(tmpDir) {
		this.tmpDir = tmpDir;
		fs.mkdirSync(this.tmpDir, { recursive: true });
	}

	/**
	 * Extracts all URLs from an issue body text.
	 * @param {string} body - The issue body content
	 * @returns {string[]} Array of extracted URLs
	 */
	extractUrls(body) {
		if (!body) {
			return [];
		}
		const urlRegex = /https?:\/\/[^\s<>)"'\]]+/g;
		const matches = body.match(urlRegex) || [];
		return [...new Set(matches)];
	}

	/**
	 * Parses video quality from the issue title.
	 * @param {string} title - The issue title
	 * @returns {string} Quality string for yt-dlp
	 */
	parseQuality(title) {
		if (!title) {
			return DEFAULT_VIDEO_QUALITY;
		}
		const match = title.match(/(\d{3,4})p/i);
		if (match) {
			return match[1];
		}
		if (/4k/i.test(title)) {
			return '2160';
		}
		return DEFAULT_VIDEO_QUALITY;
	}

	/**
	 * Checks if a URL is a YouTube video link.
	 * @param {string} url - The URL to check
	 * @returns {boolean} True if the URL is a YouTube link
	 */
	isYoutubeUrl(url) {
		return YOUTUBE_PATTERNS.some((pattern) => url.includes(pattern));
	}

	/**
	 * Downloads a file from a URL.
	 * @param {string} url - The URL to download
	 * @param {string} issueTitle - The issue title for quality parsing
	 * @returns {Promise<object>} Result with filePath and filename
	 */
	async download(url, issueTitle) {
		try {
			if (this.isYoutubeUrl(url)) {
				return await this.downloadYoutube(url, issueTitle);
			}
			return await this.downloadFile(url);
		} catch (err) {
			throw new Error(`Failed to download "${url}": ${err.message}`);
		}
	}

	/**
	 * Downloads a regular file via HTTP/HTTPS with redirect support.
	 * @param {string} url - The file URL
	 * @param {number} redirectCount - Current redirect depth
	 * @returns {Promise<object>} Result with filePath and filename
	 */
	async downloadFile(url, redirectCount = 0) {
		if (redirectCount > MAX_REDIRECTS) {
			throw new Error('Too many redirects');
		}

		const filename = this.extractFilename(url);
		const filePath = path.join(this.tmpDir, filename);
		const client = url.startsWith('https') ? https : http;

		try {
			const redirect = await this.executeDownload({ client, filePath, url });
			if (redirect) {
				return this.downloadFile(redirect, redirectCount + 1);
			}
		} catch (err) {
			this.cleanupFile(filePath);
			throw err;
		}

		return { filename, filePath };
	}

	/**
	 * Executes the HTTP download request.
	 * @param {object} options - Download options
	 * @param {object} options.client - HTTP/HTTPS module
	 * @param {string} options.filePath - Destination file path
	 * @param {string} options.url - URL to download
	 * @returns {Promise<string|null>} Redirect URL or null if downloaded
	 */
	executeDownload({ client, filePath, url }) {
		return new Promise((resolve, reject) => {
			client.get(url, (response) => {
				if (response.statusCode >= 300 && response.statusCode < 400) {
					resolve(response.headers.location);
					return;
				}
				if (response.statusCode !== 200) {
					reject(new Error(`HTTP ${response.statusCode}`));
					return;
				}
				const writeStream = createWriteStream(filePath);
				pipeline(response, writeStream)
					.then(() => resolve(null))
					.catch(reject);
			}).on('error', reject);
		});
	}

	/**
	 * Downloads a YouTube video using yt-dlp.
	 * @param {string} url - The YouTube URL
	 * @param {string} issueTitle - Issue title for quality parsing
	 * @returns {Promise<object>} Result with filePath and filename
	 */
	async downloadYoutube(url, issueTitle) {
		const quality = this.parseQuality(issueTitle);
		const outputTemplate = path.join(this.tmpDir, '%(title)s.%(ext)s');

		const args = [
			'--format', `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best`,
			'--js-runtimes', 'node',
			'--no-playlist',
			'--output', outputTemplate,
			'--print', 'after_move:filepath',
			'--restrict-filenames',
		];

		if (environment.youtubeCookiesPath) {
			args.push('--cookies', environment.youtubeCookiesPath);
		}

		args.push(url);
		logger.info(`Downloading YouTube video: ${url} (quality: ${quality}p)`);

		try {
			const { stdout } = await execFileAsync('yt-dlp', args, { timeout: DOWNLOAD_TIMEOUT_MS });
			const filePath = stdout.trim().split('\n').pop();
			return { filename: path.basename(filePath), filePath };
		} catch (err) {
			throw this.handleYtdlpError(err);
		}
	}

	/**
	 * Translates yt-dlp errors into user-friendly messages.
	 * @param {Error} err - The original yt-dlp error
	 * @returns {Error} A user-friendly error
	 */
	handleYtdlpError(err) {
		if (err.code === 'ENOENT') {
			return new Error('yt-dlp is not installed on this system');
		}
		const output = err.stderr || err.message || '';

		if (output.includes('Sign in to confirm')) {
			return new Error(
				'YouTube requires authentication. The server cookies have expired or are not configured. ' +
				'Please ask the server admin to refresh the YouTube cookies file.'
			);
		}
		if (output.includes('Requested format is not available')) {
			return new Error(
				'The requested video quality is not available. ' +
				'This may be caused by a missing JavaScript runtime on the server. ' +
				'Please ask the server admin to install Node.js and ensure it is in the system PATH.'
			);
		}
		if (output.includes('No supported JavaScript runtime') || output.includes('Ignoring unsupported')) {
			return new Error(
				'YouTube requires a JavaScript runtime but none was found or recognized. ' +
				'Please ensure Node.js is installed and accessible in the system PATH as "node".'
			);
		}
		if (output.includes('Video unavailable')) {
			return new Error('This video is unavailable (private, deleted, or region-restricted).');
		}
		return new Error(`YouTube download failed: ${this.extractYtdlpError(output)}`);
	}

	/**
	 * Extracts the meaningful ERROR line from yt-dlp output.
	 * @param {string} output - Raw yt-dlp stderr output
	 * @returns {string} Clean error message
	 */
	extractYtdlpError(output) {
		const errorLine = output.split('\n').find((line) => line.includes('ERROR:'));
		if (errorLine) {
			return errorLine.replace(/^ERROR:\s*(\[youtube\]\s*\w+:\s*)?/, '').trim();
		}
		return 'An unknown error occurred';
	}

	/**
	 * Extracts a meaningful filename from a URL.
	 * @param {string} url - The source URL
	 * @returns {string} Extracted or generated filename
	 */
	extractFilename(url) {
		try {
			const urlPath = new URL(url).pathname;
			const basename = path.basename(urlPath);

			if (basename && basename !== '/' && basename.includes('.')) {
				return decodeURIComponent(basename);
			}
		} catch {
			// Malformed URL — fall through to default
		}

		const timestamp = Date.now();
		return `download-${timestamp}`;
	}

	/**
	 * Cleans up downloaded files from the temp directory.
	 * @param {string[]} filePaths - Array of file paths to remove
	 */
	cleanup(filePaths) {
		for (const filePath of filePaths) {
			this.cleanupFile(filePath);
		}
	}

	/**
	 * Removes a single file if it exists.
	 * @param {string} filePath - Path to the file to remove
	 */
	cleanupFile(filePath) {
		try {
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		} catch (err) {
			logger.warn(`Failed to cleanup file: ${filePath} - ${err.message}`);
		}
	}
}

export default DownloadService;
