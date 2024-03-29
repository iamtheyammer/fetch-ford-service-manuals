import { Pre2003AlphabeticalIndex } from "./fetchAlphabeticalIndex";
import { Page } from "playwright";
import { sanitizeName, SaveOptions } from "../saveEntireManual";
import { join, resolve } from "path";
import { writeFile } from "fs/promises";

export default async function saveEntirePre2003AlphabeticalIndex(
  outputPath: string,
  documentList: Pre2003AlphabeticalIndex,
  browserPage: Page,
  options: SaveOptions
): Promise<void> {
  for (const document of documentList) {
    const { href, title } = document;
    const filename = sanitizeName(title);

    if (!href.endsWith(".htm") && !href.endsWith(".HTM")) {
      console.log(`Skipping ${title} because it's not an HTML document.`);
      continue;
    }

    console.log(`Saving ${title}...`);
    try {
      await browserPage.goto("https://www.fordservicecontent.com" + href, {
        waitUntil: "load",
        // 30 secs
        timeout: 30000,
      });

      await browserPage.pdf({
        path: join(outputPath, `/${filename}.pdf`),
      });

      if (options.saveHTML) {
        const htmlPath = resolve(join(outputPath, `/${filename}.html`));
        await writeFile(htmlPath, await browserPage.content());
      }
    } catch (e) {
      if (options.ignoreSaveErrors) {
        console.error(`Continuing to download after error with ${title}:`, e);
      } else {
        console.error(`Encountered an error downloading ${title}`);
        throw e;
      }
    }
  }
}
