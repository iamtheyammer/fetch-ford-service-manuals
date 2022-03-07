import axios from "axios";

const client = axios.create({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:97.0) Gecko/20100101 Firefox/97.0",
    Accept: "text/html, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.05",
    "Accept-Encoding": "gzip, deflate, br",
    Origin: "https://www.fordtechservice.dealerconnection.com",
    Connection: "keep-alive",
    Referer: "https://www.fordtechservice.dealerconnection.com/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    "Sec-GPC": "1",
  },
});

export default client;
