module.exports = {
	apps: [
		{
			name: 'ghaader',
			script: 'src/app.js',
			node_args: '--env-file=.env',
			instances: 1,
			autorestart: true,
			watch: false,
			max_memory_restart: '256M',
			env: {
				NODE_ENV: 'production',
			},
		},
	],
};
