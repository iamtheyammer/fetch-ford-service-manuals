import { Page } from "playwright";
import { stringify } from "qs";

export interface FetchWiringPageParams {
  book: string;
  vehicleId: string;
  cell: string;
  page: string;
  country: string;
  bookType: string;
  language: string;
  title: string;
  market: string;
  // booktitle: string;
}

export default async function fetchPage(
  params: FetchWiringPageParams,
  browserPage: Page,
  saveImagePath: string
): Promise<void> {
  const url = `https://www.fordtechservice.dealerconnection.com/Wiring/Page?${stringify(
    params
  )}`;
  console.log(url);

  await browserPage.goto(url, {
    waitUntil: "networkidle",
  });
  await browserPage.screenshot({
    path: saveImagePath,
  });
}
