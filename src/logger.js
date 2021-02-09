const winston = require('winston');
process.env.DEBUG = true;

const { combine, timestamp, printf } = winston.format;

const formatter = printf(({ level, message, timestamp }) => {
  return `[${timestamp}] ${level}: ${message}`;
});

function filterByLevelFormatter(level) {
  return winston.format(function (info) {
    if (info['level'] === level) {
      return info;
    }
  })();
}

const logger = winston.createLogger({
    exitOnError: false,
    level: 'http',
    format: combine(
        timestamp(),
        formatter
    ),
    exceptionHandlers: [
        new winston.transports.File({filename: 'logs/exceptions.log'}),
    ],
    transports: [
        new winston.transports.File({level: 'error', dirname: 'logs', filename: 'error.log', maxsize: 5242880, format: filterByLevelFormatter('error')}),
        new winston.transports.File({level: 'warn',  dirname: 'logs', filename: 'warn.log',  maxsize: 5242880, format: filterByLevelFormatter('warn')}),
        new winston.transports.File({level: 'info',  dirname: 'logs', filename: 'info.log',  maxsize: 5242880, format: filterByLevelFormatter('info')}),
        new winston.transports.File({level: 'http',  dirname: 'logs', filename: 'http.log',  maxsize: 5242880, format: filterByLevelFormatter('http')}),
    ]
});
if(process.env.DEBUG)
{
  logger.add(new winston.transports.Console());
  logger.exceptions.handle(new winston.transports.Console())

}

module.exports = logger;