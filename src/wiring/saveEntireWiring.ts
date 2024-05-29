import {
  FetchWiringTableOfContents,
  WiringTableOfContents,
} from "./fetchTableOfContents";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import fetchBasicPage from "./fetchBasicPage";
import fetchBasicPageName from "./fetchBasicPageName";
import saveStream from "../saveStream";
import { Page } from "playwright";
import { FetchManualPageParams } from "../fetchManualPage";
import fetchPageList from "./fetchPageList";
import fetchConnectorList from "./fetchConnectorList";
import fetchConnectorPage from "./fetchConnectorPage";
import fetchSvg from "./fetchSvg";

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

  const connectorViewFolderName = "Connector Views";
  const connectorPath = join(wiringPath, connectorViewFolderName);
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
      // Page lists for "Page" type documents is returned as ["001, "002", "003", etc]
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

        // If the width/height are not specified when converting to png, the image ends up very small.
        // Read the width/height from the viewbox of the svg so we can preserve the original size.
        const svgParsed = new JSDOM(svgData, 'image/svg+xml').window.document;
        const viewBox = svgParsed.getElementById("svgDoc").getAttribute("viewBox");
        // viewbox is "x y width height"
        const width = viewBox.split(' ')[2];
        const height = viewBox.split(' ')[3];
        const image = await svgToImg.from(svgData).toPng({
          path: newTitle,
          background: 'white',
          height: height,
          width: width
        });
      }
    }

    if (doc.Type === "BasicPage") {
      var title: string = sanitizedTitle;
      // For vehicles that use "BasicPage", the connector views can be downloaded in the same manner.
      // It looks like for older vehicles, the Connector Views might actually be called something like "Connector Faces/Pinout Charts" or something similar
      // TODO: Suggest changing this if statement to:
      // if (doc.Maintitle.includes("Connector Views") || doc.Maintitle.includes("Connector Faces"))
      if (doc.Maintitle === "Connector Views") {
        title = connectorViewFolderName;
      }

      // Page lists for "BasicPage" documents is returned as:
      //   [
      //     {
      //         "Value": "1",
      //         "Text": "Page 1"
      //     },
      //     {
      //         "Value": "2",
      //         "Text": "Page 2"
      //     },
      // ]
      // For connector views, the "Text" is the name of the connector.
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
        const page = pageList[j]["Value"];
        const pageText = pageList[j]["Text"];
        const sectionPath = join(wiringPath, title);
        try {
          await mkdir(sectionPath);
        } catch (e: any) {
          if (e.code !== "EEXIST") {
            throw e;
          }
        }
        console.log(
          `Downloading wiring diagram Section: ${doc.Number} Title: ${doc.Title} Page: ${page}. `
        );

        // Query each filename, because multi-pages are not included in the TOC.
        const pageFilename = await fetchBasicPageName(
          {
            environment: fetchWiringParams.environment,
            book: fetchWiringParams.book,
            cell: doc.Number,
            title: doc.Title,
            page: page,
            bookType: fetchWiringParams.bookType,
            contentmarket: fetchWiringParams.contentmarket,
            contentlanguage: fetchManualParams.contentlanguage,
          },
          cookieString
        );

        const docStream = await fetchBasicPage(
          pageFilename,
          fetchWiringParams.book,
          cookieString
        );

        await saveStream(
          docStream,
          join(sectionPath, `${title} - ${pageText}${doc.Filename.slice(doc.Filename.indexOf("."))}`)
        );
      }
    }

    // Start connectors
    if (doc.Type === "Connectors" && doc.Title === "Connector Views") {
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
        const connectorTitle = `${connector.Name} - ${connector.Desc.replace(/\//g, '')}`;
        console.log(
          `Downloading Connector Face diagram section: ${connector.Name} as PDF and HTML. `
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
          connectorPath,
          connectorTitle
        );
      }
    }
  }
}
