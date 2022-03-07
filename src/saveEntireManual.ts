import { mkdir, writeFile, access } from "fs/promises";
import { join, resolve } from "path";
import fetchManualPage, { FetchManualPageParams } from "./fetchManualPage";
import client from "./client";
import { createWriteStream } from "fs";
import { Page } from "playwright";
import saveStream from "./saveStream";

export default async function saveEntireManual(
  path: string,
  toc: any,
  fetchPageParams: FetchManualPageParams,
  browserPage: Page
) {
  const exploded = Object.entries(toc);

  for (let i = 0; i < exploded.length; i++) {
    const [name, value] = exploded[i];

    if (typeof value === "string") {
      // ensure folder exists
      // try {
      //   await access(path)
      // } catch {
      //   await mkdir(path, {recursive: true})
      // }

      // download and save document
      if (value.startsWith("http") && value.includes(".pdf")) {
        console.log(`Downloading manual PDF ${name} ${value}`);

        try {
          const url = new URL(value);
          const pdfReq = await client({
            url: value,
            responseType: "stream",
          });

          const filePath = join(
            path,
            `/${value.slice(value.lastIndexOf("/"))}`
          );
          await saveStream(pdfReq.data, filePath);
        } catch (e) {
          console.error(`Error saving file ${name} with url ${value}: ${e}`);
        }
        continue;
      } else if (value.includes("/")) {
        console.error(`Skipping relative path ${value} for name ${name}`);
        continue;
      }

      console.log(`Downloading manual page ${name}.html (docID: ${value})`);
      const sanitizedName = name.replace(/\//g, "-");
      const pageHTML = await fetchManualPage({
        ...fetchPageParams,
        searchNumber: value,
      });

      const htmlPath = resolve(join(path, `/${sanitizedName}.html`));
      await writeFile(htmlPath, pageHTML);

      await savePageAsPDF(
        htmlPath,
        join(path, `/${sanitizedName}.pdf`),
        browserPage
      );

      // await sleep(250);
    } else {
      // create folder and traverse
      const newPath = join(path, name);

      try {
        await mkdir(newPath, { recursive: true });
      } catch (e) {
        if ((e as any).code === "EEXIST") {
          console.log(
            `Not creating folder ${newPath} because it already exists.`
          );
        }
      }

      await saveEntireManual(newPath, value, fetchPageParams, browserPage);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function savePageAsPDF(
  htmlPath: string,
  pdfPath: string,
  page: Page
): Promise<void> {
  await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
  await page.pdf({
    path: pdfPath,
  });
}
