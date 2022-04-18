import client from "../client";

export interface FetchConnectorList {
  book: string;
  bookType: string;
  contentmarket: string;
  contentlanguage: string;
}

export interface ConnectorTableOfContents {
  Name: string;
  qual: string;
  Desc: string;
  FaceView: string;
  Filename: string;
}

export default async function fetchConnectorList(
  params: FetchConnectorList,
  cookieString: string,
): Promise<ConnectorTableOfContents[]> {
  const req = await client({
    method: "GET",
    url: "https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//wiring/GetConnectorList",
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