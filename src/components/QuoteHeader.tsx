export default function QuoteHeader() {
  return (
    <div className="flex items-center gap-4 p-4 border-b bg-muted/30 rounded-t-lg">
      <img src="/mci-logo.png" alt="MCI Store" width={80} height={80} className="rounded" />
      <div className="text-sm space-y-0.5">
        <p className="font-bold text-base">MCI STORE</p>
        <p className="text-muted-foreground">CNPJ: 41.237.429/0001-67</p>
        <p className="text-muted-foreground">Rua Des. Lauro Nogueira, 1500 — Papicu, Fortaleza/CE</p>
        <p className="text-muted-foreground">(85) 98734-9599 | marketing@mcistore.com.br</p>
        <p className="text-muted-foreground">www.mcistore.com.br</p>
      </div>
    </div>
  );
}
