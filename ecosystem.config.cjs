module.exports = {
	apps: [
		{
			name: 'ghaader',
			script: 'src/app.js',
			instances: 1,
			autorestart: true,
			watch: false,
			max_memory_restart: '256M',
			env: {
				NODE_ENV: 'production',
				GITHUB_TOKEN: 'ghp_xxxxxxxxxxxxxxxxxxxx',
				WEBHOOK_SECRET: 'your-webhook-secret-here',
				PORT: 3000,
				MAX_FILE_SIZE_MB: 95,
				LOG_LEVEL: 'info',
				YOUTUBE_COOKIES_PATH: '',
			},
		},
	],
};
