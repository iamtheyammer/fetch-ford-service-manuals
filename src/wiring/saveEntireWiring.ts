import {
  isBasicPage,
  isConnectors,
  isLocIndex,
  isPage,
  WiringFetchParams,
  WiringTableOfContentsEntry,
} from "./fetchTableOfContents";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { Page } from "playwright";
import { FetchManualPageParams } from "../workshop/fetchManualPage";
import savePage, { WiringFetchPageParams } from "./savePage";
import saveConnector from "./saveConnector";
import { saveLocIndex } from "./saveLocIndex";

export default async function saveEntireWiring(
  path: string,
  fetchManualParams: FetchManualPageParams,
  fetchWiringParams: WiringFetchParams,
  toc: WiringTableOfContentsEntry[],
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

  // so that it doesn't create a Connector Views folder if the book is basic
  let connectorPath = wiringPath;
  if (fetchWiringParams.bookType !== "basic") {
    try {
      connectorPath = join(wiringPath, "Connector Views");
      await mkdir(connectorPath);
    } catch (e: any) {
      if (e.code !== "EEXIST") {
        throw e;
      }
    }
  }

  await writeFile(join(wiringPath, "toc.json"), JSON.stringify(toc, null, 2));

  for (let i = 0; i < toc.length; i++) {
    const doc = toc[i];

    const sanitizedTitle = doc.Title.replace(/\//g, "-");

    // Create a folder for each section in the TOC
    const sectionPath = join(wiringPath, sanitizedTitle);
    try {
      await mkdir(sectionPath);
    } catch (e: any) {
      if (e.code !== "EEXIST") {
        throw e;
      }
    }

    const wiringFetchParams: WiringFetchPageParams = {
      ...fetchWiringParams,
      vehicleId: fetchManualParams.vehicleId,
      country: fetchManualParams.country,
    };

    if (isPage(doc) || isBasicPage(doc)) {
      // await savePage(wiringFetchParams, doc, browserPage, sectionPath);
    } else if (isConnectors(doc)) {
      await saveConnector(wiringFetchParams, doc, browserPage, connectorPath);
    } else if (isLocIndex(doc)) {
      await saveLocIndex(wiringFetchParams, doc, connectorPath);
    } else {
      console.error(`Unrecognized wiring page type ${doc.Type}`, doc);
    }
  }
}
