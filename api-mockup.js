const express = require("express");
const app = express();
const port = 8080;
const { exec } = require("child_process");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");

const SEGMENT_LENGTH = 3; // Segment length in seconds

const AVAILABLE_ANALYSES = {
  transcription: [],
  "language-complexity": ["transcription"],
  "background-actors": [],
  "emotional-analysis": ["transcription"],
  "language-errors": ["transcription"],
  "target-group": ["transcription"],
  "quality-summary": ["transcription", "audio-gaps", "noise-detection"],
  audio: [],
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
  "language-complexity": {
    tier: "B2",
  },
  "background-actors": {
    "found-any": true,
    "time-ranges": [
      { start: 0.0, end: 1.0 },
      { start: 2.0, end: 3.0 },
    ],
  },
  "emotional-analysis": {
    emotions: {
      anger: 0.1,
      happiness: 0.9,
    },
  },
  "language-errors": {
    errors: [
      "Word 'are' should be replaced with 'is' in the sentence 'There are not many of them'.",
      "Word 'important' can be replaced with 'crucial' in the sentence 'They are very important' to better convey the message.",
    ],
  },
  "target-group": {
    "age-range": [18, 35],
  },
  "quality-summary": {
    transcription: 0.9,
    "audio-gaps": 0.5,
    "noise-detection": 0.8,
  },
};

const tickets = {};

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
  }

  res.sendFile(path.join(__dirname, "api-mockup-video.mp4"));
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

app.post("/api/ticket/analyze", (req, res) => {
  const ticketId = req.query["ticket-id"];

  if (!tickets[ticketId]) {
    res.status(400).json({ status: "bad-ticket" });
    return;
  }

  const type = req.query["type"];

  if (!type) {
    res.status(400).json({ status: "bad-type" });
    return;
  }

  if (tickets[ticketId].analysesToDo.includes(type)) {
    res.status(400).json({ status: "already-analyzing" });
    return;
  }

  const deps = AVAILABLE_ANALYSES[type];
  tickets[ticketId].analysesToDo.push(type, ...deps);

  const updateTicketProgress = () => {
    if (!tickets[ticketId].hasVideo) {
      setTimeout(updateTicketProgress, 100);
      return;
    }

    for (const analysis of tickets[ticketId].analysesToDo) {
      if (tickets[ticketId].status[analysis] === undefined) {
        tickets[ticketId].status[analysis] = 0.0;
      }

      if (tickets[ticketId].status[analysis] < 1.0) {
        tickets[ticketId].status[analysis] += 0.01;
        setTimeout(updateTicketProgress, 100);
      } else {
        tickets[ticketId].status[analysis] = ANALYSES_OUTPUT[analysis];
      }
    }
  };
  updateTicketProgress();

  res.json({
    status: "success",
    "request-deps": deps,
  });
});

app.get("/api/ticket/status", (req, res) => {
  const ticketId = req.query["ticket-id"];

  if (!tickets[ticketId]) {
    res.status(400).json({ status: "bad-ticket" });
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
    tickets[ticketId].analysesToDo = [];
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

app.listen(port, () => {
  console.log(`API mockup listening at http://localhost:${port}`);
});
