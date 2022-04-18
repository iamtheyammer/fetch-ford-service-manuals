import {
  FetchWiringTableOfContents,
  WiringTableOfContents,
} from "./fetchTableOfContents";
import { mkdir } from "fs/promises";
import { join } from "path";
import fetchBasicPage from "./fetchBasicPage";
import saveStream from "../saveStream";
import { Page } from "playwright";
import fetchPage from "./fetchPage";
import { FetchManualPageParams } from "../fetchManualPage";
import fetchPageList from "./fetchPageList";
import fetchConnectorList from "./fetchConnectorList";
import fetchConnectorPage from "./fetchConnectorPage";

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
  const connectorPath = join(path, "Connectors");
  try {
    await mkdir(connectorPath);
  } catch (e: any) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }

  for (let i = 0; i < toc.length; i++) {
    const doc = toc[i];
    const sanitizedTitle = doc.Title.replace(/\//g, "-");

    // Connector views, different format handled later
    if (doc.Type === "Page" && doc.Title !== "Connector Views") {
      // Need pageList per docNumber
      const pageList = await fetchPageList(
        {
          book: fetchWiringParams.book,
          cell: doc.Number,
          title: doc.Title,
          bookType: fetchWiringParams.bookType,
          contentmarket: fetchWiringParams.contentmarket,
          contentlanguage: fetchManualParams.contentlanguage,
        },
        cookieString
      );

      // Fetch each page per Wiring section
      for (let j = 0; j < pageList.length; j++) {
        const page = pageList[j].replace(/^0+/, "");
        const newTitle = join(
          wiringPath,
          `${doc.Number}_${sanitizedTitle}_${page}.png`
        );
        console.log(
          `Downloading wiring diagram Section: ${doc.Number} Title: ${doc.Title} Page: ${page} as image. `
        );
        await fetchPage(
          {
            book: fetchWiringParams.book,
            market: fetchWiringParams.contentmarket,
            language: fetchManualParams.contentlanguage,
            cell: doc.Number,
            page: page,
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
    }

    // Start connectors
    if (doc.Title === "Connector Views") {
      const connectorList = await fetchConnectorList(
        {
          book: fetchWiringParams.book,
          bookType: fetchWiringParams.bookType,
          contentmarket: fetchWiringParams.contentmarket,
          contentlanguage: fetchManualParams.contentlanguage,
        },
        cookieString
      );

      for (let k = 0; k < connectorList.length; k++) {
        const connector = connectorList[k];
        const connectorTitle = join(connectorPath, `${connector.Name}.png`);
        console.log(
          `Downloading Connector Face diagram Section: ${connector.Name} as image. `
        );
        await fetchConnectorPage(
          {
            book: fetchWiringParams.book,
            vehicleId: fetchManualParams.vechicleId,
            country: fetchManualParams.contentmarket,
            bookType: fetchWiringParams.bookType,
            language: fetchManualParams.contentlanguage,
            item: connector.FaceView,
          },
          browserPage,
          connectorTitle
        );
      }
    }

    console.log(
      `Downloading wiring manual page ${doc.Title} (${doc.Filename}, #${doc.Number})`
    );

    const docStream = await fetchBasicPage(doc.Filename, cookieString);

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
