import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import VideoControls from "@/components/video-controls";
import VideoStream from "@/components/video-stream";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";

let videoToUpload: File | null = null;

export function setVideoToUpload(file: File) {
  videoToUpload = file;
}

type TranscriptionStatus = {
  words: { word: string; start: number; end: number }[];
};

type Status = {
  transcription?: TranscriptionStatus | {} | number;
};

function Transcription({
  status,
  videoRef,
}: {
  status: TranscriptionStatus;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const handleWordClick = (index: number) => {
    if (videoRef.current) {
      const start = status.words[index].start;
      videoRef.current.currentTime = start;
    }
  };

  return (
    <div className="flex items-center mr-[-8px] w-full h-full text-2xl">
      <ScrollArea className="h-full w-full">
        <div className="flex flex-wrap justify-center pr-2">
          {status.words.map((word, index) => {
            const isCurrent =
              videoRef.current &&
              videoRef.current.currentTime >= word.start &&
              videoRef.current.currentTime < word.end;
            return (
              <span
                key={index}
                className={`select-none rounded-md px-1 cursor-pointer transition-colors ${
                  isCurrent ? "bg-foreground text-background" : ""
                }`}
                onClick={() => handleWordClick(index)}
              >
                {word.word}
              </span>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function AnalysisPanel({
  ticketId,
  status,
  id,
  name,
  Component,
  componentProps,
}: {
  ticketId: string;
  status: React.MutableRefObject<Status | null>;
  id: string;
  name: string;
  Component: React.FC<any>;
  componentProps: object;
}) {
  if (status.current === null) {
    return null;
  }

  const analysisStatus = (status.current as any)[id];

  return (
    <div className="flex flex-col items-center rounded-md border pt-1 h-[384px] w-full max-w-[384px]">
      <div className="border-b text-center w-full text-md pb-1 font-bold">
        {name}
      </div>
      <div className="flex flex-col items-center justify-center p-4 w-full h-[350px]">
        {typeof analysisStatus === "object" ? (
          // Display results
          <Component {...componentProps} status={analysisStatus} />
        ) : typeof analysisStatus === "number" ? (
          // Display progress
          <div className="flex flex-col items-center justify-center w-full h-full">
            <Progress value={(analysisStatus as number) * 100} />
          </div>
        ) : (
          // Display request button
          <Button
            onClick={async () => {
              (status.current as any)[id] = 0;

              const response = await fetch(
                `/api/ticket/analyze?ticket-id=${ticketId}&type=${id}`,
                {
                  method: "POST",
                }
              );
              if (response.ok) {
                const deps = (await response.json())["request-deps"];
                if (deps) {
                  for (const dep of deps) {
                    (status.current as any)[dep] = 0;
                  }
                }
              } else {
                alert("Failed to request the analysis.");
              }
            }}
          >
            Request {name}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function TicketStatus() {
  const [rerenderCount, setRerenderCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUploadProgress = useRef<number | null>(videoToUpload ? 0 : null);

  const router = useRouter();
  const ticketId = router.query["ticket-id"] as string;

  const rerender = useCallback(() => {
    setRerenderCount(rerenderCount + 1);
  }, [rerenderCount]);

  // Rerender at 60FPS
  useEffect(() => {
    const interval = setInterval(rerender, 15);
    return () => clearInterval(interval);
  }, [rerender]);

  // Upload the video if redirected from /new
  useEffect(() => {
    if (videoToUpload && videoUploadProgress.current !== null) {
      // Upload the video
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/ticket/video?ticket-id=${ticketId}`, true);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          videoUploadProgress.current = percentComplete;
          console.log(`Upload progress: ${percentComplete.toFixed(2)}%`);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          videoUploadProgress.current = null;
          rerender();
        } else {
          alert("Failed to upload the video.");
        }
      };

      xhr.onerror = () => {
        alert("Failed to upload the video.");
      };

      xhr.send(videoToUpload);
      videoToUpload = null;
    }
  }, [ticketId]);

  // Fetch initial status
  const status = useRef<Status | null>(null);
  useEffect(() => {
    if (ticketId) {
      const fetchStatus = async () => {
        if (
          status.current === null ||
          Object.keys(status.current).reduce(
            (acc, key) =>
              acc || typeof (status.current as any)[key] === "number",
            false
          )
        ) {
          const response = await fetch(
            `/api/ticket/status?ticket-id=${ticketId}&send-results=true`
          );
          if (response.ok) {
            status.current = await response.json();
            rerender();
          } else {
            alert("Failed to fetch the ticket status.");
          }
        }
      };

      fetchStatus();
      const interval = setInterval(fetchStatus, 1000);
      return () => clearInterval(interval);
    }
  }, [ticketId]);

  return (
    ticketId && (
      <div className="flex flex-col items-center">
        <div className="flex flex-col items-center h-screen p-8 w-full max-w-screen-xl border-x">
          <div className="flex flex-col justify-center items-center w-full xl:flex-row gap-4">
            <div className="flex flex-col justify-center items-center h-[384px] aspect-video">
              {videoUploadProgress.current !== null ? (
                <div className="rounded-md border px-16 flex flex-col items-center justify-center w-full aspect-video">
                  <div className="text-xl font-bold mb-4">
                    Uploading your video...
                  </div>
                  <Progress value={videoUploadProgress.current} />
                </div>
              ) : (
                <>
                  <VideoStream ticketId={ticketId} videoRef={videoRef} />
                  <VideoControls
                    onPlayPause={() => {
                      if (videoRef.current) {
                        if (videoRef.current.paused) {
                          videoRef.current.play();
                        } else {
                          videoRef.current.pause();
                        }
                      }
                      rerender();
                    }}
                    onGoto={(time) => {
                      if (videoRef.current) {
                        videoRef.current.currentTime =
                          (time / 100) * videoRef.current.duration;
                      }
                      rerender();
                    }}
                    progress={
                      videoRef.current
                        ? (videoRef.current.currentTime /
                            videoRef.current.duration) *
                          100
                        : 0
                    }
                    isPlaying={
                      videoRef.current ? !videoRef.current.paused : false
                    }
                  />
                </>
              )}
            </div>

            <AnalysisPanel
              ticketId={ticketId}
              status={status}
              id="transcription"
              name="Transcription"
              Component={Transcription}
              componentProps={{ videoRef }}
            />
          </div>
        </div>
      </div>
    )
  );
}
