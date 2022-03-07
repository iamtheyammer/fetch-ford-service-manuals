import { FetchManualPageParams } from "./fetchManualPage";
import { readFile } from "fs/promises";

interface Config {
  workshop: FetchManualPageParams;
  wiring: {
    environment: string;
    bookType: string;
  };
}

export default async function readConfig(path: string): Promise<Config> {
  const fileContent = await readFile(path, { encoding: "utf-8" });
  return JSON.parse(fileContent) as Config;
}
