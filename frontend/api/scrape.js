export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const backend = await fetch("http://deteksihoaks.labirariset.com/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await backend.json();
    
    return res.status(backend.status).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
