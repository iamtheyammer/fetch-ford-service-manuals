import {
  FetchWiringTableOfContents,
  WiringTableOfContents,
} from "./fetchTableOfContents";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import fetchBasicPage from "./fetchBasicPage";
import saveStream from "../saveStream";
import { Page } from "playwright";
import fetchPage from "./fetchPage";
import { FetchManualPageParams } from "../fetchManualPage";

export default async function saveEntireWiring(
  path: string,
  fetchManualParams: FetchManualPageParams,
  fetchWiringParams: FetchWiringTableOfContents,
  toc: WiringTableOfContents[],
  cookieString: string,
  browserPage: Page
) {
  const wiringPath = join(path, "Wiring");
  try {
    await mkdir(wiringPath);
  } catch (e: any) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }

  await writeFile(join(wiringPath, "toc.json"), JSON.stringify(toc, null, 2));

  for (let i = 0; i < toc.length; i++) {
    const doc = toc[i];
    const sanitizedTitle = doc.Title.replace(/\//g, "-");

    const newTitle = join(wiringPath, `${sanitizedTitle}.png`);

    if (doc.Type === "Page") {
      console.log(
        `Downloading wiring manual page ${doc.Title} as image (#${doc.Number})`
      );

      await fetchPage(
        {
          book: fetchWiringParams.book,
          market: fetchWiringParams.contentmarket,
          language: fetchManualParams.contentlanguage,
          cell: doc.Number,
          page: "1",
          vehicleId: fetchManualParams.vechicleId,
          bookType: fetchWiringParams.bookType,
          country: fetchManualParams.contentmarket,
          title: doc.Title,
        },
        browserPage,
        newTitle
      );
      continue;
    }

    console.log(
      `Downloading wiring manual page ${doc.Title} (${doc.Filename}, #${doc.Number})`
    );

    const docStream = await fetchBasicPage(
      doc.Filename,
      fetchWiringParams.book,
      cookieString
    );

    await saveStream(
      docStream,
      join(
        wiringPath,
        `${sanitizedTitle} (${doc.Filename.slice(
          0,
          doc.Filename.indexOf(".")
        )})${doc.Filename.slice(doc.Filename.indexOf("."))}`
      )
    );
  }
}
