import fs from 'fs';
import path from 'path';

import archiver from 'archiver';

import { BYTES_PER_MB } from '../config/constants.js';
import environment from '../config/environment.js';
import logger from '../utils/logger.js';

/**
 * Handles file size checks and multi-part zip splitting.
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
	 * @returns {object} Plan with partCount and totalSize
	 */
	getSplitPlan(filePath, filename) {
		const totalSize = fs.statSync(filePath).size;
		const partCount = Math.ceil(totalSize / this.maxSizeBytes);

		logger.info(`File exceeds ${environment.maxFileSizeMb}MB, will split into ${partCount} parts: ${filename}`);
		return { filename, filePath, partCount, totalSize };
	}

	/**
	 * Creates a single zip part from a split plan.
	 * @param {object} plan - The split plan from getSplitPlan
	 * @param {number} index - Part index to create
	 * @returns {Promise<object>} File object with path and name
	 */
	async createPart(plan, index) {
		const partNum = String(index + 1).padStart(3, '0');
		const partName = `${plan.filename}.zip.${partNum}`;
		const partPath = path.join(this.tmpDir, partName);

		const start = index * this.maxSizeBytes;
		const end = Math.min(start + this.maxSizeBytes, plan.totalSize) - 1;

		await this.createZipPart({
			end,
			filename: plan.filename,
			outputPath: partPath,
			partIndex: index,
			sourcePath: plan.filePath,
			start,
		});

		return { filename: partName, filePath: partPath };
	}

	/**
	 * Creates a single zip archive from a file stream range.
	 * @param {object} options - Zip part options
	 * @param {number} options.end - End byte position (inclusive)
	 * @param {string} options.filename - Name for the file inside archive
	 * @param {string} options.outputPath - Path for the output zip file
	 * @param {number} options.partIndex - Part index for naming
	 * @param {string} options.sourcePath - Source file to read from
	 * @param {number} options.start - Start byte position
	 * @returns {Promise<void>} Resolves when archive is written
	 */
	createZipPart({ end, filename, outputPath, partIndex, sourcePath, start }) {
		return new Promise((resolve, reject) => {
			const output = fs.createWriteStream(outputPath);
			const archive = archiver('zip', { zlib: { level: 1 } });
			const readStream = fs.createReadStream(sourcePath, { end, start });

			output.on('close', resolve);
			output.on('error', reject);
			archive.on('error', reject);

			archive.pipe(output);

			const entryName = `${filename}.part${String(partIndex + 1).padStart(3, '0')}`;
			archive.append(readStream, { name: entryName });
			archive.finalize();
		});
	}
}

export default FileService;
