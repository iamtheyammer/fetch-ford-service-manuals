import { Page } from "playwright";
import { JSDOM } from "jsdom";
import fetchPageList from "./fetchPageList";
import {
  WiringFetchParams,
  WiringTableOfContentsEntry,
} from "./fetchTableOfContents";
import fetchSvg from "./fetchSvg";
import { join } from "path";
import { writeFile } from "fs/promises";
import { getSvgUrl, sanitizeName } from "../utils";
import fetchBasicPage from "./fetchBasicPage";

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
  folderPath: string
): Promise<void> {
  // Need pageList per docNumber
  // Page lists for "Page" type documents is returned as ["001, "002", "003", etc]

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

  for (const subPage of pageList) {
    console.log(`Saving page ${subPage} of ${doc.Title}...`);

    if (typeof subPage !== "string") {
      // page is a BasicPagePageListItem, download PDF
      const pdfPath = join(folderPath, `${subPage.Text}.pdf`);

      await fetchBasicPage(pdfPath, params.book);
      continue;
    }

    const svg = await fetchSvg(
      doc.Number,
      subPage,
      params.environment,
      params.vehicleId,
      params.book,
      params.languageCode
    );

    // parse the SVG into a DOM for manipulation
    const dom = new JSDOM(svg);
    const svgElement = dom.window.document.querySelector("svg");
    if (!svgElement) {
      console.error(
        `No SVG element found in Wiring SVG for ${doc.Title} ${subPage}`
      );
      continue;
    }

    svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    let title = subPage;

    const headerElement = dom.window.document.getElementById("Header");
    if (headerElement) {
      const child = headerElement.firstElementChild;
      if (child && child.textContent) {
        title += ` ${sanitizeName(child.textContent)}`;
      }
    }

    const svgString = dom.serialize();

    // Save the SVG
    const svgPath = join(folderPath, `${title}.svg`);
    await writeFile(svgPath, svgString);

    // Print as PDF
    const pdfPath = join(folderPath, `${title}.pdf`);
    await browserPage.goto(getSvgUrl(svgString));
    await browserPage.pdf({
      path: pdfPath,
      landscape: true,
    });
  }
}
