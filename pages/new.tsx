import { useRouter } from "next/router";
import { useState } from "react";
import DropArea from "@/components/drop-area";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { setVideoToUpload } from "./status/[ticket-id]";

export default function Page() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    try {
      // Create a new ticket
      const ticketResponse = await fetch("/api/ticket/new", { method: "POST" });
      const ticketData = await ticketResponse.json();
      const ticketId = ticketData["ticket-id"];

      if (!ticketId) throw new Error();

      // Prepare the video to be uploaded by the ticket status page
      setVideoToUpload(file);

      // Redirect to the ticket status page
      router.push(`/status/${ticketId}`);
    } catch (error: any) {
      setError("Failed to create a ticket.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-grow p-10">
      <div className="text-7xl mb-16 font-bold text-center">
        Analyze a Video
      </div>
      <DropArea
        onFileSelect={(files: FileList) => {
          handleFileSelect(files[0]);
        }}
      />
      {error && (
        <Alert
          variant="destructive"
          className="absolute px-8 bottom-16"
          style={{
            width: "550px",
            maxWidth: "calc(100% - 80px)",
            marginTop: "20px",
          }}
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
