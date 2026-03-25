
/**
 * FinanceAI — Portfolio & Assets Page
 * 
 * Gerencia ativos e patrimônio líquido:
 * - Visão consolidada (NetWorthDashboard)
 * - Lista de Ativos (AssetsList)
 * - CRUD de novos ativos
 * - Histórico de valorização
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { NetWorthDashboard } from "@/components/assets/NetWorthDashboard";
import { getNetWorthSummary, getAssets, createAsset, deleteAsset, AssetType } from "@/services/assetService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Home, Car, TrendingUp, Bitcoin, Wallet, MoreHorizontal, Landmark, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TYPE_ICONS: Record<string, any> = {
  real_estate: Home,
  vehicle: Car,
  stock: TrendingUp,
  crypto: Bitcoin,
  fixed_income: Landmark,
  cash: Wallet,
  other: MoreHorizontal
};

const TYPE_LABELS: Record<string, string> = {
  real_estate: 'Imóveis',
  vehicle: 'Veículos',
  stock: 'Ações/Bolsa',
  crypto: 'Criptoativos',
  fixed_income: 'Renda Fixa',
  cash: 'Liquidez/Caixa',
  other: 'Outros'
};

export default function Portfolio() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({
    nome: '',
    tipo: 'stock' as AssetType,
    valor_atual: 0,
    valor_aquisicao: 0,
    instituicao: ''
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['net-worth-summary'],
    queryFn: getNetWorthSummary
  });

  const { data: assets = [], isLoading: loadingAssets } = useQuery({
    queryKey: ['assets'],
    queryFn: getAssets
  });

  const createMutation = useMutation({
    mutationFn: createAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });
      toast.success("Ativo adicionado com sucesso!");
      setIsAddOpen(false);
      setNewAsset({ nome: '', tipo: 'stock', valor_atual: 0, valor_aquisicao: 0, instituicao: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });
      toast.success("Ativo removido.");
    }
  });

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.nome || newAsset.valor_atual <= 0) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    createMutation.mutate(newAsset);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader 
        title="Patrimônio e Investimentos" 
        description="Gestão de ativos, valorização e patrimônio líquido consolidado"
      />

      {loadingSummary ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : summary && (
        <NetWorthDashboard summary={summary} />
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Seus Ativos</h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Novo Ativo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Ativo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddAsset} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Ativo</Label>
                <Input 
                  id="nome" 
                  placeholder="Ex: Apartamento, Ações PETR4, Tesla Model 3" 
                  value={newAsset.nome}
                  onChange={e => setNewAsset({...newAsset, nome: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select 
                    value={newAsset.tipo} 
                    onValueChange={v => setNewAsset({...newAsset, tipo: v as AssetType})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor_atual">Valor Atual (R$)</Label>
                  <Input 
                    id="valor_atual" 
                    type="number" 
                    value={newAsset.valor_atual}
                    onChange={e => setNewAsset({...newAsset, valor_atual: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor_aquisicao">Valor de Aquisição (R$)</Label>
                  <Input 
                    id="valor_aquisicao" 
                    type="number" 
                    value={newAsset.valor_aquisicao}
                    onChange={e => setNewAsset({...newAsset, valor_aquisicao: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instituicao">Instituição / Local</Label>
                  <Input 
                    id="instituicao" 
                    placeholder="Ex: XP, Binance, Garagem" 
                    value={newAsset.instituicao}
                    onChange={e => setNewAsset({...newAsset, instituicao: e.target.value})}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adicionando..." : "Salvar Ativo"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loadingAssets ? (
          <p className="text-muted-foreground col-span-full text-center py-8">Carregando ativos...</p>
        ) : assets.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Você ainda não possui ativos cadastrados.</p>
              <p className="text-xs text-muted-foreground mt-1">Adicione imóveis, veículos ou investimentos para ver seu patrimônio crescer.</p>
            </CardContent>
          </Card>
        ) : assets.map(asset => {
          const Icon = TYPE_ICONS[asset.tipo] || MoreHorizontal;
          const valorizacao = asset.valor_atual - asset.valor_aquisicao;
          const percentual = asset.valor_aquisicao > 0 ? (valorizacao / asset.valor_aquisicao) * 100 : 0;

          return (
            <Card key={asset.id} className="overflow-hidden group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 space-y-0">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <Icon className="w-5 h-5" />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                    onClick={() => deleteMutation.mutate(asset.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="mt-3">
                  <CardTitle className="text-base font-bold truncate">{asset.nome}</CardTitle>
                  <p className="text-xs text-muted-foreground">{TYPE_LABELS[asset.tipo]}</p>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Valor Atual</p>
                    <p className="text-xl font-bold">{formatCurrency(asset.valor_atual)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-bold flex items-center gap-1 ${valorizacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {valorizacao >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {percentual.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">vs Aquisição</p>
                  </div>
                </div>
                {asset.instituicao && (
                  <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
                    <Landmark className="w-3 h-3" /> {asset.instituicao}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TrendingDown(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  )
}
