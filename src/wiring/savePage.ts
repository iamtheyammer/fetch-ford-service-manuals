import { Page } from "playwright";
import { JSDOM } from "jsdom";
import fetchPageList from "./fetchPageList";
import {
  WiringFetchParams,
  WiringTableOfContentsEntry,
} from "./fetchTableOfContents";
import fetchSvg from "./fetchSvg";
import { join, resolve } from "path";
import { writeFile } from "fs/promises";
import { sanitizeName } from "../utils";

export interface WiringFetchPageParams extends WiringFetchParams {
  vehicleId: string;
  country: string;
}

export default async function savePage(
  params: WiringFetchPageParams,
  doc:
    | (WiringTableOfContentsEntry & { Type: "Page" })
    | (WiringTableOfContentsEntry & { Type: "BasicPage" }),
  browserPage: Page,
  folderPath: string,
  ignoreSaveErrors: boolean = false
): Promise<void> {
  const pageList = await fetchPageList({
    ...params,
    cell: doc.Number,
    title: doc.Title,
    page: "1",
  });

  await writeFile(
    join(folderPath, "pageList.json"),
    JSON.stringify(pageList, null, 2)
  );

  for (const subPage of pageList as any[]) {
    let pageNumber: string | null = null;

    if (typeof subPage === "string") {
      pageNumber = subPage;
    } else if (subPage && typeof subPage === "object") {
      // Current Ford format: {cell, page, Code, Startdate, Enddate}
      if ("page" in subPage && subPage.page) {
        pageNumber = String(subPage.page);
      } else if ("Value" in subPage && subPage.Value) {
        // Legacy BasicPage format - skip
        console.warn(
          `  Skipping legacy BasicPage subpage in ${doc.Title}`
        );
        continue;
      }
    }

    if (!pageNumber) {
      console.warn(
        `  Skipping unrecognized subpage format in ${doc.Title}: ${JSON.stringify(
          subPage
        )}`
      );
      continue;
    }

    try {
      console.log(`Saving page ${pageNumber} of ${doc.Title}...`);

      const svg = await fetchSvg(
        doc.Number,
        pageNumber,
        params.environment,
        params.vehicleId,
        params.book,
        params.languageCode
      );

      const dom = new JSDOM(svg);
      const svgElement = dom.window.document.querySelector("svg");
      if (!svgElement) {
        console.error(
          `  No SVG element found in Wiring SVG for ${doc.Title} ${pageNumber}`
        );
        continue;
      }

      svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      let title = pageNumber;

      const headerElement = dom.window.document.getElementById("Header");
      if (headerElement) {
        const child = headerElement.firstElementChild;
        if (child && child.textContent) {
          title += ` ${sanitizeName(child.textContent)}`;
        }
      }

      const svgString = dom.serialize();

      const svgPath = join(folderPath, `${title}.svg`);
      await writeFile(svgPath, svgString);

      const pdfPath = join(folderPath, `${title}.pdf`);

      await browserPage.goto(`file:///${encodeURI(resolve(svgPath))}`);
      await browserPage.pdf({
        path: pdfPath,
        landscape: true,
      });
    } catch (e: any) {
      if (ignoreSaveErrors) {
        console.error(
          `  Failed to save subpage ${pageNumber} of ${doc.Title}: ${e.message}`
        );
        continue;
      }
      throw e;
    }
  }
}
