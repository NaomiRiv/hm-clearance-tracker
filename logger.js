import pino from "pino";
import dotenv from "dotenv";

dotenv.config();

const logger = pino({
  level: process.env.PINO_LOG_LEVEL || "info",
  timestamp: () => `,"timestamp":"${new Date(Date.now()).toISOString()}"`,
});

export default logger;
