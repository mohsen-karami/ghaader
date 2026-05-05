import express from 'express';

import container from './config/container.js';
import environment from './config/environment.js';
import verifyWebhookSignature from './middleware/webhookVerification.js';
import logger from './utils/logger.js';

const app = express();
const webhookController = container.get('webhookController');

app.use(express.json());

app.get('/health', (_req, res) => {
	res.status(200).json({ status: 'ok' });
});

app.post(
	'/webhooks/github',
	verifyWebhookSignature,
	(req, res) => webhookController.handle(req, res)
);

app.listen(environment.port, () => {
	logger.info(`Ghaader server running on port ${environment.port}`);
});

export default app;
