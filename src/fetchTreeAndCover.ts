import client from "./client";
import { stringify } from "qs";
import { FetchManualPageParams } from "./fetchManualPage";
import { JSDOM } from "jsdom";

export interface FetchTreeAndCoverParams extends FetchManualPageParams {
  CategoryDescription: string;
  category: string;
}

export default async function fetchTreeAndCover(
  params: FetchTreeAndCoverParams
): Promise<{ tableOfContents: any; pageHTML: string }> {
  const req = await client({
    method: "POST",
    url: `https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//publication/prod_1_3_362022/TreeAndCover/workshop/${params.category}/~WS8B/${params.vehicleId}`,
    params: {
      bookTitle: params.bookTitle,
      WiringBookTitle: params.WiringBookTitle,
    },
    data: stringify({
      fromPageBase: "https://www.fordtechservice.dealerconnection.com",
      isMobile: "no",
      usertype: "Retailer",
      ...params,
    }),
  });

  return processTableOfContents(req.data);
}

// recursively ignore <i> elements with only a single <i> element inside
function ignoreital(el: Element): HTMLCollection {
  if (!el.children.length) {
    console.log("children");

    return el.parentElement!.children;
  }

  if (el.children[0].tagName === "I") {
    return ignoreital(el.children[0]);
  }

  return el.children;
}

function parseul(
  objectpath: { [branchName: string]: object | string } = {},
  ul: Element
): object {
  // all list items' children
  // each item has a span and either a <ul> or an <a>
  const items = Array.from(ul.children)
    .filter((el) => el.tagName === "LI")
    .map((el) => ignoreital(el));

  items.forEach((i) => {
    const iArr = Array.from(i);

    const a = iArr.find((el) => el.tagName === "A");

    if (a) {
      // we're done with this leaf of the branch
      const name = a.textContent;
      const docid = a.getAttribute("data-for");

      // @ts-ignore
      objectpath[name] = docid;
      // this is a foreach, equivalent to a continue;
      return;
    }

    // if no <a> detected, we have a <span> and a <ul>
    const span = iArr.find((el) => el.tagName === "SPAN");
    const childUl = iArr.find((el) => el.tagName === "UL");

    if (!span || !childUl) {
      throw new Error("error code 1");
    }

    // continue recursion
    objectpath[span.textContent || "null-span-textcontent"] = parseul(
      {},
      childUl
    );
  });

  return objectpath;
}

interface TableOfContentsLeaf {
  [documentName: string]: string;
}

function processTableOfContents(toc: string): {
  tableOfContents: any;
  pageHTML: string;
} {
  const { window } = new JSDOM(toc);
  const document = window.document;

  // remove the broken filter links and add a message
  const imageElement = document.getElementById("imgCollapseTreeDiv");
  imageElement?.insertAdjacentHTML(
    "afterend",
    "<h1><strong>Links below do not work.</strong></h1><p>This table of contents is for reference only. " +
      "Manual downloaded using <a href='https://github.com/iamtheyammer/fetch-ford-service-manuals'>iamtheyammer's Ford manual downloader.</a> " +
      "Refer to the README for more information.</p>"
  );
  imageElement?.remove();

  // reveal the table of contents
  document.getElementById("wsm-tree")?.attributes.removeNamedItem("style");

  const tree = document.getElementsByClassName("tree")[0];
  const parsed = parseul({}, tree);
  return {
    tableOfContents: parsed,
    pageHTML: document.documentElement.outerHTML,
  };
}
