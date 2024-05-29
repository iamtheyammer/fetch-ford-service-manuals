import client from "../client";

// TODO: May not work for older vehicles. 1998 Ford Taurus uses a different URL, and is in GIF format instead of PDF: 
// https://www.fordservicecontent.com/Ford_Content/pubs/auxf/~WE/USENIE/EWH/EWHCF099.GIF
export default async function fetchBasicPage(
  filename: string,
  book: string,
  cookieString: string
): Promise<ReadableStream> {
  const req = await client({
    url: `https://www.fordservicecontent.com/Ford_Content/pubs/content/~W${book}/~MUS~LEN/${filename}`,
    responseType: "stream",
    headers: {
      Cookie: cookieString,
    },
  });

  return req.data;
}
