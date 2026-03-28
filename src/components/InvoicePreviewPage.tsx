import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, FileText, Edit, RefreshCw, LayoutGrid, List } from "../lib/icons/lucide";
import { api } from "../lib/api";
import { DocData, TableRow, TotalPrice } from "../types";
import { InvoicePage } from "./InvoicePage";
import { ReceiptPage } from "./ReceiptPage";
import { cn } from "../lib/utils";
import { DndContext, closestCenter } from "@dnd-kit/core";

// ─── Formula resolution (mirrors Editor.tsx logic) ───────────────────────────

function resolveFormulaUtil(
  rowData: TableRow | Record<string, number>,
  formula: string | undefined,
  context: Record<string, number> = {},
): number {
  if (!formula) return 0;
  try {
    let expression = formula.replace(/(\d*\.?\d+)\s*%/g, "($1/100)");
    Object.keys(context).forEach((key) => {
      expression = expression.replace(
        new RegExp(`\\b${key}\\b`, "g"),
        String(Number(context[key]) || 0),
      );
    });
    const matches = formula.match(/[A-Z]+/g) || [];
    matches.forEach((cid) => {
      if (context[cid] !== undefined) return;
      expression = expression.replace(
        new RegExp(`\\b${cid}\\b`, "g"),
        String(Number((rowData as any)[cid]) || 0),
      );
    });
    const idMatches = formula.match(/[a-z][a-zA-Z0-9]+/g) || [];
    idMatches.forEach((mid) => {
      if (context[mid] !== undefined) return;
      expression = expression.replace(
        new RegExp(`\\b${mid}\\b`, "g"),
        String(Number((rowData as any)[mid]) || 0),
      );
    });
    if (/[^0-9\s+\-*/().]/.test(expression)) return 0;
    return new Function(`return ${expression}`)();
  } catch {
    return 0;
  }
}

function computeTotalPriceForData(data: DocData): TotalPrice {
  const subTotal = (data.table.rows || []).reduce((acc, row) => {
    if (
      row.rowType === "stage-header" ||
      row.rowType === "section-header" ||
      row.rowType === "section-total"
    )
      return acc;
    const totalCol = [...data.table.columns]
      .reverse()
      .find((c) => (c.type === "formula" || c.type === "number") && !c.hidden);
    const rowTotal =
      totalCol?.type === "formula"
        ? resolveFormulaUtil(row, totalCol.formula)
        : Number(row[totalCol?.id || ""]) || 0;
    return acc + rowTotal;
  }, 0);

  const summaries: any[] = [];
  let currentTotal = subTotal;
  (data.table.summary || []).forEach((item, idx) => {
    const displayId = String.fromCharCode(65 + idx);
    const val =
      item.type === "formula"
        ? resolveFormulaUtil({}, item.formula, { subTotal, prev: currentTotal })
        : Number(item.value) || 0;
    summaries.push({ ...item, calculatedValue: val, displayId });
    currentTotal += val;
  });

  return { subTotal, summaries, grandTotal: currentTotal };
}

function getRowNumbering(rows: TableRow[]): Record<string, string> {
  const numbering: Record<string, string> = {};
  rows.forEach((row, i) => {
    if (row.rowType === "row" || !row.rowType) {
      numbering[row.id as string] = String(i + 1);
    }
  });
  return numbering;
}

// ─── No-op handlers for read-only previews ───────────────────────────────────

const NOOP = () => {};

// ─── Scaled Invoice Preview ───────────────────────────────────────────────────

const A4_PX_WIDTH = 794;
const A4_PX_HEIGHT = 1123;

const ScaledInvoicePreview: React.FC<{ data: DocData; scale: number }> = ({
  data,
  scale,
}) => {
  const containerWidth = A4_PX_WIDTH * scale;
  const containerHeight = A4_PX_HEIGHT * scale;
  const totalPrice = useMemo(() => computeTotalPriceForData(data), [data]);
  const rowNumbering = useMemo(() => getRowNumbering(data.table.rows), [data]);
  const headerHeight = Number(localStorage.getItem("headerHeight")) || 128;

  return (
    <div
      style={{
        width: containerWidth,
        height: containerHeight,
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
        borderRadius: 10,
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
        <InvoicePage
          data={data}
          rows={data.table.rows}
          pageIndex={0}
          totalPrice={totalPrice}
          headerImage=""
          headerHeight={headerHeight}
          onHeaderResize={NOOP}
          isFirstPage={true}
          isLastPage={true}
          startIndex={0}
          onUpdateContact={NOOP}
          onUpdateTitle={NOOP}
          onUpdateCell={NOOP}
          onRemoveRow={NOOP}
          onAddRowBelow={NOOP}
          onAddRowAbove={NOOP}
          onAddSectionBelow={NOOP}
          onAddSectionAbove={NOOP}
          onMoveRow={NOOP}
          onAddStageBelow={NOOP}
          onAddStageAbove={NOOP}
          useStages={false}
          resolveFormula={resolveFormulaUtil}
          onUpdateInvoiceCode={NOOP}
          onUpdateSummaryItem={NOOP}
          onUpdateDate={NOOP}
          showRows={true}
          showTotals={true}
          showFooter={true}
          isPreview={true}
          isEndOfRows={true}
          rowNumbering={rowNumbering}
          resolveSectionTotal={() => 0}
          resolveStageTotal={() => 0}
          onUpdatePaymentMethod={NOOP}
          onUpdateTransactionId={NOOP}
          onUpdateReference={NOOP}
          onUpdateSignature={NOOP}
          onUpdateReceiptMessage={NOOP}
        />
        </DndContext>
      </div>
    </div>
  );
};

// ─── Amount formatter ─────────────────────────────────────────────────────────

function fmtAmount(n: number): string {
  if (n === 0) return "₦0";
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(n) >= 1_000) return `₦${Math.round(n / 1_000)}k`;
  return `₦${Math.round(n).toLocaleString()}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const InvoicePreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [receiptView, setReceiptView] = useState<"list" | "card">("list");

  const { data: invoiceDoc, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.getDocument(id!),
    enabled: !!id,
  });

  const { data: receipts = [], isLoading: isLoadingReceipts } = useQuery({
    queryKey: ["receipts-for-invoice", id],
    queryFn: () => api.getReceiptsForInvoice(id!),
    enabled: !!id,
  });

  const createReceiptMutation = useMutation({
    mutationFn: (receiptData: DocData) =>
      api.createReceiptDocument(receiptData, id!),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ["receipts-for-invoice", id] });
      navigate(`/receipt-editor/${newDoc.id}`);
    },
  });

  const invoiceGrandTotal = useMemo(() => {
    if (!invoiceDoc) return 0;
    return computeTotalPriceForData(invoiceDoc.content).grandTotal;
  }, [invoiceDoc]);

  const sortedReceipts = useMemo(
    () =>
      [...receipts].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [receipts],
  );

  const totalPaid = useMemo(
    () => sortedReceipts.reduce((sum, r) => sum + (r.content.amountPaid || 0), 0),
    [sortedReceipts],
  );

  const totalOutstanding = invoiceGrandTotal - totalPaid;

  const handleAddReceipt = () => {
    if (!invoiceDoc) return;
    const invoice = invoiceDoc.content;
    const prevReceipt = sortedReceipts[sortedReceipts.length - 1];
    const isFirst = sortedReceipts.length === 0;

    const now = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const receiptNumber = api.getNextReceiptNumber();

    // Compute totalInvoiceAmount for this receipt
    const totalInvoiceAmount = isFirst
      ? invoiceGrandTotal
      : Math.max(
          0,
          (prevReceipt.content.totalInvoiceAmount || 0) -
            (prevReceipt.content.amountPaid || 0),
        );

    const receiptData: DocData = {
      isReceipt: true,
      // Received From — inherit from previous receipt if exists, else from invoice
      contact: {
        name: prevReceipt
          ? prevReceipt.content.contact.name
          : invoice.contact.name,
        address1: prevReceipt
          ? prevReceipt.content.contact.address1
          : invoice.contact.address1,
        // Location always comes from the invoice address
        address2: invoice.contact.address2,
      },
      // Description — inherit from previous receipt or invoice title
      title: prevReceipt ? prevReceipt.content.title : invoice.title,
      // Date is always fresh
      date: now,
      table: invoice.table,
      footer: invoice.footer,
      invoiceCode: {
        text: receiptNumber,
        prefix: "REC",
        count: receiptNumber.split("/")[2],  // REC/IS/0001/2026 → index 2 = "0001"
        year: receiptNumber.split("/")[3],   // index 3 = "2026"
        x: 600,
        y: 100,
        color: "#503D36",
      },
      // Invoice reference always from the invoice number
      reference: invoice.invoiceCode?.text || "",
      // Financial summary — dynamic per receipt
      totalInvoiceAmount,
      amountPaid: 0,
      outstandingBalance: totalInvoiceAmount,
      // Transaction ID is always fresh
      transactionId: "TRX-000000000",
      // Inherit from previous receipt if exists
      paymentMethod: prevReceipt
        ? prevReceipt.content.paymentMethod
        : "Transfer",
      acknowledgement: prevReceipt
        ? prevReceipt.content.acknowledgement
        : "I hereby acknowledge receipt of the above payment.",
      signature: prevReceipt ? prevReceipt.content.signature : undefined,
      receiptMessage: prevReceipt
        ? prevReceipt.content.receiptMessage
        : "Thank you for your patronage!",
    };

    createReceiptMutation.mutate(receiptData);
  };

  if (isLoading || !invoiceDoc) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <RefreshCw className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const invoiceData = invoiceDoc.content;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-lexend">
      {/* ── Top bar / Breadcrumb ── */}
      <header className="h-14 border-b border-border bg-white flex items-center gap-2 px-6 shrink-0 shadow-sm z-10">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-700 transition-colors uppercase tracking-widest shrink-0"
        >
          <ArrowLeft size={13} /> All Files
        </button>
        <span className="text-slate-200 font-thin text-base">/</span>
        {invoiceData.invoiceCode?.text && (
          <>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-primary/10 text-primary tracking-wider shrink-0 font-lexend">
              {invoiceData.invoiceCode.text}
            </span>
            <span className="text-slate-200 font-thin text-base">/</span>
          </>
        )}
        <span className="text-xs font-semibold text-slate-700 truncate">
          {invoiceDoc.name}
        </span>
        {invoiceData._templateName && (
          <span className={cn(
            "ml-1 px-2 py-0.5 rounded text-[9px] font-bold shrink-0",
            invoiceData._templateColor === "blue" ? "bg-blue-100 text-blue-700" :
            invoiceData._templateColor === "green" ? "bg-green-100 text-green-700" :
            invoiceData._templateColor === "purple" ? "bg-purple-100 text-purple-700" :
            invoiceData._templateColor === "amber" ? "bg-amber-100 text-amber-700" :
            invoiceData._templateColor === "rose" ? "bg-rose-100 text-rose-700" :
            invoiceData._templateColor === "cyan" ? "bg-cyan-100 text-cyan-700" :
            invoiceData._templateColor === "indigo" ? "bg-indigo-100 text-indigo-700" :
            "bg-slate-100 text-slate-500"
          )}>
            {invoiceData._templateName}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => navigate(`/editor/${id}`)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold border border-border rounded-md bg-white hover:bg-slate-50 transition-all"
          >
            <Edit size={13} /> Edit Invoice
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Invoice info + scaled preview ── */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-7 min-w-0">
          {/* Metadata card */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h1 className="text-base font-bold text-slate-800 leading-tight">
                  {invoiceDoc.name}
                </h1>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-md">
                  {invoiceData.title}
                </p>
              </div>
              {invoiceData.invoiceCode?.text && (
                <span className="px-3 py-1.5 rounded-full text-xs font-black bg-primary/10 text-primary tracking-wider shrink-0 ml-4">
                  {invoiceData.invoiceCode.text}
                </span>
              )}
            </div>

            {/* Top metadata row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-5 border-b border-border">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">
                  Date Created
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  {new Date(invoiceDoc.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">
                  Created By
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  Olamide
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">
                  Client
                </span>
                <span className="text-xs font-semibold text-slate-700 truncate">
                  {invoiceData.contact.name}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">
                  Invoice Date
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  {invoiceData.date}
                </span>
              </div>
            </div>

            {/* Financial summary row */}
            <div className="grid grid-cols-3 gap-4 pt-5">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5">
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">
                  Total Invoice
                </span>
                <span className="text-lg font-black text-slate-800">
                  ₦{Math.round(invoiceGrandTotal).toLocaleString()}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 flex flex-col gap-1.5">
                <span className="text-[9px] uppercase tracking-widest text-emerald-500 font-bold">
                  Payments Received ({sortedReceipts.length})
                </span>
                <span className="text-lg font-black text-emerald-600">
                  ₦{Math.round(totalPaid).toLocaleString()}
                </span>
              </div>
              <div
                className={cn(
                  "p-4 rounded-xl flex flex-col gap-1.5",
                  totalOutstanding > 0
                    ? "bg-amber-50/60 border border-amber-100"
                    : "bg-slate-50 border border-slate-100",
                )}
              >
                <span
                  className={cn(
                    "text-[9px] uppercase tracking-widest font-bold",
                    totalOutstanding > 0 ? "text-amber-500" : "text-slate-400",
                  )}
                >
                  Outstanding Balance
                </span>
                <span
                  className={cn(
                    "text-lg font-black",
                    totalOutstanding > 0 ? "text-amber-600" : "text-slate-500",
                  )}
                >
                  ₦{Math.round(totalOutstanding).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Scaled invoice preview */}
          <div className="flex flex-col gap-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Invoice Preview
            </h2>
            <div className="flex justify-center pb-4">
              <ScaledInvoicePreview data={invoiceData} scale={0.55} />
            </div>
          </div>
        </div>

        {/* ── Right: Receipts sidebar ── */}
        <div className="w-[340px] border-l border-border bg-white flex flex-col shrink-0 overflow-hidden">
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 sticky top-0 bg-white z-10">
            <div className="flex-1 min-w-0">
              <h2 className="text-xs font-bold text-slate-800">Receipts</h2>
              <p className="text-[9px] text-slate-400 font-medium">
                {sortedReceipts.length} {sortedReceipts.length === 1 ? "payment" : "payments"}
              </p>
            </div>
            {/* View toggle */}
            <div className="flex p-0.5 bg-slate-100 rounded-md border border-slate-200">
              <button
                onClick={() => setReceiptView("list")}
                className={cn("p-1 rounded transition-all", receiptView === "list" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600")}
              ><List size={13} /></button>
              <button
                onClick={() => setReceiptView("card")}
                className={cn("p-1 rounded transition-all", receiptView === "card" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600")}
              ><LayoutGrid size={13} /></button>
            </div>
            <button
              onClick={handleAddReceipt}
              disabled={createReceiptMutation.isPending}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-white rounded-md text-[10px] font-bold hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-95"
            >
              <Plus size={12} /> Add
            </button>
          </div>

          {/* Receipts list */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingReceipts ? (
              <div className="p-4 flex flex-col gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse rounded-lg bg-slate-50 h-16 border border-slate-100" />
                ))}
              </div>
            ) : sortedReceipts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center h-full">
                <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
                  <FileText size={20} className="text-slate-300" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">No receipts yet</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Click "Add" to record the first payment.</p>
                </div>
              </div>
            ) : receiptView === "list" ? (
              /* ── List view: thumbnail + details side by side ── */
              <div className="p-3 flex flex-col gap-2">
                {sortedReceipts.map((receipt, idx) => {
                  const paid = receipt.content.amountPaid || 0;
                  const invoiceAmt = receipt.content.totalInvoiceAmount || 0;
                  const outstanding = Math.max(0, invoiceAmt - paid);
                  const isFullyPaid = outstanding === 0 && paid > 0;
                  return (
                    <div
                      key={receipt.id}
                      onClick={() => navigate(`/receipt-editor/${receipt.id}`)}
                      className="flex gap-3 p-2 rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-slate-50/60 cursor-pointer transition-all group"
                    >
                      {/* Tiny thumbnail — shows top of receipt */}
                      <div className="shrink-0 rounded-lg overflow-hidden border border-slate-200 group-hover:border-primary/30 transition-colors" style={{ width: 56, height: 79 }}>
                        <div style={{ transform: "scale(0.07)", transformOrigin: "top left", width: 794, height: 1123, pointerEvents: "none" }}>
                          <ReceiptPage
                            data={receipt.content}
                            rows={receipt.content.table.rows}
                            pageIndex={0}
                            totalPrice={{ subTotal: 0, summaries: [], grandTotal: 0 }}
                            headerImage={localStorage.getItem("receiptHeaderImage") || "/Shan-PaymentReceipt.png"}
                            headerHeight={Number(localStorage.getItem("headerHeight")) || 128}
                            onHeaderResize={NOOP} onHeaderImageUpload={NOOP}
                            isFirstPage={true} isLastPage={true} startIndex={0}
                            onUpdateContact={NOOP} onUpdateTitle={NOOP} onUpdateCell={NOOP}
                            onRemoveRow={NOOP} onAddRowBelow={NOOP} onAddRowAbove={NOOP}
                            onAddSectionBelow={NOOP} onAddSectionAbove={NOOP} onMoveRow={NOOP}
                            onAddStageBelow={NOOP} onAddStageAbove={NOOP} useStages={false}
                            resolveFormula={resolveFormulaUtil} onUpdateInvoiceCode={NOOP}
                            onUpdateSummaryItem={NOOP} onUpdateDate={NOOP}
                            showRows={false} showTotals={false} showFooter={false}
                            isPreview={true} isEndOfRows={true} rowNumbering={{}}
                            resolveSectionTotal={() => 0} resolveStageTotal={() => 0}
                            onUpdatePaymentMethod={NOOP} onUpdateTransactionId={NOOP}
                            onUpdateReference={NOOP} onUpdateSignature={NOOP}
                            onUpdateReceiptMessage={NOOP} onUpdateTotalInvoiceAmount={NOOP}
                            onUpdateAmountPaid={NOOP} onUpdateOutstandingBalance={NOOP}
                            onUpdateAcknowledgement={NOOP}
                          />
                        </div>
                      </div>
                      {/* Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-[11px] font-bold text-slate-700 truncate">
                            {receipt.content.invoiceCode?.text || `Receipt ${idx + 1}`}
                          </p>
                          <span className={cn("shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                            isFullyPaid ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                          )}>
                            {isFullyPaid ? "Paid" : "Partial"}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400">{receipt.content.date}</p>
                        <div className="flex gap-2 mt-1">
                          <div>
                            <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Paid</p>
                            <p className="text-[10px] font-bold text-emerald-600">₦{Math.round(paid).toLocaleString()}</p>
                          </div>
                          <div className="w-px bg-slate-100" />
                          <div>
                            <p className={cn("text-[8px] uppercase tracking-wider font-bold", outstanding > 0 ? "text-amber-400" : "text-slate-400")}>Bal.</p>
                            <p className={cn("text-[10px] font-bold", outstanding > 0 ? "text-amber-600" : "text-slate-400")}>
                              ₦{Math.round(outstanding).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <p className="text-[9px] text-slate-300 mt-0.5 truncate">{receipt.content.paymentMethod || "Transfer"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── Card view: 2-column grid ── */
              <div className="p-3 grid grid-cols-2 gap-2.5">
                {sortedReceipts.map((receipt, idx) => {
                  const paid = receipt.content.amountPaid || 0;
                  const invoiceAmt = receipt.content.totalInvoiceAmount || 0;
                  const outstanding = Math.max(0, invoiceAmt - paid);
                  const isFullyPaid = outstanding === 0 && paid > 0;
                  // Card width ≈ (340 - 24 - 10) / 2 = 153px → scale = 153/794 ≈ 0.193
                  const cardThumbW = 153;
                  const thumbScale = cardThumbW / 794;
                  const thumbH = Math.round(1123 * thumbScale);
                  const visibleH = 88; // crop to just the header area

                  return (
                    <div
                      key={receipt.id}
                      onClick={() => navigate(`/receipt-editor/${receipt.id}`)}
                      className="flex flex-col rounded-xl border border-slate-200 hover:border-primary/40 hover:shadow-md cursor-pointer transition-all overflow-hidden group"
                    >
                      {/* Cropped thumbnail — header of receipt */}
                      <div className="overflow-hidden border-b border-slate-100 bg-white shrink-0" style={{ height: visibleH }}>
                        <div style={{ transform: `scale(${thumbScale})`, transformOrigin: "top left", width: 794, height: thumbH, pointerEvents: "none" }}>
                          <ReceiptPage
                            data={receipt.content}
                            rows={receipt.content.table.rows}
                            pageIndex={0}
                            totalPrice={{ subTotal: 0, summaries: [], grandTotal: 0 }}
                            headerImage={localStorage.getItem("receiptHeaderImage") || "/Shan-PaymentReceipt.png"}
                            headerHeight={Number(localStorage.getItem("headerHeight")) || 128}
                            onHeaderResize={NOOP} onHeaderImageUpload={NOOP}
                            isFirstPage={true} isLastPage={true} startIndex={0}
                            onUpdateContact={NOOP} onUpdateTitle={NOOP} onUpdateCell={NOOP}
                            onRemoveRow={NOOP} onAddRowBelow={NOOP} onAddRowAbove={NOOP}
                            onAddSectionBelow={NOOP} onAddSectionAbove={NOOP} onMoveRow={NOOP}
                            onAddStageBelow={NOOP} onAddStageAbove={NOOP} useStages={false}
                            resolveFormula={resolveFormulaUtil} onUpdateInvoiceCode={NOOP}
                            onUpdateSummaryItem={NOOP} onUpdateDate={NOOP}
                            showRows={false} showTotals={false} showFooter={false}
                            isPreview={true} isEndOfRows={true} rowNumbering={{}}
                            resolveSectionTotal={() => 0} resolveStageTotal={() => 0}
                            onUpdatePaymentMethod={NOOP} onUpdateTransactionId={NOOP}
                            onUpdateReference={NOOP} onUpdateSignature={NOOP}
                            onUpdateReceiptMessage={NOOP} onUpdateTotalInvoiceAmount={NOOP}
                            onUpdateAmountPaid={NOOP} onUpdateOutstandingBalance={NOOP}
                            onUpdateAcknowledgement={NOOP}
                          />
                        </div>
                      </div>
                      {/* Card details */}
                      <div className="p-2 flex flex-col gap-1 bg-white">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-[9px] font-bold text-slate-700 truncate">
                            {receipt.content.invoiceCode?.text || `#${idx + 1}`}
                          </p>
                          <span className={cn("shrink-0 px-1 py-0.5 rounded text-[7px] font-black uppercase",
                            isFullyPaid ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                          )}>
                            {isFullyPaid ? "Paid" : "Part."}
                          </span>
                        </div>
                        <p className="text-[8px] text-slate-400 truncate">{receipt.content.date}</p>
                        <div className="pt-1 border-t border-slate-50">
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Paid</p>
                          <p className="text-[10px] font-bold text-emerald-600">{fmtAmount(paid)}</p>
                        </div>
                        <div>
                          <p className={cn("text-[8px] font-bold uppercase tracking-wider", outstanding > 0 ? "text-amber-400" : "text-slate-300")}>Bal.</p>
                          <p className={cn("text-[10px] font-bold", outstanding > 0 ? "text-amber-600" : "text-slate-300")}>
                            {fmtAmount(outstanding)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewPage;
