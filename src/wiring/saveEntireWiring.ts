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
import fetchPageList from "./fetchPageList";
import fetchConnectorList from "./fetchConnectorList";
import fetchConnectorPage from "./fetchConnectorPage";
import fetchSvg from "./fetchSvg";
import transformCookieString from "../transformCookieString";

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
  const svgToImg = require("svg-to-img");
  const jsdom = require("jsdom");
  const { JSDOM } = jsdom;

  await writeFile(join(wiringPath, "toc.json"), JSON.stringify(toc, null, 2));

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
          page: "1",
          bookType: fetchWiringParams.bookType,
          contentmarket: fetchWiringParams.contentmarket,
          contentlanguage: fetchManualParams.contentlanguage,
          languageCode: fetchWiringParams.languageCode
        },
        cookieString
      );

      // Fetch each page per Wiring section
      for (let j = 0; j < pageList.length; j++) {
        const page = pageList[j].replace(/^0+/, "");
        const sectionPath = join(wiringPath, sanitizedTitle);
        try {
          await mkdir(sectionPath);
        } catch (e: any) {
          if (e.code !== "EEXIST") {
            throw e;
          }
        }
        const newTitle = join(
          sectionPath,
          `${doc.Number}_${sanitizedTitle}_${page}.png`
        );
        console.log(
          `Downloading wiring diagram Section: ${doc.Number} Title: ${doc.Title} Page: ${page} as image. `
        );

        const svgData = await fetchSvg(
          doc.Number,
          page,
          fetchWiringParams.environment,
          fetchManualParams.vehicleId,
          fetchManualParams.WiringBookCode,
          fetchWiringParams.languageCode,
          cookieString,
        );
        const svgParsed = new JSDOM(svgData, 'image/svg+xml').window.document;
        const borderRect = svgParsed.getElementById("BORDER").getElementsByTagName("rect")[0];
        const width = borderRect.getAttribute("width");
        const height = borderRect.getAttribute("height");
        const image = await svgToImg.from(svgData).toPng({
          path: newTitle,
          background: 'white',
          height: height,
          width: width
        });
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
          languageCode: fetchWiringParams.languageCode
        },
        cookieString
      );
      for (let k = 0; k < connectorList.length; k++) {
        const connector = connectorList[k];
        const connectorTitle = join(connectorPath, `${connector.Name} - ${connector.Desc.replace(/\//g,'')}.png`);
        console.log(
          `Downloading Connector Face diagram Section: ${connector.Name} as image. `
        );
        await fetchConnectorPage(
          {
            book: fetchWiringParams.book,
            vehicleId: fetchManualParams.vehicleId,
            country: fetchManualParams.contentmarket,
            bookType: fetchWiringParams.bookType,
            language: fetchManualParams.contentlanguage,
            item: connector.FaceView,
            languageCode: fetchWiringParams.languageCode,
            page: "",
            cell: doc.Number,
          },
          browserPage,
          connectorTitle
        );
      }
    }
  }
}
