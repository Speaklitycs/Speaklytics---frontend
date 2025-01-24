import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import VideoControls from "@/components/video-controls";
import VideoStream from "@/components/video-stream";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowsLeftRightToLine,
  faBrain,
  faGraduationCap,
  faHands,
  faListOl,
  faRepeat,
  faRuler,
  faShuffle,
  faUser,
  faVolumeHigh,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";

const TIMELINE_ISSUE_COLORS = {
  background_people: "#ed5351",
  topic_change: "#51ed56",
  excessive_gestures: "#5166ed",
  jargon: "#ede851",

  numbers: "#51edc6",
  difficult_words: "#e351ed",
  long_sentences: "#ed8251",
  silence: "#a751ed",
  repetition: "#a4ed51",
  volume: "#ed516b",
};

let videoToUpload: File | null = null;

export function setVideoToUpload(file: File) {
  videoToUpload = file;
}

type TranscriptionStatus = {
  words: { word: string; start: number; end: number }[];
};

type GapsStatus = {
  gaps: { start: number; end: number }[];
};

type Status = {
  transcription?: TranscriptionStatus | {} | number;
  background_people?: GapsStatus | {} | number;
  topic_change?: GapsStatus | {} | number;
  excessive_gestures?: GapsStatus | {} | number;
  jargon?: GapsStatus | {} | number;
  numbers?: GapsStatus | {} | number;
  difficult_words?: GapsStatus | {} | number;
  long_sentences?: GapsStatus | {} | number;
  silence?: GapsStatus | {} | number;
  repetition?: GapsStatus | {} | number;
  volume?: GapsStatus | {} | number;
};

function Transcription({
  status,
  videoRef,
  displayedTimelineAnalysis,
}: {
  status: TranscriptionStatus;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  displayedTimelineAnalysis: { [key: string]: boolean };
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

            let hasIssue = false;
            for (const issue of Object.keys(displayedTimelineAnalysis)) {
              if (displayedTimelineAnalysis[issue]) {
                const issueStatus = (status as any)[issue];
                if (
                  issueStatus &&
                  issueStatus.gaps.some(
                    (gap: { start: number; end: number }) =>
                      gap.start <= word.start && gap.end >= word.end
                  )
                ) {
                  hasIssue = true;
                  break;
                }
              }
            }

            return (
              <span
                key={index}
                className={`select-none rounded-md px-1 cursor-pointer transition-colors ${
                  isCurrent ? "bg-foreground text-background" : ""
                } ${hasIssue ? "bg-red-500 text-white" : ""}`}
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
    <>
      {typeof analysisStatus === "object" && analysisStatus ? (
        // Display results
        <Component {...componentProps} status={analysisStatus} />
      ) : typeof analysisStatus === "number" ? (
        // Display progress
        <div className="flex flex-col items-center justify-center w-full h-full gap-4">
          <Progress value={(analysisStatus as number) * 100} />
          <Button
            onClick={async () => {
              const response = await fetch(
                `/api/ticket/cancel?ticket-id=${ticketId}&type=${id}`,
                {
                  method: "POST",
                }
              );
              if (response.ok) {
                (status.current as any)[id] = null;
              } else {
                alert("Failed to cancel the analysis.");
              }
            }}
          >
            Cancel
          </Button>
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
          Request Analysis
        </Button>
      )}
    </>
  );
}

function AnalysisColumnItem({
  name,
  icon,
  id,
  status,
  ticketId,
  displayedTimelineAnalysis,
  setDisplayedTimelineAnalysis,
}: {
  name: string;
  icon: IconProp;
  id: string;
  ticketId: string;
  status: React.MutableRefObject<Status | null>;
  displayedTimelineAnalysis: { [key: string]: boolean };
  setDisplayedTimelineAnalysis: React.Dispatch<
    React.SetStateAction<{ [key: string]: boolean }>
  >;
}) {
  if (status.current === null) {
    return null;
  }

  const analysisStatus = (status.current as any)[id];

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon
              icon={icon}
              style={{ color: (TIMELINE_ISSUE_COLORS as any)[id] }}
            />
            {name}
          </div>
          {typeof analysisStatus === "number" && (
            <Progress
              className="mt-[-4px]"
              value={(analysisStatus as number) * 100}
            />
          )}
        </div>
        {typeof analysisStatus === "object" && analysisStatus ? (
          // Display results
          <Checkbox
            checked={displayedTimelineAnalysis[id]}
            onClick={() => {
              setDisplayedTimelineAnalysis({
                ...displayedTimelineAnalysis,
                [id]: !displayedTimelineAnalysis[id],
              });
            }}
          />
        ) : typeof analysisStatus === "number" ? (
          // Display cancel button
          <>
            <Button
              onClick={async () => {
                const response = await fetch(
                  `/api/ticket/cancel?ticket-id=${ticketId}&type=${id}`,
                  {
                    method: "POST",
                  }
                );
                if (response.ok) {
                  (status.current as any)[id] = null;
                } else {
                  alert("Failed to cancel the analysis.");
                }
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          // Display request button
          <>
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
              Request
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function TicketStatus() {
  const [rerenderCount, setRerenderCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUploadProgress = useRef<number | null>(videoToUpload ? 0 : null);
  const [displayedTimelineAnalysis, setDisplayedTimelineAnalysis] = useState<{
    [key: string]: boolean;
  }>({
    background_people: true,
    topic_change: true,
    excessive_gestures: true,
    jargon: true,
    numbers: true,
    difficult_words: true,
    long_sentences: true,
    silence: true,
    repetition: true,
    volume: true,
  });

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
          } else if (response.status === 404) {
            router.push("/");
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
        <div className="flex flex-col items-center min-h-screen p-8 w-full max-w-screen-xl border-x">
          <div className="flex flex-col justify-center items-center w-full gap-4 pb-10">
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
                    gaps={Object.keys(status.current || {})
                      .filter((key) => displayedTimelineAnalysis[key])
                      .map((key) => {
                        const analysisStatus = (status.current as any)[key];
                        if (
                          analysisStatus &&
                          typeof analysisStatus === "object"
                        ) {
                          return analysisStatus.gaps.map(
                            (gap: { start: number; end: number }) => ({
                              color: (TIMELINE_ISSUE_COLORS as any)[key],
                              start:
                                (gap.start /
                                  (videoRef.current?.duration || 1)) *
                                100,
                              end:
                                (gap.end / (videoRef.current?.duration || 1)) *
                                100,
                            })
                          );
                        }
                        return [];
                      })
                      .flat()}
                  />
                </>
              )}
            </div>

            <div className="flex flex-row flex-nowrap justify-stretch w-full gap-4">
              <div className="flex-grow">
                <div className="flex flex-col items-center rounded-md border pt-1 h-full">
                  <div className="border-b text-center w-full text-md pb-1 font-bold">
                    Transcription
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 w-full h-full">
                    <AnalysisPanel
                      ticketId={ticketId}
                      status={status}
                      id="transcription"
                      name="Transcription"
                      Component={Transcription}
                      componentProps={{ videoRef, displayedTimelineAnalysis }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex-grow-0 min-w-[300px]">
                <div className="flex flex-col items-stretch gap-4">
                  <div className="font-bold text-md">Timeline Analysis</div>
                  <div className="flex flex-col">
                    {status.current &&
                    Object.values(status.current as any).some(
                      (value) => typeof value === "number"
                    ) ? (
                      <Button
                        onClick={async () => {
                          const response = await fetch(
                            `/api/ticket/cancel?ticket-id=${ticketId}`,
                            {
                              method: "POST",
                            }
                          );
                          if (response.ok) {
                            for (const id of [
                              "transcription",
                              "background_people",
                              "topic_change",
                              "excessive_gestures",
                              "jargon",
                              "numbers",
                              "difficult_words",
                              "long_sentences",
                              "silence",
                              "repetition",
                              "volume",
                            ]) {
                              (status.current as any)[id] = null;
                            }
                          } else {
                            alert("Failed to cancel all analyses.");
                          }
                        }}
                      >
                        Cancel All
                      </Button>
                    ) : (
                      <Button
                        onClick={async () => {
                          const zeroProgress = () => {
                            for (const id of [
                              "transcription",
                              "background_people",
                              "topic_change",
                              "excessive_gestures",
                              "jargon",
                              "numbers",
                              "difficult_words",
                              "long_sentences",
                              "silence",
                              "repetition",
                              "volume",
                            ]) {
                              if (
                                (!(status.current as any)[id] &&
                                  typeof (status.current as any)[id] !==
                                    "object") ||
                                (status.current as any)[id] === null
                              ) {
                                (status.current as any)[id] = 0;
                              }
                            }
                          };
                          zeroProgress();

                          const response = await fetch(
                            `/api/ticket/analyze?ticket-id=${ticketId}`,
                            {
                              method: "POST",
                            }
                          );
                          if (!response.ok) {
                            alert("Failed to request all analyses.");
                          }

                          zeroProgress();
                        }}
                      >
                        Request All
                      </Button>
                    )}
                  </div>
                  <Separator />
                  <AnalysisColumnItem
                    name="People in Background"
                    icon={faUser}
                    id="background_people"
                    status={status}
                    ticketId={ticketId}
                    displayedTimelineAnalysis={displayedTimelineAnalysis}
                    setDisplayedTimelineAnalysis={setDisplayedTimelineAnalysis}
                  />
                  <AnalysisColumnItem
                    name="Topic Change"
                    icon={faShuffle}
                    id="topic_change"
                    status={status}
                    ticketId={ticketId}
                    displayedTimelineAnalysis={displayedTimelineAnalysis}
                    setDisplayedTimelineAnalysis={setDisplayedTimelineAnalysis}
                  />
                  <AnalysisColumnItem
                    name="Excessive Gestures"
                    icon={faHands}
                    id="excessive_gestures"
                    status={status}
                    ticketId={ticketId}
                    displayedTimelineAnalysis={displayedTimelineAnalysis}
                    setDisplayedTimelineAnalysis={setDisplayedTimelineAnalysis}
                  />
                  <AnalysisColumnItem
                    name="Jargon"
                    icon={faGraduationCap}
                    id="jargon"
                    status={status}
                    ticketId={ticketId}
                    displayedTimelineAnalysis={displayedTimelineAnalysis}
                    setDisplayedTimelineAnalysis={setDisplayedTimelineAnalysis}
                  />
                  <AnalysisColumnItem
                    name="numbers"
                    icon={faListOl}
                    id="numbers"
                    status={status}
                    ticketId={ticketId}
                    displayedTimelineAnalysis={displayedTimelineAnalysis}
                    setDisplayedTimelineAnalysis={setDisplayedTimelineAnalysis}
                  />
                  <AnalysisColumnItem
                    name="Difficult Words"
                    icon={faBrain}
                    id="difficult_words"
                    status={status}
                    ticketId={ticketId}
                    displayedTimelineAnalysis={displayedTimelineAnalysis}
                    setDisplayedTimelineAnalysis={setDisplayedTimelineAnalysis}
                  />
                  <AnalysisColumnItem
                    name="Long Sentences"
                    icon={faRuler}
                    id="long_sentences"
                    status={status}
                    ticketId={ticketId}
                    displayedTimelineAnalysis={displayedTimelineAnalysis}
                    setDisplayedTimelineAnalysis={setDisplayedTimelineAnalysis}
                  />
                  <AnalysisColumnItem
                    name="Audio Gaps"
                    icon={faArrowsLeftRightToLine}
                    id="silence"
                    status={status}
                    ticketId={ticketId}
                    displayedTimelineAnalysis={displayedTimelineAnalysis}
                    setDisplayedTimelineAnalysis={setDisplayedTimelineAnalysis}
                  />
                  <AnalysisColumnItem
                    name="Repetition"
                    icon={faRepeat}
                    id="repetition"
                    status={status}
                    ticketId={ticketId}
                    displayedTimelineAnalysis={displayedTimelineAnalysis}
                    setDisplayedTimelineAnalysis={setDisplayedTimelineAnalysis}
                  />
                  <AnalysisColumnItem
                    name="Loud Speech"
                    icon={faVolumeHigh}
                    id="volume"
                    status={status}
                    ticketId={ticketId}
                    displayedTimelineAnalysis={displayedTimelineAnalysis}
                    setDisplayedTimelineAnalysis={setDisplayedTimelineAnalysis}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  );
}
