import React, { useState } from "react";
import { API_BASE } from "../lib/workspace-persist";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  FileText, 
  Shield, 
  Trash2, 
  Download, 
  Plus, 
  CheckCircle2, 
  Clock,
  Ban,
  MoreVertical,
  History,
  Info,
  Eye,
  RotateCw,
  X
} from "../lib/icons/lucide";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "../lib/utils";
import { formatDate, computeTotalPrice, resolveFormula, resolveSectionTotal, resolveSectionTotalBackward, calculateChunks, getRowNumbering } from "../lib/documentUtils";
import { InvoicePage } from "./InvoicePage";

const InvoiceManagementPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: invoiceResult, isLoading } = useQuery({
    queryKey: ['invoice-management', id],
    queryFn: () => api.getInvoiceManagement(id!),
    enabled: !!id
  });


  // No versions anymore, simplified state


  const createReceiptMutation = useMutation({
    mutationFn: () => api.createReceipt(id!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-management', id] });
      navigate(`/receipt-editor/${result.id}`);
    },
    onError: (err: any) => {
      alert(`Failed to create receipt: ${err.message || err}`);
    }
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: (rid: string) => api.deleteReceipt(rid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-management', id] });
    },
    onError: (err: any) => {
      alert(`Failed to delete receipt: ${err.message || err}`);
    }
  });

  if (isLoading || !invoiceResult) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const { 
    grandTotal, 
    totalPaid, 
    outstanding, 
    status, 
    name, 
    draft, 
    receipts = [],
    chain = []
  } = invoiceResult;

  return (
    <div className="min-h-screen bg-muted/20 font-lexend text-foreground flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border bg-card flex items-center px-8 shrink-0 sticky top-0 z-20">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground mr-4"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-black uppercase tracking-widest truncate">{name || "Untitled Invoice"}</h1>
            <span className={cn(
              "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
              status === 'active' ? "bg-success/10 text-success" : 
              status === 'voided' ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            )}>
              {status}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight mt-0.5">
            ID: {id} • {receipts.length} receipts
          </p>
        </div>
        <div className="flex items-center gap-3">
           <button
            onClick={() => navigate(`/editor/${id}`)}
            className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-all text-[10px] font-bold uppercase tracking-widest border border-border"
          >
            Open Editor
          </button>
          {status === 'locked' && (
            <div className="flex items-center gap-2 bg-warning/10 text-warning px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-warning/20">
              <Shield size={14} /> Read Only
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full flex flex-col gap-8 pb-20">
        
        {/* Core Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <FileText size={80} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Total Amount</span>
            <div className="text-3xl font-black tabular-nums flex items-baseline gap-1">
              <span className="text-muted-foreground font-medium text-2xl">₦</span>
              {Math.round(grandTotal).toLocaleString()}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 w-fit px-2 py-1 rounded">
               <Info size={12} /> Expected Total
            </div>
          </div>
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-success">
               <CheckCircle2 size={80} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Total Received</span>
            <div className="text-3xl font-black text-success tabular-nums flex items-baseline gap-1">
              <span className="text-success/60 font-medium text-2xl">₦</span>
              {Math.round(totalPaid).toLocaleString()}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-success uppercase tracking-widest bg-success/10 w-fit px-2 py-1 rounded">
               {receipts.length} Finalised Receipts
            </div>
          </div>
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-warning">
               <Clock size={80} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Outstanding</span>
            <div className={cn("text-3xl font-black tabular-nums flex items-baseline gap-1", outstanding > 0 ? "text-warning" : "text-success")}>
              <span className={cn("font-medium text-2xl", outstanding > 0 ? "text-warning/60" : "text-success/60")}>₦</span>
              {Math.round(outstanding).toLocaleString()}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
               {outstanding > 0 ? (
                 <span className="bg-warning/10 text-warning px-2 py-1 rounded flex items-center gap-1.5">< Ban size={12} /> Pending Balance</span>
               ) : (
                 <span className="bg-success/10 text-success px-2 py-1 rounded flex items-center gap-1.5"><CheckCircle2 size={12} /> Fully Settled</span>
               )}
            </div>
          </div>
        </div>

        {/* Versions Table Removed */}

        {/* Receipts Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <FileText size={16} /> Linked Receipts
            </h2>
            <button
              onClick={() => createReceiptMutation.mutate()}
              disabled={createReceiptMutation.isPending}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={14} /> {createReceiptMutation.isPending ? 'Creating...' : 'New Receipt'}
            </button>
          </div>
          
          {/* Active Drafts Section */}
          {receipts.some((r: any) => r.status === 'draft') && (
            <div className="mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                <Clock size={12} /> Live Drafts
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {receipts
                  .filter((r: any) => r.status === 'draft')
                  .map((r: any) => (
                    <div 
                      key={r.id} 
                      className="bg-primary/5 border border-primary/20 p-5 rounded-xl shadow-sm hover:shadow-md transition-all group flex items-start gap-4"
                    >
                      <div 
                        onClick={() => navigate(`/receipt-editor/${r.id}`)}
                        className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors cursor-pointer"
                      >
                        <Plus size={20} />
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => navigate(`/receipt-editor/${r.id}`)}>
                        <div className="flex items-center justify-between mb-1 cursor-pointer">
                          <span className="text-xs font-black">Draft Receipt</span>
                          <span className="text-[8px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase tracking-tighter">In Progress</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest cursor-pointer">Last updated {formatDate(r.updatedAt)}</p>
                        <div className="mt-2 text-[10px] font-black text-primary uppercase tracking-widest group-hover:underline underline-offset-4 cursor-pointer">Continue Editing →</div>
                      </div>
                      <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           if (confirm("Are you sure you want to delete this draft receipt?")) {
                             deleteReceiptMutation.mutate(r.id);
                           }
                         }}
                         className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                         title="Delete Draft"
                      >
                         <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chain.map((rv: any) => (
              <div key={rv.receiptId} className="bg-card border border-border p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-success/10 text-success text-[8px] font-black px-3 py-1 rounded-bl-lg uppercase tracking-widest">
                  #{rv.sequence}
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                    <FileText size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black">Receipt {rv.sequence}</span>
                      <span className="text-xs font-black text-success">₦{rv.amountPaid.toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {formatDate(rv.publishedAt)} • {rv.publisherName || "System"}
                    </p>
                    
                    <div className="mt-4 flex items-center gap-4 bg-muted/30 p-2 rounded-lg border border-border/50">
                       <div className="flex-1 flex flex-col gap-0.5">
                          <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">Remaining Before</span>
                          <span className="text-[10px] font-bold italic">₦{rv.remainingBefore.toLocaleString()}</span>
                       </div>
                       <div className="w-px h-6 bg-border" />
                       <div className="flex-1 flex flex-col gap-0.5 text-right">
                          <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">Remaining After</span>
                          <span className="text-[10px] font-bold text-success">₦{rv.remainingAfter.toLocaleString()}</span>
                       </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button 
                         onClick={async () => {
                           if (confirm("Are you sure you want to void this receipt? This action cannot be undone.")) {
                              try {
                                await api.voidReceipt(rv.receiptId);
                                queryClient.invalidateQueries({ queryKey: ['invoice-management', id] });
                              } catch (e: any) {
                                alert(`Failed to void: ${e.message}`);
                              }
                           }
                         }}
                         className="text-[10px] font-black text-destructive uppercase tracking-widest flex items-center gap-1 hover:underline"
                      >
                         <Trash2 size={12}/> Void Receipt
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {chain.length === 0 && (
              <div className="col-span-full border border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-muted-foreground opacity-40">
                <FileText size={32} />
                <span className="mt-2 text-[10px] font-black uppercase tracking-[0.2em]">No finalized receipts</span>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
};

export default InvoiceManagementPage;
