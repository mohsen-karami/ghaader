import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize, errors } = format;

/**
 * Custom log format for file output.
 * @returns {object} Winston format object
 */
function buildFileFormat() {
	return combine(
		timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		errors({ stack: true }),
		printf(({ level, message, timestamp: time, stack }) => {
			const base = `${time} [${level.toUpperCase()}]: ${message}`;
			return stack ? `${base}\n${stack}` : base;
		})
	);
}

/**
 * Custom log format for console output.
 * @returns {object} Winston format object
 */
function buildConsoleFormat() {
	return combine(
		colorize(),
		timestamp({ format: 'HH:mm:ss' }),
		errors({ stack: true }),
		printf(({ level, message, timestamp: time, stack }) => {
			const base = `${time} ${level}: ${message}`;
			return stack ? `${base}\n${stack}` : base;
		})
	);
}

/**
 * Creates a daily rotate file transport.
 * @param {string} level - Log level for this transport
 * @returns {object} Winston DailyRotateFile transport
 */
function createRotateTransport(level) {
	return new DailyRotateFile({
		datePattern: 'YYYY-MM-DD',
		dirname: 'logs',
		filename: `%DATE%-${level}.log`,
		format: buildFileFormat(),
		level,
		maxFiles: '180d',
		maxSize: '20m',
		zippedArchive: true,
	});
}

const logger = createLogger({
	level: process.env.LOG_LEVEL || 'info',
	transports: [
		createRotateTransport('error'),
		createRotateTransport('info'),
		new transports.Console({
			format: buildConsoleFormat(),
		}),
	],
});

export default logger;
