import client from "../client";

export interface FetchBasicPageNameList {
  environment: string;
  book: string;
  cell: string;
  title: string;
  page: string;
  bookType: string;
  contentmarket: string;
  contentlanguage: string;
}

export default async function fetchBasicPageName(
  params: FetchBasicPageNameList,
  cookieString: string
): Promise<string> {
  const req = await client({
    method: "GET",
    url: "https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//wiring/BasicSelectedFileName",
    params: {
      ...params,
      fromPageBase: "https://www.fordtechservice.dealerconnection.com",
    },
    headers: {
      Cookie: cookieString,
    },
  });
  return req.data;
}
