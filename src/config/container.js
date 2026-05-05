import path from 'path';
import { fileURLToPath } from 'url';

import WebhookController from '../controllers/WebhookController.js';
import DownloadService from '../services/DownloadService.js';
import FileService from '../services/FileService.js';
import GitHubService from '../services/GitHubService.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..', '..');
const tmpDir = path.join(projectRoot, 'tmp');

/**
 * Dependency injection container that wires all services together.
 */
class Container {
	/**
	 * Creates a Container and initializes all dependencies.
	 */
	constructor() {
		this.instances = new Map();
		this.initialize();
	}

	/**
	 * Wires up all application dependencies.
	 */
	initialize() {
		const downloadService = new DownloadService(tmpDir);
		const fileService = new FileService(tmpDir);
		const gitHubService = new GitHubService();

		const webhookController = new WebhookController({
			downloadService,
			fileService,
			gitHubService,
		});

		this.instances.set('downloadService', downloadService);
		this.instances.set('fileService', fileService);
		this.instances.set('gitHubService', gitHubService);
		this.instances.set('webhookController', webhookController);
	}

	/**
	 * Retrieves a registered instance by name.
	 * @param {string} name - The service name
	 * @returns {object} The service instance
	 */
	get(name) {
		const instance = this.instances.get(name);
		if (!instance) {
			throw new Error(`Service "${name}" not found in container`);
		}
		return instance;
	}
}

const container = new Container();

export default container;
