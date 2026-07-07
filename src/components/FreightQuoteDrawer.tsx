import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import FreightQuoteModule from './FreightQuoteModule';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contexto do orçamento aberto — reservado para futuras integrações
   *  (copiar valor, transportadora, prazo, histórico, anexo no PDF). */
  quoteContext?: {
    quoteId?: string;
    quoteNumber?: string;
  };
}

export default function FreightQuoteDrawer({ open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="p-0 w-full sm:max-w-[680px] sm:w-[80vw] flex flex-col gap-0"
        aria-describedby={undefined}
      >
        <SheetHeader className="px-5 py-3 border-b flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-base font-display">Cotação de Frete</SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0">
          <FreightQuoteModule />
        </div>
      </SheetContent>
    </Sheet>
  );
}
