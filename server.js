import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;
const MAX_PARALLEL = 5;
const POLL_MS = 1500;

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/files", express.static(path.join(__dirname, "files")));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

let nextId = 1;
const jobs = new Map();

function view(j) {
return {
id: j.id,
prompt: j.prompt,
status: j.status,
error: j.error,
downloadUrl: j.downloadUrl
};
}

app.get("/", (req, res) => res.send("Veo3 backend ok"));

app.post("/enqueue", async (req, res) => {
try {
const text = String(req.body.text || "");
const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
if (lines.length === 0) return res.status(400).json({ error: "khong co prompt" });

const ids = [];
for (const p of lines) {
  const id = nextId++;
  jobs.set(id, {
    id,
    prompt: p,
    status: "pending",
    error: "",
    op: null,
    downloadUrl: ""
  });
  ids.push(id);
}
runLoop();
res.json({ enqueued: ids.length, ids });


} catch (e) {
res.status(500).json({ error: String(e.message || e) });
}
});

app.get("/jobs", (req, res) => {
const list = Array.from(jobs.values()).sort((a, b) => a.id - b.id).map(view);
res.json({ jobs: list });
});

app.post("/retry", (req, res) => {
const id = Number(req.body.id);
const j = jobs.get(id);
if (!j) return res.status(404).json({ error: "not found" });
j.status = "pending";
j.error = "";
j.op = null;
j.downloadUrl = "";
runLoop();
res.json({ ok: true });
});

async function runLoop() {
if (globalThis._looping) return;
globalThis._looping = true;
try {
while (true) {
const running = Array.from(jobs.values()).filter(x => x.status === "running").length;
const canStart = Math.max(0, MAX_PARALLEL - running);
if (canStart > 0) {
const pend = Array.from(jobs.values()).filter(x => x.status === "pending").sort((a, b) => a.id - b.id).slice(0, canStart);
await Promise.all(pend.map(startJob));
}
await pollJobs();
await sleep(POLL_MS);
const anyRunning = Array.from(jobs.values()).some(x => x.status === "running");
const anyPending = Array.from(jobs.values()).some(x => x.status === "pending");
if (!anyRunning && !anyPending) break;
}
} finally {
globalThis._looping = false;
}
}

async function startJob(j) {
try {
j.status = "running";
const op = await ai.models.generateVideos({
model: "veo-3.1-generate-preview",
prompt: j.prompt
});
j.op = op;
} catch (e) {
j.status = "error";
j.error = String(e.message || e);
}
}

async function pollJobs() {
const running = Array.from(jobs.values()).filter(x => x.status === "running");
for (const j of running) {
try {
let op = j.op;
if (!op) continue;

  if (!op.done) {
    try {
      op = await ai.operations.getVideosOperation({ operation: op });
    } catch {}
  }
  if (op.done && op.response) {
    const list = op.response.generatedVideos || [];
    if (list.length === 0) throw new Error("khong co video tra ve");
    const file = list[0].video;
    const dl = await ai.files.download({ file });
    const dir = path.join(__dirname, "files");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const out = path.join(dir, `veo_${j.id}.mp4`);
    await dl.save(out);
    j.downloadUrl = `/files/${path.basename(out)}`;
    j.status = "done";
  }
} catch (e) {
  j.status = "error";
  j.error = String(e.message || e);
}


}
}

function sleep(ms) {
return new Promise(r => setTimeout(r, ms));
}

app.listen(PORT, () => console.log("server port " + PORT));
