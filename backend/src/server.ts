import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { getDb } from "./db"; // make sure this path matches your db file

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

function sendJson(res: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function notFound(res: ServerResponse) {
  sendJson(res, 404, { error: "Not found" });
}

async function handleGetUser(res: ServerResponse, id: string) {
  const db = await getDb();
  const user = await db.get(
    "SELECT id, username, display_name, email, role, bio FROM users WHERE id = ?",
    id
  );
  if (!user) return sendJson(res, 404, { error: "User not found" });
  sendJson(res, 200, user);
}

async function handlePatchUser(req: IncomingMessage, res: ServerResponse, id: string) {
  let raw = "";
  req.on("data", chunk => (raw += chunk));
  req.on("end", async () => {
    try {
      const body = raw ? JSON.parse(raw) : {};
      const { display_name, email, role, bio } = body;

      const fields: string[] = [];
      const values: any[] = [];
      if (display_name !== undefined) { fields.push("display_name = ?"); values.push(display_name); }
      if (email !== undefined)        { fields.push("email = ?");        values.push(email); }
      if (role !== undefined)         { fields.push("role = ?");         values.push(role); }
      if (bio !== undefined)          { fields.push("bio = ?");          values.push(bio); }

      if (!fields.length) return sendJson(res, 400, { error: "No fields provided" });

      values.push(id);
      const db = await getDb();
      await db.run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);

      const updated = await db.get(
        "SELECT id, username, display_name, email, role, bio FROM users WHERE id = ?",
        id
      );
      sendJson(res, 200, updated);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON" });
    }
  });
}

createServer(async (req, res) => {
  const method = req.method || "GET";
  const url = parse(req.url || "", true);
  const path = url.pathname || "";

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  const match = path.match(/^\/api\/users\/(\d+)$/);
  if (match) {
    const id = match[1];
    if (method === "GET") return handleGetUser(res, id);
    if (method === "PATCH") return handlePatchUser(req!, res, id);
  }

  notFound(res);
}).listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT} (no Express)`);
});
