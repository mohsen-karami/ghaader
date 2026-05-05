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
	 * Processes a file: returns as-is or splits into parts.
	 * @param {string} filePath - Path to the downloaded file
	 * @param {string} filename - Original filename
	 * @returns {Promise<object[]>} Array of file objects with path and name
	 */
	async process(filePath, filename) {
		try {
			if (!this.needsSplit(filePath)) {
				return [{ filename, filePath }];
			}

			logger.info(`File exceeds ${environment.maxFileSizeMb}MB, splitting: ${filename}`);
			return await this.splitIntoZipParts(filePath, filename);
		} catch (err) {
			throw new Error(`Failed to process file "${filename}": ${err.message}`);
		}
	}

	/**
	 * Splits a file into multi-part zip archives.
	 * @param {string} filePath - Path to the source file
	 * @param {string} filename - Original filename for the archive
	 * @returns {Promise<object[]>} Array of part file objects
	 */
	async splitIntoZipParts(filePath, filename) {
		const fileBuffer = fs.readFileSync(filePath);
		const totalSize = fileBuffer.length;
		const partCount = Math.ceil(totalSize / this.maxSizeBytes);
		const parts = [];

		for (let index = 0; index < partCount; index++) {
			const partNum = String(index + 1).padStart(3, '0');
			const partName = `${filename}.zip.${partNum}`;
			const partPath = path.join(this.tmpDir, partName);

			const start = index * this.maxSizeBytes;
			const end = Math.min(start + this.maxSizeBytes, totalSize);
			const chunk = fileBuffer.subarray(start, end);

			await this.createZipPart({ data: chunk, filename, outputPath: partPath, partIndex: index });
			parts.push({ filename: partName, filePath: partPath });
		}

		logger.info(`Split into ${partCount} parts: ${filename}`);
		return parts;
	}

	/**
	 * Creates a single zip archive containing a chunk of data.
	 * @param {object} options - Zip part options
	 * @param {string} options.outputPath - Path for the output zip file
	 * @param {Buffer} options.data - The chunk data to archive
	 * @param {string} options.filename - Name for the file inside the archive
	 * @param {number} options.partIndex - Part index for naming
	 * @returns {Promise<void>} Resolves when archive is written
	 */
	createZipPart({ data, filename, outputPath, partIndex }) {
		return new Promise((resolve, reject) => {
			const output = fs.createWriteStream(outputPath);
			const archive = archiver('zip', { zlib: { level: 1 } });

			output.on('close', resolve);
			output.on('error', reject);
			archive.on('error', reject);

			archive.pipe(output);

			const entryName = `${filename}.part${String(partIndex + 1).padStart(3, '0')}`;
			archive.append(data, { name: entryName });
			archive.finalize();
		});
	}
}

export default FileService;
