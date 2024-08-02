import client from "../client";
import { WiringFetchParams } from "./fetchTableOfContents";

export interface FetchWiringPageListParams extends WiringFetchParams {
  cell: string | number;
  title: string;
  page: string | number;
}

export interface BasicPagePageListItem {
  // Page number
  Value: string;
  // Page title
  Text: string;
}

async function fetchPageList(
  params: FetchWiringPageListParams
): Promise<string[] | BasicPagePageListItem[]> {
  const req = await client({
    method: "GET",
    url: "https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//wiring/PageList",
    params: {
      ...params,
      fromPageBase: "https://www.fordtechservice.dealerconnection.com",
    },
  });
  return req.data;
}

export default fetchPageList;
