import pino from "pino";

const nodeEnv = process.env["NODE_ENV"];
const enableTransport = process.env["PINO_TRANSPORT_ENABLED"] === "true";
const isDev = nodeEnv === "development";

export const logger = pino(
  {
    level: isDev ? "debug" : "info",
  },
  isDev && enableTransport
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
