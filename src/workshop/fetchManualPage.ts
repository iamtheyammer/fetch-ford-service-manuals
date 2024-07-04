import client from "../client";
import { stringify } from "qs";

export interface FetchManualPageParams {
  vehicleId: string;
  modelYear: string;
  channel: string;
  book: string;
  bookTitle: string;
  booktype: string;
  country: string;
  language: string;
  contentmarket: string;
  contentlanguage: string;
  languageOdysseyCode: string;
  searchNumber: string;
  Vid: string;
  byvin: string;
  marketGroup: string;
  WiringBookCode: string;
  WiringBookTitle: string;
}

export default async function fetchManualPage(
  params: FetchManualPageParams
): Promise<string> {
  const req = await client({
    method: "POST",
    url: "https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//publication/Proc?environment=prod_1_3_362022",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    data: stringify({
      fromPageBase: "https://www.fordtechservice.dealerconnection.com",
      isMobile: "no",
      usertype: "Retailer",
      ...params,
    }),
  });

  return req.data;
  // returns HTML
}
