import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

export const logger = pino(
  {
    level: isDev ? "debug" : "info",
  },
  isDev
    ? pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname,module",
        messageFormat: "[{module}] {msg}"
      },
    })
    : undefined
);

export const createLogger = (moduleName: string) => {
  return logger.child({ module: moduleName });
};