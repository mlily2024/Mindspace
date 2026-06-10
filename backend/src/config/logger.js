const winston = require('winston');
const path = require('path');
const fs = require('fs');

// File-based logging is best-effort: if we can't create the logs directory
// (read-only filesystem, non-root container without write permission to
// /app, etc.), fall back to stdout/stderr only. Render and most managed
// platforms capture stdout for log aggregation, so file logging is a
// nice-to-have for local Docker dev rather than a requirement.
const logsDir = path.join(__dirname, '../../logs');
let fileTransportsAvailable = false;
try {
  fs.mkdirSync(logsDir, { recursive: true });
  // Quick write-permission probe: touch a marker file then remove it.
  // If we can't write, fall back to stdout-only instead of crashing on
  // the first attempted log line.
  const probe = path.join(logsDir, '.write-probe');
  fs.writeFileSync(probe, '');
  fs.unlinkSync(probe);
  fileTransportsAvailable = true;
} catch (_err) {
  // logger isn't constructed yet — write the warning to stderr directly
  // eslint-disable-next-line no-console
  console.warn(
    `[logger] file-based logging unavailable (${_err.code || _err.message}); ` +
    `using stdout only. This is expected on read-only or non-root container ` +
    `filesystems (e.g. Render).`
  );
}

const transports = [];

if (fileTransportsAvailable) {
  transports.push(new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
  transports.push(new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

// Always have a Console transport so logs reach SOMEWHERE. In production
// (when file logging is also off) this is the only transport, so it gets
// the structured JSON format. In development it gets the colorised
// simple format for readability.
const isProduction = process.env.NODE_ENV === 'production';
transports.push(new winston.transports.Console({
  format: isProduction
    ? winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
}));

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'mental-health-tracker' },
  transports,
});

module.exports = logger;
