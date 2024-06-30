import { WiringFetchParams } from "./fetchTableOfContents";
import client from "../client";

type ConnectorLocIndexType = string;

export const CONNECTOR_LOC_INDEX_TYPES: ConnectorLocIndexType[] = [
  "COMPONENT",
  "CONNECTOR",
  "SPLICE",
  "GROUND",
  "HARNESS",
];

export interface LocIndexComponentType {
  // Not sure what this is for, but it seems to always be null
  Conn: null;
  // Connector ID (ex: C1147)
  Item: string;
  // Seems to match Item
  From: string;
  // Seems to match Item
  Fromitem: string;
  // Seems to match Item
  GridRef: string;
  // Human-readable description of where to find the connector
  LocationDesc: string;
  // Page of Connector Views
  Page: number;
  // Qualifier for the connector: which engine/configuration it's for
  // Examples include "Raptor", "3.5L", "5.0L", etc
  Qual: string;
}

export interface FetchLocIndexComponentTypeParams extends WiringFetchParams {
  componentType: ConnectorLocIndexType;
  cell: string | number;
}

export default async function fetchLocIndexComponentType(
  params: FetchLocIndexComponentTypeParams
): Promise<LocIndexComponentType[]> {
  const req = await client({
    method: "GET",
    url: "https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//wiring/GetComponentType",
    params: {
      environment: params.environment,
      book: params.book,
      bookType: params.bookType,
      cell: params.cell,
      componentType: params.componentType,
      languageCode: params.languageCode,
      fromPageBase: "https://www.fordtechservice.dealerconnection.com",
    },
  });

  return req.data;
}
