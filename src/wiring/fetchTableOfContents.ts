import client from "../client";

export interface WiringFetchParams {
  environment: string;
  book: string;
  bookType: string;
  contentmarket: string;
  contentlanguage: string;
  languageCode: string;
}

export interface WiringTableOfContentsEntry {
  Type: "Page" | "Connectors" | "LocIndex" | "BasicPage";
  Number: string;
  Maintitle: string;
  Page: string;
  Title: string;
  Filename: string;
}

// Type guards for WiringTableOfContentsEntry
export const isPage = (
  entry: WiringTableOfContentsEntry
): entry is WiringTableOfContentsEntry & { Type: "Page" } =>
  entry.Type === "Page";
export const isConnectors = (
  entry: WiringTableOfContentsEntry
): entry is WiringTableOfContentsEntry & { Type: "Connectors" } =>
  entry.Type === "Connectors";
export const isLocIndex = (
  entry: WiringTableOfContentsEntry
): entry is WiringTableOfContentsEntry & { Type: "LocIndex" } =>
  entry.Type === "LocIndex";
export const isBasicPage = (
  entry: WiringTableOfContentsEntry
): entry is WiringTableOfContentsEntry & { Type: "BasicPage" } =>
  entry.Type === "BasicPage";

export default async function fetchTableOfContents(
  params: WiringFetchParams
): Promise<WiringTableOfContentsEntry[]> {
  const req = await client({
    method: "GET",
    url: "https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//wiring/TableofContent",
    params: {
      ...params,
      fromPageBase: "https://www.fordtechservice.dealerconnection.com",
    },
  });

  return req.data;
}
