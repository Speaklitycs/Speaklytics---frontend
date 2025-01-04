import * as React from "react";
import { cn } from "@/lib/utils";

export interface VideoStreamProps extends React.HTMLAttributes<HTMLDivElement> {
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  ticketId: string;
}

export default function VideoStream({
  videoRef,
  className,
  ticketId,
  ...props
}: VideoStreamProps) {
  if (!videoRef) {
    videoRef = React.useRef<HTMLVideoElement>(null);
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md w-full aspect-video"
      )}
      {...props}
    >
      <video
        ref={videoRef}
        src={`/api/ticket/video?ticket-id=${ticketId}`}
        className="rounded-md w-full aspect-video"
        controls={false}
        // autoPlay
      />
    </div>
  );
}
