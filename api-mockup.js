const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { createProxyMiddleware } = require("http-proxy-middleware");

const SEGMENT_LENGTH = 3; // Segment length in seconds

const AVAILABLE_ANALYSES = {
  transcription: [],
  background_people: [],
  topic_change: ["transcription"],
  excessive_gestures: [],
  jargon: ["transcription"],
  numbers: ["transcription"],
  difficult_words: ["transcription"],
  long_sentences: ["transcription"],
  silence: [],
  repetition: ["transcription"],
  volume: [],
  metrics: ["transcription"],
};

function makeFakeTranscriptionWords() {
  const TEXT =
    "Informujemy, że awaria infrastruktury IT została naprawiona. Wszystkie usługi resortu są już dostępne, a dane podatników niezagrożone. Sytuacja była spowodowana problemami technicznymi. Centrum informatyki zdiagnozowało przyczynę i rozwiązało problem.";

  const words = TEXT.split(" ");

  const result = [];
  let currentTime = 10.5;
  for (const word of words) {
    const start = currentTime;
    currentTime += 0.46 + (Math.random() * 2.0 - 1.0) * 0.1;
    const end = currentTime;
    result.push({ word, start, end });
  }

  return result;
}

const ANALYSES_OUTPUT = {
  transcription: {
    words: makeFakeTranscriptionWords(),
    text: makeFakeTranscriptionWords()
      .map((w) => w.word)
      .join(" "),
  },
  background_people: {
    gaps: [
      { start: 1.2, end: 1.4 },
      { start: 10.8, end: 11.1 },
    ],
  },
  topic_change: {
    gaps: [
      { start: 3.3, end: 3.6 },
      { start: 15.7, end: 16.1 },
    ],
  },
  excessive_gestures: {
    gaps: [
      { start: 0.8, end: 1.1 },
      { start: 12.5, end: 12.9 },
    ],
  },
  jargon: {
    gaps: [
      { start: 2.7, end: 3.0 },
      { start: 13.4, end: 13.8 },
    ],
  },
  numbers: {
    gaps: [
      { start: 5.1, end: 5.4 },
      { start: 17.9, end: 18.3 },
    ],
  },
  difficult_words: {
    gaps: [
      { start: 6.3, end: 6.7 },
      { start: 14.5, end: 14.9 },
    ],
  },
  long_sentences: {
    gaps: [
      { start: 7.8, end: 8.2 },
      { start: 19.1, end: 19.5 },
    ],
  },
  silence: {
    gaps: [
      { start: 4.6, end: 5.0 },
      { start: 16.2, end: 16.6 },
    ],
  },
  repetition: {
    gaps: [
      { start: 0.4, end: 0.7 },
      { start: 11.3, end: 11.6 },
    ],
  },
  volume: {
    gaps: [
      { start: 8.5, end: 8.9 },
      { start: 18.0, end: 18.4 },
    ],
  },
  metrics: {
    wpm: 117,
    gfi: 19.6,
  },
};

const tickets = {};

const app = express();
app.use(express.json());

app.post("/api/ticket/new", (req, res) => {
  // Generate new ID
  let ticketId = "";
  for (let i = 0; i < 16; i++) {
    if (i % 4 === 0 && i !== 0) {
      ticketId += "-";
    }
    ticketId += Math.floor(Math.random() * 16).toString(16);
  }

  tickets[ticketId] = {
    hasVideo: false,
    status: {},
    analysesToDo: [],
  };

  res.json({ "ticket-id": ticketId });
});

app.post("/api/ticket/video", async (req, res) => {
  const ticketId = req.query["ticket-id"];

  if (!tickets[ticketId]) {
    res.status(400).json({ status: "bad-ticket" });
    return;
  }

  const chunks = [];

  req.on("data", (chunk) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    const fileBuffer = Buffer.concat(chunks);
    console.log("File received:", fileBuffer.length, "bytes");

    tickets[ticketId].hasVideo = true;

    res.json({ status: "success" });
  });

  req.on("error", () => {
    res.status(500).json({ status: "internal-error" });
  });
});

app.get("/api/ticket/video", (req, res) => {
  const ticketId = req.query["ticket-id"];

  if (!tickets[ticketId]) {
    res.status(400).json({ status: "bad-ticket" });
    return;
  }

  if (!tickets[ticketId].hasVideo) {
    res.status(404).json({ status: "not-uploaded" });
    return;
  }

  const videoPath = path.join(__dirname, "api-mockup-video.mp4");
  const stream = fs.createReadStream(videoPath);

  stream.on("error", (error) => {
    console.error("Error reading file:", error);
    res.status(500).json({ status: "server-error" });
  });
  stream.pipe(res);
});

app.get("/api/ticket/stream", (req, res) => {
  const ticketId = req.query["ticket-id"];

  if (!tickets[ticketId]) {
    res.status(400).json({ status: "bad-ticket" });
    return;
  }

  if (!tickets[ticketId].hasVideo) {
    res.status(404).json({ status: "not-uploaded" });
  }

  const time = parseFloat(req.query["time"]);
  const startTime = new Date(time * 1000).toISOString().substr(11, 8);
  const endTime = new Date((time + SEGMENT_LENGTH) * 1000)
    .toISOString()
    .substr(11, 8);

  const inputFile = path.join(__dirname, "api-mockup-video.mp4");
  const outputFile = path.join(__dirname, "segment.mp4");

  // Remove output file if it exists
  if (outputFile) {
    exec(`rm -f ${outputFile}`);
  }

  exec(
    `ffmpeg -i ${inputFile} -ss ${startTime} -to ${endTime} ${outputFile}`,
    (error) => {
      if (error) {
        res.status(500).json({ status: "internal-error" });
      } else {
        res.sendFile(outputFile);
      }
    }
  );
});

function updateTicketProgress() {
  for (ticketId in tickets) {
    if (!tickets[ticketId].hasVideo) {
      continue;
    }

    for (const analysis of tickets[ticketId].analysesToDo) {
      if (tickets[ticketId].status[analysis] === undefined) {
        tickets[ticketId].status[analysis] = 0.0;
      }

      if (tickets[ticketId].status[analysis] < 1.0) {
        tickets[ticketId].status[analysis] += 0.2;
      } else {
        tickets[ticketId].status[analysis] = ANALYSES_OUTPUT[analysis];
        tickets[ticketId].analysesToDo = tickets[ticketId].analysesToDo.filter(
          (a) => a !== analysis
        );
      }
    }
  }
}
setInterval(updateTicketProgress, 1000);

app.post("/api/ticket/analyze", (req, res) => {
  const ticketId = req.query["ticket-id"];

  if (!tickets[ticketId]) {
    res.status(400).json({ status: "bad-ticket" });
    return;
  }

  let deps;

  const type = req.query["type"];
  if (type) {
    if (tickets[ticketId].analysesToDo.includes(type)) {
      res.status(400).json({ status: "already-analyzing" });
      return;
    }
    if (!AVAILABLE_ANALYSES.hasOwnProperty(type)) {
      res.status(400).json({ status: "bad-analysis-type" });
      return;
    }
    // Start just the selected analysis and its dependencies
    if (!tickets[ticketId].analysesToDo.includes(type)) {
      tickets[ticketId].analysesToDo.push(type);
    }
    deps = AVAILABLE_ANALYSES[type];
    for (const dep of deps) {
      if (!tickets[ticketId].analysesToDo.includes(dep)) {
        tickets[ticketId].analysesToDo.push(dep);
      }
    }
  } else {
    // Start all analyses
    for (const analysis in AVAILABLE_ANALYSES) {
      if (!tickets[ticketId].analysesToDo.includes(analysis)) {
        tickets[ticketId].analysesToDo.push(analysis);
      }
    }
  }
  updateTicketProgress();

  res.json({
    status: "success",
    "request-deps": type ? deps : undefined,
  });
});

app.get("/api/ticket/status", (req, res) => {
  const ticketId = req.query["ticket-id"];

  if (!tickets[ticketId]) {
    res.status(404).json({ status: "bad-ticket" });
    return;
  }

  const sendResults = req.query["send-results"] === "true";
  if (sendResults) {
    res.json(tickets[ticketId].status);
  } else {
    res.json(
      Object.keys(tickets[ticketId].status).reduce((acc, key) => {
        acc[key] = tickets[ticketId].status[key];
        if (acc[key] instanceof Object) {
          acc[key] = {};
        }
        return acc;
      }, {})
    );
  }
});

app.post("/api/ticket/delete", (req, res) => {
  const ticketId = req.query["ticket-id"];

  if (!tickets[ticketId]) {
    res.status(400).json({ status: "bad-ticket" });
    return;
  }

  delete tickets[ticketId];

  res.json({ status: "success" });
});

app.post("/api/ticket/cancel", (req, res) => {
  const ticketId = req.query["ticket-id"];

  if (!tickets[ticketId]) {
    res.status(400).json({ status: "bad-ticket" });
    return;
  }

  const type = req.query["type"];

  if (!type) {
    for (const analysis of tickets[ticketId].analysesToDo) {
      delete tickets[ticketId].status[analysis];
    }
    tickets[ticketId].analysesToDo = [];
    res.json({ status: "success" });
    return;
  }

  if (!tickets[ticketId].analysesToDo.includes(type)) {
    res.status(400).json({ status: "not-analyzed" });
    return;
  }

  tickets[ticketId].analysesToDo = tickets[ticketId].analysesToDo.filter(
    (analysis) => analysis !== type
  );
  delete tickets[ticketId].status[type];

  res.json({ status: "success" });
});

// Proxy to frontend if no endpoint matches
app.use(
  createProxyMiddleware({
    target: "http://localhost:3000",
    changeOrigin: true,
  })
);

const port = 8080;
app.listen(port, () => {
  console.log(`API mockup listening at http://localhost:${port}`);
});
