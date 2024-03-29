import client from "../client";

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
