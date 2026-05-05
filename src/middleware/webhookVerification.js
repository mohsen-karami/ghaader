import crypto from 'crypto';

import environment from '../config/environment.js';
import logger from '../utils/logger.js';

/**
 * Verifies GitHub webhook HMAC-SHA256 signature.
 * Rejects requests with missing or invalid signatures.
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function verifyWebhookSignature(req, res, next) {
	const signature = req.headers['x-hub-signature-256'];

	if (!signature) {
		logger.warn('Webhook request missing signature header');
		res.status(401).json({ error: 'Missing signature' });
		return;
	}

	const payload = JSON.stringify(req.body);
	const hmac = crypto.createHmac('sha256', environment.webhookSecret);
	const digest = `sha256=${hmac.update(payload).digest('hex')}`;

	if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
		logger.warn('Webhook request has invalid signature');
		res.status(401).json({ error: 'Invalid signature' });
		return;
	}

	next();
}

export default verifyWebhookSignature;
