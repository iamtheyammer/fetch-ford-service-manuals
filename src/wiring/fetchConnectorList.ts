import client from "../client";
import { WiringFetchParams } from "./fetchTableOfContents";

export interface Connector {
  // More like an ID (ex: C1147)
  Name: string;
  // Not sure what this is: it seems to always be null
  qual: null;
  // Human-readable description
  Desc: string;
  FaceView: string;
  Filename?: string;
}

export default async function fetchConnectorList(
  params: WiringFetchParams
): Promise<Connector[]> {
  const req = await client({
    method: "GET",
    url: "https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//wiring/GetConnectorList",
    params: {
      ...params,
      fromPageBase: "https://www.fordtechservice.dealerconnection.com",
    },
  });

  return req.data;
}
