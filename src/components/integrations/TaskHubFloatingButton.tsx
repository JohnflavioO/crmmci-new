import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import TaskHubReportModal from "./TaskHubReportModal";
import { useAuth } from "@/hooks/useAuth";

export default function TaskHubFloatingButton() {
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Enviar para TaskHub"
        className="fixed bottom-20 right-5 md:bottom-6 md:right-6 z-50 h-12 w-12 md:h-14 md:w-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="Reportar bug, sugerir melhoria ou ideia"
      >
        <MessageSquarePlus className="h-5 w-5 md:h-6 md:w-6" />
      </button>
      <TaskHubReportModal open={open} onOpenChange={setOpen} />
    </>
  );
}
