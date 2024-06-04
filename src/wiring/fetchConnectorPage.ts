import { writeFile, mkdir } from "fs/promises";
import { Page } from "playwright";
import { stringify } from "qs";
import { join } from "path";

export interface FetchConnectorParams {
  book: string;
  vehicleId: string;
  country: string;
  bookType: string;
  language: string;
  item: string;
  languageCode: string;
  page: string;
  cell: string;
}

export default async function fetchConnectorPage(
  params: FetchConnectorParams,
  browserPage: Page,
  savePath: string,
  connectorName: string
): Promise<void> {
  const url = `https://www.fordtechservice.dealerconnection.com/Wiring/face/?${stringify(
    params
  )}`;

  // The connector views for my vehicle have a button which reveals additional information. I am saving as html to perserve that button and the information behind it.
  // Perhaps it is possible to click the button through the browser prior to saving, in which case we could make it visible in the PDF
  // and get rid of the HTML saving.
  const pdfSavePath = join(savePath, "/pdf/");
  const htmlSavePath = join(savePath, "/html/");

  try {
    await mkdir(pdfSavePath);
  } catch (e: any) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }

  try {
    await mkdir(htmlSavePath);
  } catch (e: any) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
  await browserPage.goto(url, {
    waitUntil: "networkidle",
  });
  await browserPage.pdf({
    path: join(pdfSavePath, `${connectorName}.pdf`),
  });
  await writeFile(
    join(htmlSavePath, `${connectorName}.html`),
    await browserPage.content()
  );
}
