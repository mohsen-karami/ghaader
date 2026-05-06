/**
 * Centralized environment configuration.
 * Reads from process.env and provides typed defaults.
 */
class Environment {
	/**
	 * Creates an Environment instance by reading process.env.
	 */
	constructor() {
		this.githubToken = this.require('GITHUB_TOKEN');
		this.logLevel = process.env.LOG_LEVEL || 'info';
		this.maxFileSizeMb = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 95;
		this.port = parseInt(process.env.PORT, 10) || 3000;
		this.webhookSecret = this.require('WEBHOOK_SECRET');
		this.youtubeCookiesPath = process.env.YOUTUBE_COOKIES_PATH || '';
	}

	/**
	 * Reads a required environment variable or throws.
	 * @param {string} name - The environment variable name
	 * @returns {string} The value of the environment variable
	 */
	require(name) {
		const value = process.env[name];
		if (!value) {
			throw new Error(`Missing required environment variable: ${name}`);
		}
		return value;
	}
}

const environment = new Environment();

export default environment;
