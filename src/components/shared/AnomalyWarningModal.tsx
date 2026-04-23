import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface AnomalyWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  value: number;
  expectedRange: { min: number; max: number };
}

export function AnomalyWarningModal({ isOpen, onClose, onConfirm, value, expectedRange }: AnomalyWarningModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <DialogTitle>Valor fora do comum</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Este lançamento de <span className="font-bold text-foreground">{formatCurrency(value)}</span> é muito superior ao habitual para esta categoria (faixa comum: {formatCurrency(expectedRange.min)} a {formatCurrency(expectedRange.max)}).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} className="flex-1">Revisar</Button>
          <Button variant="destructive" onClick={onConfirm} className="flex-1">Confirmar assim mesmo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
