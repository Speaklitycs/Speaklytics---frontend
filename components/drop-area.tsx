import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloudArrowUp } from "@fortawesome/free-solid-svg-icons";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import styles from "./drop-area.module.css"; // Import the CSS module

export interface DropAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  onFileSelect?: (files: FileList) => void;
  multipleFiles?: boolean;
  acceptFiles?: string;
}

export default function DropArea({
  className,
  onFileSelect,
  multipleFiles = false,
  acceptFiles = "video/*",
  ...props
}: DropAreaProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && onFileSelect) {
      onFileSelect(event.target.files);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsHovered(false);
    if (event.dataTransfer.files && onFileSelect) {
      onFileSelect(event.dataTransfer.files);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsHovered(true);
  };

  const handleDragLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-1 rounded-md",
        styles["wrapper"]
      )}
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center bg-background border border-dashed rounded-md px-20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          isHovered && "bg-primary-foreground border-transparent",
          className
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        {...props}
      >
        <div className="flex flex-col items-center justify-center aspect-video p-20">
          <input
            type="file"
            ref={inputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
            multiple={multipleFiles}
            accept={acceptFiles}
          />
          <FontAwesomeIcon icon={faCloudArrowUp} size="3x" />
          <p className="mt-2 text-center text-sm text-secondary-foreground">
            Drag & drop a video file here,
            <br />
            or click the button below to upload
          </p>
          <Button onClick={handleButtonClick} className="mt-4">
            Upload a file
          </Button>
        </div>
      </div>
    </div>
  );
}
