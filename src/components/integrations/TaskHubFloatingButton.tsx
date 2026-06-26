import { useState } from "react";
import { MessageSquarePlus, Zap } from "lucide-react";
import TaskHubReportModal from "./TaskHubReportModal";
import { useAuth } from "@/hooks/useAuth";
import { sendReportToTaskHub } from "@/lib/taskhubClient";
import { toast } from "sonner";

export default function TaskHubFloatingButton() {
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const { user, loading, profile } = useAuth();

  if (loading || !user) return null;

  const isAdmin = profile?.role === "admin";

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await sendReportToTaskHub({
        type: "bug",
        title: "Teste de integração",
        description: "Teste automático CRM MCI → TaskHub",
        priority: "medium",
        module: "Dashboard",
        source_app: "crm-mci",
        context: {
          user_id: user.id,
          user_name: profile?.full_name ?? "Teste CRM",
          user_email: user.email ?? "teste@crm.com",
          user_role: profile?.role ?? null,
          test: true,
        } as any,
      });
      const data = result.data as any;
      if (result.ok && !data?.mock) {
        const id = data?.card_id || data?.taskhub?.card_id || data?.taskhub?.id;
        toast.success(`✅ TaskHub OK — card #${id}`, {
          description: `Endpoint: ${data?.endpoint ?? "—"}`,
          duration: 10000,
        });
      } else if (data?.mock) {
        toast.warning("Mock mode (secrets/URL inválidos).", { duration: 8000 });
      } else {
        toast.error(data?.message || result.error || "Falha no teste", {
          description: `Endpoint: ${data?.endpoint ?? "—"} • status ${data?.upstream_status ?? "?"}`,
          duration: 12000,
        });
        console.error("[TaskHub Test] full response:", data);
      }
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      {isAdmin && (
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          aria-label="Testar integração TaskHub"
          className="fixed bottom-36 right-5 md:bottom-24 md:right-6 z-50 h-10 px-3 rounded-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-medium shadow-lg flex items-center gap-1.5 transition-all"
          title="Testar integração TaskHub (admin)"
        >
          <Zap className="h-3.5 w-3.5" />
          {testing ? "Testando..." : "Testar TaskHub"}
        </button>
      )}
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
