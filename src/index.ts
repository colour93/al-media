import { Elysia } from "elysia";
import { appRoutes } from "./routes";
import { createLogger } from "./utils/logger";
import { videoFileManager } from "./services/videoFileManager";

const port = process.env.PORT || 39994;
const logger = createLogger("root");

const app = new Elysia();
app
  .use(appRoutes);

app.listen(port, () => {
  logger.info(`服务运行于: http://localhost:${port}`);
});

videoFileManager.getDirs().then(dirs => {
  logger.debug(`监听目录数量：${dirs.length}`);
  videoFileManager.initWatchers(dirs.map((dir) => dir.path));
  for (const dir of dirs) {
    videoFileManager.startScanTask(dir);
  }
});