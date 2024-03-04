interface TransformedCookie {
  name: string;
  value: string;
  url: string;
  sameSite: "None";
}

export default function transformCookieString(
  cookieString: string
): TransformedCookie[] {
  const pairs = cookieString
    .split(";")
    .map((c: string) => c.trim().split("=").map(decodeURIComponent))
    .reduce(function (a, b) {
      a[b[0]] = b.slice(1).join("=");
      return a;
    }, {} as { [cookie: string]: string });

  const cookies = Object.entries(pairs).map(
    ([name, value]): TransformedCookie => ({
      name,
      value: value as string,
      url: "https://www.fordtechservice.dealerconnection.com",
      sameSite: "None",
    })
  );

  const contentCookies = Object.entries(pairs).map(
    ([name, value]): TransformedCookie => ({
      name,
      value: value as string,
      url: "https://www.fordservicecontent.com",
      sameSite: "None",
    })
  );

  return cookies.concat(contentCookies);
}
