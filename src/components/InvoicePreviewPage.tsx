import React, { useState, useMemo, useEffect, useRef } from "react";
import { cn } from "../lib/utils";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { 
  ArrowLeft, 
  Plus, 
  FileText, 
  Edit, 
  RefreshCw, 
  LayoutGrid, 
  List, 
  Users,
  Shield,
  X,
  Check
} from "../lib/icons/lucide";
import { useAuth } from "../context/AuthContext";
import { CollaboratorsSheet } from "./CollaboratorsSheet";
import { useSyncedStore } from "@syncedstore/react";
import { authStore, workspaceStore, connectWorkspace, workspaceProvider, authProvider } from "../store";
import { type DocData, type SummaryItem, type TableRow } from "../types";
import { api } from "../lib/api";
import { InvoicePage } from "./InvoicePage";
import { ReceiptPage } from "./ReceiptPage";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  computeTotalPrice as computeTotalPriceForData,
  getRowNumbering,
  calculateChunks,
  resolveSectionTotalBackward,
  resolveSectionTotal,
  resolveFormula as resolveFormulaUtil
} from "../lib/documentUtils";

const NOOP = () => {};

const A4_PX_WIDTH = 794;
const A4_PX_HEIGHT = 1123;

const usePagination = (data: DocData | null) => {
  const headerHeight = useMemo(() => Number(localStorage.getItem("headerHeight")) || 128, []);
  return useMemo(() => {
    if (!data) return [];
    const useSections = data.useSections ?? false;
    return calculateChunks(data, headerHeight, useSections);
  }, [data, headerHeight]);
};

interface ScaledInvoicePreviewProps {
  data: DocData;
  scale: number;
  page?: any;
  pageIndex: number;
}

const ScaledInvoicePreview: React.FC<ScaledInvoicePreviewProps> = ({
  data,
  scale,
  page,
  pageIndex,
}) => {
  const containerWidth = A4_PX_WIDTH * scale;
  const containerHeight = A4_PX_HEIGHT * scale;
  const totalPrice = useMemo(() => computeTotalPriceForData(data), [data]);
  const rowNumbering = useMemo(() => getRowNumbering(data.table.rows, data.useSections), [data]);
  const headerHeight = Number(localStorage.getItem("headerHeight")) || 128;
  const resolveSectionTotalBackwardWrapper = (rows: TableRow[], fromIdx: number) => 
    resolveSectionTotalBackward(rows, fromIdx, data);
  const resolveSectionTotalWrapper = (rows: TableRow[], fromIdx: number) => 
    resolveSectionTotal(rows, fromIdx, data);

  return (
    <div
      style={{
        width: containerWidth,
        height: containerHeight,
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
        boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: A4_PX_WIDTH,
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
      >
        <DndContext collisionDetection={closestCenter} onDragEnd={NOOP}>
        {data.isReceipt ? (
          <ReceiptPage
            data={data}
            rows={page?.rows || data.table.rows}
            pageIndex={pageIndex}
            totalPrice={totalPrice}
            headerImage=""
            headerHeight={headerHeight}
            onHeaderResize={NOOP}
            isFirstPage={pageIndex === 0}
            isLastPage={false}
            startIndex={page?.startIndex || 0}
            onUpdateContact={NOOP}
            onUpdateTitle={NOOP}
            onUpdateCell={NOOP}
            onRemoveRow={NOOP}
            onAddRowBelow={NOOP}
            onAddRowAbove={NOOP}
            onAddSectionBelow={NOOP}
            onAddSectionAbove={NOOP}
            onMoveRow={NOOP}
            onAddSubSectionBelow={NOOP}
            onAddSubSectionAbove={NOOP}
            useSections={data.useSections ?? false}
            resolveFormula={resolveFormulaUtil}
            onUpdateInvoiceCode={NOOP}
            onUpdateSummaryItem={NOOP}
            onUpdateDate={NOOP}
            showRows={page ? page.showRows : true}
            showTotals={page ? page.showTotals : true}
            showFooter={page ? page.showFooter : true}
            isPreview={true}
            isEndOfRows={page ? page.isEndOfRows : true}
            rowNumbering={rowNumbering}
            resolveSectionTotalBackward={resolveSectionTotalBackwardWrapper}
            resolveSectionTotal={resolveSectionTotalWrapper}
            onUpdatePaymentMethod={NOOP}
            onUpdateTransactionId={NOOP}
            onUpdateReference={NOOP}
            onUpdateSignature={NOOP}
            onUpdateReceiptMessage={NOOP}
            onHeaderImageUpload={NOOP}
            onUpdateTotalInvoiceAmount={NOOP}
            onUpdateAmountPaid={NOOP}
            onUpdateOutstandingBalance={NOOP}
            onUpdateAcknowledgement={NOOP}
          />
        ) : (
          <InvoicePage
            data={data}
            rows={page?.rows || data.table.rows}
            pageIndex={pageIndex}
            totalPrice={totalPrice}
            headerImage=""
            headerHeight={headerHeight}
            onHeaderResize={NOOP}
            isFirstPage={pageIndex === 0}
            isLastPage={false}
            startIndex={page?.startIndex || 0}
            onUpdateContact={NOOP}
            onUpdateTitle={NOOP}
            onUpdateCell={NOOP}
            onRemoveRow={NOOP}
            onAddRowBelow={NOOP}
            onAddRowAbove={NOOP}
            onAddSectionBelow={NOOP}
            onAddSectionAbove={NOOP}
            onMoveRow={NOOP}
            onAddSubSectionBelow={NOOP}
            onAddSubSectionAbove={NOOP}
            useSections={data.useSections ?? false}
            resolveFormula={resolveFormulaUtil}
            onUpdateInvoiceCode={NOOP}
            onUpdateSummaryItem={NOOP}
            onUpdateDate={NOOP}
            showRows={page ? page.showRows : true}
            showTotals={page ? page.showTotals : true}
            showFooter={page ? page.showFooter : true}
            isPreview={true}
            isEndOfRows={page ? page.isEndOfRows : true}
            rowNumbering={rowNumbering}
            resolveSectionTotalBackward={resolveSectionTotalBackwardWrapper}
            resolveSectionTotal={resolveSectionTotalWrapper}
            onUpdatePaymentMethod={NOOP}
            onUpdateTransactionId={NOOP}
            onUpdateReference={NOOP}
            onUpdateSignature={NOOP}
            onUpdateReceiptMessage={NOOP}
            onUpdateTotalInvoiceAmount={NOOP}
            onUpdateAmountPaid={NOOP}
            onUpdateOutstandingBalance={NOOP}
            onUpdateAcknowledgement={NOOP}
          />
        )}
        </DndContext>
      </div>
    </div>
  );
};

const ModalPreviewer: React.FC<{
  data: DocData;
  pages: any[];
  initialIndex: number;
  onClose: () => void;
}> = ({ data, pages, initialIndex, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && initialIndex > 0) {
      const target = containerRef.current.children[initialIndex] as HTMLElement;
      if (target) {
        target.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
      }
    }
  }, [initialIndex]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * 0.01;
      setZoom(prev => Math.min(Math.max(0.4, prev + delta), 3));
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex flex-col bg-gray-900/60 p-4 animate-in fade-in duration-200 overflow-hidden backdrop-blur-md"
      onWheel={handleWheel}
    >
      <div className="flex items-center justify-between px-6 py-4 shrink-0 pointer-events-auto">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/20 text-white transition-all shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white uppercase tracking-widest select-none leading-none">
              Preview Mode
            </span>
            <span className="text-[10px] font-medium text-white/70 uppercase tracking-widest mt-1">
              {pages.length} {pages.length === 1 ? "Page" : "Pages"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-card/95 backdrop-blur-md border border-border rounded-lg p-1 shadow-xl">
           <button onClick={() => setZoom(prev => Math.max(0.4, prev - 0.1))} className="p-2 hover:bg-muted rounded text-foreground text-sm font-bold w-9">-</button>
           <span className="px-3 text-[10px] font-black text-muted-foreground min-w-[60px] text-center select-none">{Math.round(zoom * 100)}%</span>
           <button onClick={() => setZoom(prev => Math.min(3, prev + 0.1))} className="p-2 hover:bg-muted rounded text-foreground text-sm font-bold w-9">+</button>
           <div className="w-px h-4 bg-border mx-1" />
           <button onClick={() => setZoom(1)} className="px-3 py-1.5 hover:bg-accent rounded text-[10px] font-black uppercase text-primary">100%</button>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 flex gap-12 p-12 overflow-x-auto overflow-y-auto items-start snap-x custom-scrollbar"
      >
        {pages.map((page, idx) => (
          <div 
            key={idx} 
            className="flex flex-col items-center gap-6 shrink-0 snap-center transition-transform duration-300"
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
          >
            <div className="bg-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-black/5 relative">
              <ScaledInvoicePreview data={data} scale={0.9} page={page} pageIndex={idx} />
            </div>
            <div className="bg-black/20 px-4 py-1.5 rounded-full backdrop-blur-md">
              <span className="text-white font-bold uppercase tracking-[0.3em] text-[10px]">
                Page {idx + 1}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const InvoicePreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromFolder = location.state?.fromFolder;
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | null>(null);

  const workspaceAction = useSyncedStore(workspaceStore);
  const authAction = useSyncedStore(authStore);
  const { user: currentUser } = useAuth();

  const [connectedClients, setConnectedClients] = useState<any[]>([]);
  const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);

  useEffect(() => {
    if (currentUser?.email && authAction.bannedClients?.includes(currentUser.email)) {
      navigate("/denied");
    }
  }, [authAction.bannedClients, currentUser, navigate]);

  const { businessId } = useAuth();
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);

  useEffect(() => {
    if (!currentUser || !businessId) return;

    let cleanup: (() => void) | undefined;

    const startSync = async () => {
      const token = await currentUser.getIdToken();
      const providers = connectWorkspace(businessId, token);
      
      const updatePresence = () => {
        const states = providers.authProvider.awareness?.getStates();
        if (!states) return;
        const clients: any[] = [];
        states.forEach((state: any, clientId: number) => {
          if (state.user && state.user.email) {
            clients.push({ id: clientId.toString(), user: state.user });
          }
        });
        setConnectedClients(clients);
      };

      providers.authProvider.awareness?.on('change', updatePresence);
      providers.authProvider.awareness?.setLocalStateField('user', { 
        name: currentUser.displayName || "Anonymous",
        email: currentUser.email || "guest@system.com",
        photo: currentUser.photoURL,
        id: currentUser.uid,
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
      });

      setIsWorkspaceReady(true);
      cleanup = () => {
        providers.authProvider.awareness?.off('change', updatePresence);
      };
    };

    startSync();
    return () => cleanup?.();
  }, [currentUser, businessId]);

  const invoiceDoc = workspaceAction.documents?.find((d: any) => d.id === id);
  const receipts = workspaceAction.documents?.filter((d: any) => d.folderId === null && (d as any).invoiceId === id) || [];
  const isLoading = !invoiceDoc;

  const docContent = invoiceDoc?.content || null;
  const pages = usePagination(docContent);

  const sortedReceipts = useMemo(() => {
    return [...receipts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [receipts]);

  const invoiceGrandTotal = useMemo(() => {
    if (!docContent) return 0;
    return computeTotalPriceForData(docContent).grandTotal;
  }, [docContent]);

  const totalPaid = useMemo(() => {
    return sortedReceipts.reduce((sum, r) => sum + (r.content.amountPaid || 0), 0);
  }, [sortedReceipts]);

  const totalOutstanding = Math.max(0, invoiceGrandTotal - totalPaid);
  const [isCreatingReceipt, setIsCreatingReceipt] = useState(false);

  const handleAddReceipt = async () => {
    if (!invoiceDoc) return;
    const invoice = invoiceDoc.content;
    const prevReceipt = sortedReceipts[sortedReceipts.length - 1];
    const isFirst = sortedReceipts.length === 0;
    const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const receiptNumber = api.getNextReceiptNumber();
    const totalInvoiceAmount = isFirst ? invoiceGrandTotal : Math.max(0, (prevReceipt.content.totalInvoiceAmount || 0) - (prevReceipt.content.amountPaid || 0));

    const receiptData: DocData = {
      isReceipt: true,
      contact: {
        name: prevReceipt ? prevReceipt.content.contact.name : invoice.contact.name,
        address1: prevReceipt ? prevReceipt.content.contact.address1 : invoice.contact.address1,
        address2: invoice.contact.address2,
      },
      title: prevReceipt ? prevReceipt.content.title : invoice.title,
      date: now,
      table: invoice.table,
      footer: invoice.footer,
      invoiceCode: { text: receiptNumber, prefix: "REC", count: receiptNumber.split("/")[2], year: receiptNumber.split("/")[3], x: 600, y: 100, color: "#503D36" },
      reference: invoice.invoiceCode?.text || "",
      totalInvoiceAmount,
      amountPaid: 0,
      outstandingBalance: totalInvoiceAmount,
      transactionId: "TRX-000000000",
      paymentMethod: prevReceipt ? prevReceipt.content.paymentMethod : "Transfer",
      acknowledgement: prevReceipt ? prevReceipt.content.acknowledgement : "I hereby acknowledge receipt of the above payment.",
      signature: prevReceipt ? prevReceipt.content.signature : undefined,
      receiptMessage: prevReceipt ? prevReceipt.content.receiptMessage : "Thank you for your patronage!",
    };

    setIsCreatingReceipt(true);
    try {
      const newDoc = await api.createDocument(receiptNumber, receiptData, null);
      (newDoc as any).invoiceId = id;
      navigate(`/receipt-editor/${newDoc.id}`);
    } finally { setIsCreatingReceipt(false); }
  };

  if (isLoading || !invoiceDoc) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <RefreshCw className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const docContentSafe = invoiceDoc.content;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-lexend transition-colors duration-300">
      <header className="h-14 border-b border-border bg-card flex items-center gap-2 px-6 shrink-0 shadow-sm z-10">
        <button
          onClick={() => navigate(fromFolder ? `/dashboard?folder=${fromFolder}` : "/dashboard")}
          className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all uppercase tracking-widest shrink-0"
        >
          <ArrowLeft size={13} /> {fromFolder ? "Back to Folder" : "All Files"}
        </button>
        <span className="text-muted-foreground/30 font-thin text-base">/</span>
        {docContentSafe.invoiceCode?.text && (
          <>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-primary/10 text-primary tracking-wider shrink-0 font-lexend">
              {docContentSafe.invoiceCode.text}
            </span>
            <span className="text-muted-foreground/30 font-thin text-base">/</span>
          </>
        )}
        <span className="text-xs font-semibold text-foreground/80 truncate">
          {invoiceDoc.name}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setIsCollaboratorsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground rounded-md hover:bg-accent hover:text-foreground transition-all text-[10px] font-bold uppercase tracking-widest shadow-sm relative group"
          >
            <Users size={12} />
            {connectedClients.length > 1 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border border-background" />
            )}
            Collabs
          </button>
          <button
            onClick={() => navigate(`/editor/${id}`, { state: { fromFolder } })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-all text-[10px] font-bold uppercase tracking-widest shadow-sm"
          >
            <Edit size={12} /> Edit Document
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-7 min-w-0 bg-muted/20">
          <div className="bg-card rounded-xl shadow-sm p-6 transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h1 className="text-base font-bold text-foreground leading-tight">{invoiceDoc.name}</h1>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">{docContentSafe.title}</p>
              </div>
              {docContentSafe.invoiceCode?.text && (
                <span className="px-3 py-1.5 rounded-full text-xs font-black bg-primary/10 text-primary tracking-wider shrink-0 ml-4">
                  {docContentSafe.invoiceCode.text}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-5">
              {[
                { label: "Date Created", value: new Date(invoiceDoc.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
                { label: "Created By", value: "Olamide" },
                { label: "Client", value: docContentSafe.contact.name },
                { label: "Invoice Date", value: docContentSafe.date }
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">{item.label}</span>
                  <span className="text-xs font-semibold text-foreground/80 truncate">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4 pt-5">
              <div className="p-4 rounded-xl bg-muted flex flex-col gap-1.5 shadow-sm">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Total Invoice</span>
                <span className="text-lg font-black text-foreground">₦{Math.round(invoiceGrandTotal).toLocaleString()}</span>
              </div>
              <div className="p-4 rounded-xl bg-success/10 flex flex-col gap-1.5 text-success shadow-sm">
                <span className="text-[9px] uppercase tracking-widest font-bold">Payments Received</span>
                <span className="text-lg font-black">₦{Math.round(totalPaid).toLocaleString()}</span>
              </div>
              <div className={cn("p-4 rounded-xl flex flex-col gap-1.5 shadow-sm", totalOutstanding > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>
                <span className="text-[9px] uppercase tracking-widest font-bold">Outstanding Balance</span>
                <span className="text-lg font-black">₦{Math.round(totalOutstanding).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 pb-12">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Invoice Pages ({pages.length})</h2>
            <div className="flex flex-wrap gap-4">
              {pages.map((page, idx) => (
                <div key={idx} className="flex flex-col gap-2 group">
                  <div onClick={() => setSelectedPageIndex(idx)} className="cursor-pointer transition-all hover:scale-[1.02] active:scale-100 shadow-lg rounded-lg overflow-hidden">
                    <ScaledInvoicePreview data={docContentSafe} scale={0.3} page={page} pageIndex={idx} />
                  </div>
                  <div className="flex items-center justify-center p-2"><span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">P.{idx + 1}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="w-[380px] bg-card flex flex-col no-print">
          <div className="p-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Payments</h3>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{sortedReceipts.length} receipts</p>
            </div>
            <button onClick={handleAddReceipt} disabled={isCreatingReceipt} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all disabled:opacity-50">
              <Plus size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/5">
            {sortedReceipts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center h-full opacity-60">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground"><FileText size={20} /></div>
                <p className="text-xs font-bold text-foreground uppercase tracking-widest">No receipts yet</p>
              </div>
            ) : (
              sortedReceipts.map((receipt) => (
                <button
                  key={receipt.id}
                  onClick={() => navigate(`/receipt-editor/${receipt.id}`)}
                  className="w-full flex items-center gap-4 p-4 bg-card rounded-xl hover:bg-muted/50 shadow-sm hover:shadow-md transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors"><FileText size={18} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold text-foreground/90 truncate">{receipt.name}</span>
                      <span className="text-xs font-black text-primary">₦{(receipt.content.amountPaid || 0).toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{receipt.content.date}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>

      {selectedPageIndex !== null && (
        <ModalPreviewer data={docContentSafe} pages={pages} initialIndex={selectedPageIndex} onClose={() => setSelectedPageIndex(null)} />
      )}

      <CollaboratorsSheet
        isOpen={isCollaboratorsOpen} onClose={() => setIsCollaboratorsOpen(false)}
        collaborators={connectedClients} ownerId={authAction.governance.ownerId || null}
        bannedClients={authAction.bannedClients}
        onBanClient={(email) => { if (!authAction.bannedClients.includes(email)) authAction.bannedClients.push(email); }}
        onMakeOwner={(email) => { authAction.governance.ownerId = email; }}
      />
    </div>
  );
};

export default InvoicePreviewPage;
