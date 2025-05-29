import pino from "pino";

const level = process.env.PINO_LOG_LEVEL ?? "info";

const logger = pino({
  level,
  timestamp: () => `,"timestamp":"${new Date(Date.now()).toISOString()}"`,
});

export default logger;
