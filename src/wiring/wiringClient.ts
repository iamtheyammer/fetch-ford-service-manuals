import axios from "axios";

const wiringClient = axios.create({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    Accept: "text/html, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    Origin: "https://www.fordtechservice.dealerconnection.com",
    Pragma: "no-cache",
    Referer: "https://www.fordtechservice.dealerconnection.com/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
  },
});

export default wiringClient;
