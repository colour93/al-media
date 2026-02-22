import { Elysia } from "elysia";
import { appRoutes } from "./routes";
import { createLogger } from "./utils/logger";
import { videoFileManager } from "./services/videoFileManager";

const port = process.env.PORT || 39994;
const logger = createLogger("root");

videoFileManager.init()

const app = new Elysia();
app
  .use(appRoutes);

app.listen(port, () => {
  logger.info(`服务运行于: http://localhost:${port}`);
});
