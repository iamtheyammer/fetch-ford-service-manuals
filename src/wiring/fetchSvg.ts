import client from "../client";

export default async function fetchSvg(
  docNumber: string,
  pageNumber: string,
  environment: string,
  vehicleId: string,
  wiringBookCode: string,
  languageCode: string
): Promise<string> {
  const req = await client({
    method: "GET",
    url: `https://www.fordservicecontent.com/ford_content/PublicationRuntimeRefreshPTS/wiring/svg/${environment}/${vehicleId}/~W${wiringBookCode}/${languageCode}/svg/${docNumber}/0/${parseInt(
      pageNumber
    )}.svg`,
    params: {
      fromPageBase: "https://www.fordtechservice.dealerconnection.com",
    },
  });
  return req.data;
}
