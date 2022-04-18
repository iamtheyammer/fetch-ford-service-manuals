import client from "../client";

export interface FetchWiringTableOfContents {
  environment: string;
  book: string;
  bookType: string;
  contentmarket: string;
  contentlanguage: string;
}

export interface BasicPage {
  Type: "BasicPage";
  Number: string;
  Maintitle: string;
  Page: string;
  Title: string;
  Filename: string;
}

export interface Page {
  Type: "Page";
  Number: string;
  Title: string;
}

export interface WiringTableOfContents {
  Type: "Page" | "BasicPage" | "Connectors" | "LocIndex";
  Number: string;
  Maintitle: string;
  Page: string;
  Title: string;
  Filename: string;
}

export default async function fetchTableOfContents(
  params: FetchWiringTableOfContents,
  cookieString: string
): Promise<WiringTableOfContents[]> {
  const req = await client({
    method: "GET",
    url: "https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//wiring/TableofContent",
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
