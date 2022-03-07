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
    url: `https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//publication/prod_1_3_362022/TreeAndCover/workshop/${params.category}/~WS8B/${params.vechicleId}`,
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

  return {
    tableOfContents: processTableOfContents(req.data),
    pageHTML: req.data,
  };
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

// interface TableOfContentsBranch = TableOfContentsBranch | TableOfContentsLeaf;

function processTableOfContents(toc: string): any {
  const { window } = new JSDOM(toc);
  const document = window.document;

  const tree = document.getElementsByClassName("tree")[0];
  const parsed = parseul({}, tree);
  return parsed;
}
