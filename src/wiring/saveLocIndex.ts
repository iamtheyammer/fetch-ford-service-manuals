import { WiringFetchPageParams } from "./savePage";
import { WiringTableOfContentsEntry } from "./fetchTableOfContents";
import { Page } from "playwright";
import fetchLocIndexComponentType, {
  CONNECTOR_LOC_INDEX_TYPES,
  LocIndexComponentType,
} from "./fetchLocIndexComponentType";
import { join } from "path";
import { createWriteStream } from "fs";

const csvHeader = [
  // From
  "Connector ID",
  // Item + Qual
  "Connector",
  // Page
  "Connector Location Views Page Number",
  // GridRef
  "Grid Reference",
  // LocationDesc
  "Location in Vehicle",
].join(",");

export async function saveLocIndex(
  params: WiringFetchPageParams,
  doc: WiringTableOfContentsEntry & { Type: "LocIndex" },
  folderPath: string
): Promise<void> {
  console.log(
    "Saving Connectors.csv, which tells you which diagram to find which connector..."
  );

  const csvPath = join(folderPath, "Connectors.csv");
  const writeStream = createWriteStream(csvPath, { encoding: "utf-8" });
  writeStream.write(csvHeader + "\n");

  for (const connectorType of CONNECTOR_LOC_INDEX_TYPES) {
    let entries: LocIndexComponentType[];
    try {
      entries = await fetchLocIndexComponentType({
        ...params,
        cell: doc.Number,
        componentType: connectorType,
      });
    } catch (e: any) {
      console.log(
        `Error fetching ${connectorType} for cell ${doc.Number} (it may not exist): ${e}`
      );
      console.log(e);
      continue;
    }

    for (const entry of entries) {
      writeStream.write(
        [
          entry.From || "",
          `"${entry.Item}${entry.Qual ? ` (${entry.Qual})` : ""}"`,
          entry.Page || "",
          entry.GridRef || "",
          entry.LocationDesc ? `"${entry.LocationDesc}"` : "",
        ].join(",") + "\n"
      );
    }
  }

  writeStream.end();
}
