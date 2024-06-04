import client from "../client";

export interface FetchWiringPageList {
  book: string;
  cell: string;
  title: string;
  page: string;
  bookType: string;
  contentmarket: string;
  contentlanguage: string;
  languageCode: string;
}

export default async function fetchPageList(
  params: FetchWiringPageList,
  cookieString: string
): Promise<any> {
  const req = await client({
    method: "GET",
    url: "https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//wiring/PageList",
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
