import { Page } from "playwright";
import { stringify } from "qs";

export interface FetchConnectorParams {
  book: string;
  vehicleId: string;
  country: string;
  bookType: string;
  language: string;
  item: string;
}

export default async function fetchConnectorPage(
  params: FetchConnectorParams,
  browserPage: Page,
  saveImagePath: string
): Promise<void> {
  const url = `https://www.fordtechservice.dealerconnection.com/Wiring/face/?${stringify(
    params
  )}`;
  await browserPage.goto(url, {
    waitUntil: "networkidle",
  });
  await browserPage.screenshot({
    path: saveImagePath,
  });
}
