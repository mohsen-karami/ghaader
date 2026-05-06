import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import { BYTES_PER_MB } from '../config/constants.js';
import environment from '../config/environment.js';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

/**
 * Handles file size checks and multi-part archive splitting.
 */
class FileService {
	/**
	 * Creates a FileService instance.
	 * @param {string} tmpDir - Temporary directory for split output
	 */
	constructor(tmpDir) {
		this.maxSizeBytes = environment.maxFileSizeMb * BYTES_PER_MB;
		this.tmpDir = tmpDir;
	}

	/**
	 * Checks if a file needs to be split.
	 * @param {string} filePath - Path to the file
	 * @returns {boolean} True if file exceeds max size
	 */
	needsSplit(filePath) {
		const stats = fs.statSync(filePath);
		return stats.size > this.maxSizeBytes;
	}

	/**
	 * Returns split plan metadata without creating any files.
	 * @param {string} filePath - Path to the file
	 * @param {string} filename - Original filename
	 * @returns {Promise<object>} Plan with parts array
	 */
	async getSplitPlan(filePath, filename) {
		logger.info(`File exceeds ${environment.maxFileSizeMb}MB, splitting: ${filename}`);

		const volumeSize = `${environment.maxFileSizeMb}m`;
		const archivePath = path.join(this.tmpDir, `${filename}.7z`);

		await execFileAsync('7z', [
			'a', archivePath,
			`-v${volumeSize}`,
			'-mx=1',
			filePath,
		]);

		const parts = this.findSplitParts(archivePath);
		logger.info(`Split into ${parts.length} parts: ${filename}`);

		return { filename, parts };
	}

	/**
	 * Finds all volume parts created by 7z.
	 * @param {string} basePath - Base archive path
	 * @returns {object[]} Array of file objects with path and name
	 */
	findSplitParts(basePath) {
		const dir = path.dirname(basePath);
		const baseName = path.basename(basePath);
		const parts = [];

		const files = fs.readdirSync(dir)
			.filter((file) => file.startsWith(baseName))
			.sort();

		for (const file of files) {
			parts.push({
				filename: file,
				filePath: path.join(dir, file),
			});
		}

		return parts;
	}
}

export default FileService;
