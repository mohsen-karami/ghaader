import { execFile } from 'child_process';
import fs from 'fs';
import { createWriteStream } from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';

import { DEFAULT_VIDEO_QUALITY, DOWNLOAD_TIMEOUT_MS, YOUTUBE_PATTERNS } from '../config/constants.js';
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
		if (this.isYoutubeUrl(url)) {
			return this.downloadYoutube(url, issueTitle);
		}
		return this.downloadFile(url);
	}

	/**
	 * Downloads a regular file via HTTP/HTTPS.
	 * @param {string} url - The file URL
	 * @returns {Promise<object>} Result with filePath and filename
	 */
	async downloadFile(url) {
		const filename = this.extractFilename(url);
		const filePath = path.join(this.tmpDir, filename);

		const client = url.startsWith('https') ? https : http;

		await new Promise((resolve, reject) => {
			client.get(url, (response) => {
				if (response.statusCode >= 300 && response.statusCode < 400) {
					const redirectUrl = response.headers.location;
					this.downloadFile(redirectUrl)
						.then(resolve)
						.catch(reject);
					return;
				}
				if (response.statusCode !== 200) {
					reject(new Error(`HTTP ${response.statusCode}`));
					return;
				}
				const writeStream = createWriteStream(filePath);
				pipeline(response, writeStream)
					.then(resolve)
					.catch(reject);
			}).on('error', reject);
		});

		return { filename, filePath };
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
			'--output', outputTemplate,
			'--no-playlist',
			'--print', 'after_move:filepath',
			url,
		];

		logger.info(`Downloading YouTube video: ${url} (quality: ${quality}p)`);

		const { stdout } = await execFileAsync('yt-dlp', args, {
			timeout: DOWNLOAD_TIMEOUT_MS,
		});

		const filePath = stdout.trim().split('\n').pop();
		const filename = path.basename(filePath);

		return { filename, filePath };
	}

	/**
	 * Extracts a meaningful filename from a URL.
	 * @param {string} url - The source URL
	 * @returns {string} Extracted or generated filename
	 */
	extractFilename(url) {
		const urlPath = new URL(url).pathname;
		const basename = path.basename(urlPath);

		if (basename && basename !== '/' && basename.includes('.')) {
			return decodeURIComponent(basename);
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
			try {
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
			} catch (err) {
				logger.warn(`Failed to cleanup file: ${filePath} - ${err.message}`);
			}
		}
	}
}

export default DownloadService;
