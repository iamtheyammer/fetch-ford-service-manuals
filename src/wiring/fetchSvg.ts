import { Page } from "playwright";
import { stringify } from "qs";
import wiringClient from "./wiringClient";

export interface FetchWiringPageParams {
  book: string;
  vehicleId: string;
  cell: string;
  page: string;
  country: string;
  bookType: string;
  language: string;
  languageCode: string;
  title: string;
  market: string;
  // booktitle: string;
}

export default async function fetchSvg(
  docNumber: string,
  pageNumber: string,
  environment: string,
  vehicleId: string,
  wiringBookCode: string,
  languageCode: string,
  cookieString: string,
): Promise<string> {
  const req = await wiringClient({
    method: "GET",
    url: `https://www.fordservicecontent.com/ford_content/PublicationRuntimeRefreshPTS/wiring/svg/${environment}/${vehicleId}/~W${wiringBookCode}/${languageCode}/svg/${docNumber}/0/${pageNumber}.svg`,
    params: {
      fromPageBase: "https://www.fordtechservice.dealerconnection.com",
    },
    headers: {
      Cookie: cookieString,
    },
  });
  //console.log(url);
  const svgData = req.data.replace(/xmlns:xlink=\"http:\/\/www.w3.org\/1999\/xlink\"/g, 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"');
  return svgData;
  //await browserPage.goto(url, {
  //  waitUntil: "networkidle",
  //});
}
