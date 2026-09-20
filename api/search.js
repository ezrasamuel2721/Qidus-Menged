export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "https://qidus-menged.vercel.app");
    const q = (url.searchParams.get("q") || "").trim();

    if (!q) {
      return res.status(400).json({
        error: "የሚፈለገውን ስም ያስገቡ።"
      });
    }

    const safe = q
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const box = "(3.4,33,15,48.5)";

    const query = `
[out:json][timeout:30];
(
  node["amenity"="place_of_worship"]["name"~"${safe}",i]${box};
  way["amenity"="place_of_worship"]["name"~"${safe}",i]${box};
  relation["amenity"="place_of_worship"]["name"~"${safe}",i]${box};

  node["amenity"="place_of_worship"]["name:am"~"${safe}",i]${box};
  way["amenity"="place_of_worship"]["name:am"~"${safe}",i]${box};
  relation["amenity"="place_of_worship"]["name:am"~"${safe}",i]${box};

  node["historic"="monastery"]["name"~"${safe}",i]${box};
  way["historic"="monastery"]["name"~"${safe}",i]${box};
  relation["historic"="monastery"]["name"~"${safe}",i]${box};
);
out center tags;
`;

    const response = await fetch(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          data: query
        })
      }
    );

    if (!response.ok) {
      return res.status(502).json({
        error: "የውጭ የመረጃ አገልግሎቱ አልተገኘም።"
      });
    }

    const data = await response.json();

    const results = (data.elements || []).map((item) => {
      const t = item.tags || {};

      const lat =
        item.lat ??
        item.center?.lat ??
        null;

      const lon =
        item.lon ??
        item.center?.lon ??
        null;

      const name =
        t["name:am"] ||
        t.name ||
        t["name:en"] ||
        "ስም ያልተገለጸ";

      const type =
        t.historic === "monastery"
          ? "ገዳም"
          : "አድባራት";

      const location =
        t["addr:city"] ||
        t["addr:town"] ||
        t["addr:village"] ||
        t["addr:district"] ||
        t["addr:state"] ||
        "ኢትዮጵያ";

      const address = [
        t["addr:street"],
        t["addr:place"],
        t["addr:village"],
        t["addr:town"],
        t["addr:city"],
        t["addr:state"]
      ]
        .filter(Boolean)
        .join(", ");

      const description =
        t["description:am"] ||
        t.description ||
        t["short_description"] ||
        `${name} — ${type}`;

      const phone =
        t.phone ||
        t["contact:phone"] ||
        "";

      const website =
        t.website ||
        t["contact:website"] ||
        "";

      const openingHours =
        t.opening_hours ||
        "";

      const denomination =
        t.denomination ||
        "";

      const mapUrl =
        lat !== null && lon !== null
          ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`
          : "";

      return {
        id: `${item.type}-${item.id}`,
        name,
        nameAm: t["name:am"] || "",
        nameEn: t["name:en"] || "",
        type,
        location,
        address,
        description,
        phone,
        website,
        openingHours,
        denomination,
        lat,
        lon,
        mapUrl
      };
    });

    return res.status(200).json({
      success: true,
      query: q,
      count: results.length,
      results
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "ፍለጋው አልተሳካም።"
    });
  }
}
