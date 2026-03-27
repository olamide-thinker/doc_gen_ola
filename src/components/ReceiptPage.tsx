import React from "react";
import { Plus } from "../lib/icons/lucide";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "../lib/utils";
import { Editable } from "./Editable";
import { A4PageProps } from "./A4PageProps";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const HEADER_DARK_BROWN = "#503D36";
const PRIMARY_BROWN = "#8D6E63";
const ADDRESS_BG = "#F8F8F8";

const SortableRow = ({
  id,
  row,
  idx,
  startIndex,
  data,
  isPreview,
  onUpdateCell,
  onRemoveRow,
  onAddRowBelow,
  onAddRowAbove,
  onAddSectionBelow,
  onAddSectionAbove,
  onAddStageBelow,
  onAddStageAbove,
  useStages,
  rowNumbering,
  resolveFormula,
  resolveSectionTotal,
  resolveStageTotal,
}: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  const isSection = row.rowType === "section-header";
  const isSectionTotal = row.rowType === "section-total";
  const isStageHeader = row.rowType === "stage-header";

  if (isSection || isSectionTotal || isStageHeader) {
    return (
      <tr ref={setNodeRef} style={style} className="group/row">
        <td
          colSpan={data.table.columns.filter((c: any) => !c.hidden).length}
          className={cn(
            "p-2 text-[11px] font-black uppercase tracking-[0.2em] font-lexend relative",
            isSection && "bg-slate-50 text-slate-400 border-y border-slate-100",
            isSectionTotal && "bg-slate-100/50 text-slate-500 text-right pr-4",
            isStageHeader && "bg-[#8D6E63]/10 text-[#8D6E63] border-y border-[#8D6E63]/20 py-3",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isPreview && (
                <div {...attributes} {...listeners} className="cursor-grab opacity-0 group-hover/row:opacity-100 transition-opacity">
                   <div className="w-4 h-4 rounded hover:bg-slate-200 flex items-center justify-center">
                    <div className="w-1 h-3 border-l-2 border-r-2 border-slate-300" />
                   </div>
                </div>
              )}
              {isStageHeader && <span className="mr-2">Stage {rowNumbering[row.id]}</span>}
              <Editable
                className="min-w-[150px]"
                value={row.sectionTitle || ""}
                onSave={(val) => onUpdateCell(startIndex + idx, "sectionTitle", val)}
                readOnly={isPreview}
              />
            </div>
            {isSectionTotal && (
              <span className="font-bold">
                ₦{Math.round(resolveSectionTotal(data.table.rows, startIndex + idx)).toLocaleString()}
              </span>
            )}
             {isStageHeader && (
              <span className="font-bold ml-auto pr-4">
                Stage Total: ₦{Math.round(resolveStageTotal(data.table.rows, startIndex + idx)).toLocaleString()}
              </span>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-slate-100 hover:bg-amber-50/10 group/row transition-colors",
        isDragging && "bg-white shadow-xl z-50",
      )}
    >
      {(data.table.columns || [])
        .filter((c: any) => !c.hidden)
        .map((col: any) => {
          const value = row[col.id];
          const isNumeric = col.type === "number";
          const isFormula = col.type === "formula";
          const isIndex = col.type === "index";

          return (
            <td
              key={col.id}
              className={cn(
                "p-4 text-[13px] font-normal text-slate-600 relative",
                (isNumeric || isFormula) && "text-right font-lexend",
              )}
            >
              {isIndex ? (
                <div className="flex items-center gap-2">
                  {!isPreview && (
                    <div {...attributes} {...listeners} className="cursor-grab opacity-0 group-hover/row:opacity-100 transition-opacity no-print">
                      <div className="w-4 h-4 rounded hover:bg-slate-200 flex items-center justify-center">
                        <div className="w-1 h-3 border-l-2 border-r-2 border-slate-300" />
                      </div>
                    </div>
                  )}
                  <span className="text-slate-400 font-bold min-w-[20px]">
                    {rowNumbering[row.id]}
                  </span>
                </div>
              ) : isFormula ? (
                <span className="font-bold text-slate-800">
                  ₦{Math.round(resolveFormula(row, col.formula)).toLocaleString()}
                </span>
              ) : (
                <Editable
                  className={cn(
                    "w-full",
                    (isNumeric || isFormula) && "text-left font-lexend",
                  )}
                  value={value as string | number}
                  numeric={isNumeric}
                  onSave={(val) => onUpdateCell(startIndex + idx, col.id, val)}
                  readOnly={isPreview}
                />
              )}
            </td>
          );
        })}
    </tr>
  );
};

const TotalRow = ({
  label,
  value,
  onSaveLabel,
  readOnly = false,
  className,
}: {
  label: string;
  value: number;
  onSaveLabel?: (val: string) => void;
  readOnly?: boolean;
  className?: string;
}) => (
  <div className={cn("flex justify-between items-center p-4 text-[14px] font-normal border-b border-slate-70 font-lexend h-12", className)}>
    <div className="text-slate-500 uppercase text-[11px] tracking-[0.2em] min-w-[120px] relative h-full overflow-hidden flex items-center">
      {onSaveLabel ? (
        <Editable value={label} onSave={(val) => onSaveLabel(val as string)} readOnly={readOnly} />
      ) : (
        <span>{label}</span>
      )}
    </div>
    <span className="text-[#212121]">₦{Math.round(value).toLocaleString()}</span>
  </div>
);

export const ReceiptPage: React.FC<A4PageProps> = ({
  data,
  rows,
  pageIndex,
  totalPrice,
  headerImage,
  headerHeight,
  onHeaderResize,
  onHeaderImageUpload,
  isFirstPage,
  startIndex,
  onUpdateContact,
  onUpdateTitle,
  onUpdateCell,
  onRemoveRow,
  onAddRowBelow,
  onAddRowAbove,
  onAddSectionBelow,
  onAddSectionAbove,
  resolveFormula,
  onUpdateInvoiceCode,
  onUpdateSummaryItem,
  onUpdateDate,
  showRows,
  showTotals,
  showFooter,
  isPreview,
  isEndOfRows,
  rowNumbering,
  resolveSectionTotal,
  onAddStageBelow,
  onAddStageAbove,
  useStages,
  resolveStageTotal,
  onUpdatePaymentMethod,
  onUpdateTransactionId,
  onUpdateReference,
  onUpdateSignature,
  onUpdateReceiptMessage,
  onUpdateTotalInvoiceAmount,
  onUpdateAmountPaid,
  onUpdateOutstandingBalance,
  onUpdateAcknowledgement,
}) => {
  return (
    <div
      className="a4-page bg-white text-[#212121] shadow-2xl mb-12 print:mb-0 relative overflow-hidden shrink-0"
      style={{
        width: "210mm",
        height: "295mm",
        maxHeight: "295mm",
        padding: "8mm 8mm 10mm 8mm",
        backgroundColor: "#FFFFFF",
      }}
    >
      {isFirstPage && (
        <div
          className="flex items-center justify-center overflow-hidden border-b border-slate-100"
          style={{
            margin: "-15mm -20mm 5mm -20mm",
            width: "calc(100% + 40mm)",
            height: `${headerHeight}px`,
            position: "relative",
          }}
        >
          <div 
            className="w-full h-full relative cursor-pointer"
            onClick={() => {
              if (isPreview) return;
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (re) => {
                    if (onHeaderImageUpload) {
                      onHeaderImageUpload(re.target?.result as string);
                    }
                  };
                  reader.readAsDataURL(file);
                }
              };
              input.click();
            }}
          >
            <img
              src={headerImage || "/Shan-PaymentReceipt.png"}
              alt="Logo"
              className="object-contain object-center w-full h-full"
            />
          </div>
          <div
            className="absolute bottom-0 left-0 right-0 z-20 h-2 bg-transparent cursor-ns-resize no-print"
            onMouseDown={onHeaderResize}
          />
        </div>
      )}

      {/* Draggable Receipt Code */}
      {isFirstPage && data.invoiceCode && (
        <div
          className={cn("absolute select-none z-30 group", !isPreview ? "cursor-move" : "")}
          style={{ left: `${data.invoiceCode.x}px`, top: `${data.invoiceCode.y}px`, color: data.invoiceCode.color }}
          onMouseDown={(e) => {
            if (isPreview) return;
            e.preventDefault();
            const startX = e.clientX - data.invoiceCode!.x;
            const startY = e.clientY - data.invoiceCode!.y;
            const handleMouseMove = (em: MouseEvent) => {
              onUpdateInvoiceCode({ x: em.clientX - startX, y: em.clientY - startY });
            };
            const handleMouseUp = () => {
              document.removeEventListener("mousemove", handleMouseMove);
              document.removeEventListener("mouseup", handleMouseUp);
            };
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
          }}
        >
          <div className="font-lexend font-bold text-[16px] whitespace-nowrap">
            <Editable
              value={data.invoiceCode.text}
              onSave={(val) => onUpdateInvoiceCode({ text: val as string })}
              readOnly={isPreview}
            />
          </div>
          {!isPreview && (
            <div className="absolute transition-opacity border-2 border-dashed rounded opacity-0 pointer-events-none -inset-2 border-primary/20 group-hover:opacity-100" />
          )}
        </div>
      )}

      {isFirstPage && (
        <>
          <div className="mb-6 w-[150px] text-[14px] font-normal text-[#212121] font-lexend opacity-80 relative h-[1.5em] overflow-hidden">
            <Editable value={data.date} onSave={(val) => onUpdateDate(val as string)} isDate={true} readOnly={isPreview} />
          </div>

          <div className="flex justify-between px-6 py-6 mb-8" style={{ backgroundColor: ADDRESS_BG }}>
            <div className="flex flex-col items-start w-1/2 font-lexend">
              <span className="block text-[#503D36] font-normal text-[13px] font-luzia uppercase mb-3 tracking-[0.1em]">Received From:</span>
              <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-bold uppercase min-w-[80px]">Client Name:</span>
                  <div className="flex-1 relative h-[1.5em] overflow-hidden">
                    <Editable
                      className="font-normal text-[#212121] text-[15px] uppercase"
                      value={data.contact.name}
                      onSave={(val) => onUpdateContact("name", val as string)}
                      readOnly={isPreview}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-bold uppercase min-w-[80px]">Project:</span>
                  <div className="flex-1 relative h-[1.5em] overflow-hidden">
                    <Editable
                      className="font-normal text-[14px] opacity-90"
                      value={data.contact.address1}
                      onSave={(val) => onUpdateContact("address1", val as string)}
                      readOnly={isPreview}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-bold uppercase min-w-[80px]">Location:</span>
                  <div className="flex-1 relative h-[1.5em] overflow-hidden">
                    <Editable
                      className="font-normal text-[14px] opacity-90"
                      value={data.contact.address2}
                      onSave={(val) => onUpdateContact("address2", val as string)}
                      readOnly={isPreview}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start w-1/2 pl-12 text-left border-l font-lexend border-slate-200">
              <span className="block text-[#503D36] font-normal text-[13px] font-luzia uppercase mb-3 tracking-[0.1em]">Payment Details:</span>
              <div className="flex flex-col gap-2 w-full">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Description:</span>
                  <div className="w-full relative min-h-[1.5em]">
                    <Editable 
                      value={data.title || ""} 
                      onSave={(val) => onUpdateTitle(val as string)}
                      multiline={true}
                      className="w-full text-left font-normal text-[#212121] text-[13px]"
                      readOnly={isPreview}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Invoice Reference:</span>
                  <div className="w-full relative h-[1.5em] overflow-hidden">
                    <Editable 
                      value={data.reference || ""} 
                      onSave={(val) => onUpdateReference(val as string)}
                      className="w-full text-left font-normal text-[#212121] text-[13px]"
                      readOnly={isPreview}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Financial Summary Section */}
      <div className="mb-8 font-lexend">
        <div className="mb-3">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#503D36]">Financial Summary:</span>
        </div>
        <div className="grid grid-cols-3 border border-slate-100 rounded-lg overflow-hidden">
          <div className="p-4 border-r border-slate-100 flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Total Invoice Amount</span>
            <div className="flex items-center gap-1 font-bold text-[#212121] text-[13px]">
              <span>₦</span>
              <Editable 
                value={data.totalInvoiceAmount || 0} 
                onSave={(val) => onUpdateTotalInvoiceAmount?.(Number(val))} 
                numeric 
                isCurrency={true}
                readOnly={isPreview} 
              />
            </div>
          </div>
          <div className="p-4 border-r border-slate-100 flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Amount Paid</span>
            <div className="flex items-center gap-1 font-bold text-[#212121] text-[13px]">
              <span>₦</span>
              <Editable 
                value={data.amountPaid || 0} 
                onSave={(val) => onUpdateAmountPaid?.(Number(val))} 
                numeric 
                isCurrency={true}
                readOnly={isPreview} 
              />
            </div>
          </div>
          <div className="p-4 flex flex-col gap-2 bg-slate-50/50">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Outstanding Balance</span>
            <div className="flex items-center gap-1 font-bold text-[#212121] text-[13px]">
              <span>₦</span>
              <Editable 
                value={(data.totalInvoiceAmount || 0) - (data.amountPaid || 0)} 
                onSave={() => {}} 
                numeric 
                isCurrency={true}
                readOnly={true} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payment Info Section */}
      <div className="mb-8 font-lexend">
        <div className="grid grid-cols-2 border border-slate-100 rounded-lg overflow-hidden text-[13px]">
          <div className="p-4 border-r border-slate-100 flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Payment Method</span>
            <div className="font-medium text-slate-800 text-[13px] h-[1.5em] overflow-hidden relative">
              <Editable
                value={data.paymentMethod || "Transfer"}
                onSave={(val) => onUpdatePaymentMethod(val as string)}
                readOnly={isPreview}
              />
            </div>
            <span className="text-[8px] uppercase tracking-[0.1em] text-slate-300 font-normal mt-0.5">Bank Transfer | Cash | POS | Cheque</span>
          </div>
          <div className="p-4 flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Transaction ID / Reference</span>
            <div className="font-medium text-slate-800 text-[13px] h-[1.5em] overflow-hidden relative">
              <Editable
                value={data.transactionId || "TRX-000000000"}
                onSave={(val) => onUpdateTransactionId(val as string)}
                readOnly={isPreview}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Acknowledgement Section */}
      <div className="mb-8 font-lexend">
         <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-[#503D36] mb-3">Acknowledgement:</span>
         <div className="p-6 border border-slate-100 rounded-xl italic text-[14px] leading-relaxed text-slate-800 relative min-h-[4em] bg-white text-center flex items-center justify-center">
            <Editable
              value={data.acknowledgement || ""}
              onSave={(val) => onUpdateAcknowledgement?.(val as string)}
              multiline={true}
              className="w-full"
              readOnly={isPreview}
            />
         </div>
         <div className="mt-4 text-center">
         </div>
      </div>

      {showRows && !data.isReceipt && (
        <div className="overflow-hidden border border-slate-100">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-white text-[13px] font-normal uppercase tracking-[0.2em] font-luzia" style={{ backgroundColor: HEADER_DARK_BROWN }}>
                {(data.table.columns || [])
                  .filter((c) => !c.hidden)
                  .map((col: any) => (
                    <th key={col.id} className="p-4 font-normal text-left border-r border-white/10 last:border-r-0" style={{ width: col.width || "auto" }}>
                      {col.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              <SortableContext items={rows.map((r) => r.id as string)} strategy={verticalListSortingStrategy}>
                {(rows || []).map((row, idx) => (
                  <SortableRow
                    key={row.id as string}
                    id={row.id as string}
                    row={row}
                    idx={idx}
                    startIndex={startIndex}
                    data={data}
                    isPreview={isPreview}
                    onUpdateCell={onUpdateCell}
                    onRemoveRow={onRemoveRow}
                    onAddRowBelow={onAddRowBelow}
                    onAddRowAbove={onAddRowAbove}
                    onAddSectionBelow={onAddSectionBelow}
                    onAddSectionAbove={onAddSectionAbove}
                    onAddStageBelow={onAddStageBelow}
                    onAddStageAbove={onAddStageAbove}
                    useStages={useStages}
                    rowNumbering={rowNumbering}
                    resolveFormula={resolveFormula}
                    resolveSectionTotal={resolveSectionTotal}
                    resolveStageTotal={resolveStageTotal}
                  />
                ))}
              </SortableContext>
            </tbody>
          </table>
          {isEndOfRows && (
            <div className="p-4 border-t border-slate-50 bg-[#FBFBFB]/50 flex justify-center no-print">
              <button
                onClick={() => onAddRowBelow(startIndex + rows.length - 1)}
                className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-500 hover:text-primary hover:border-primary/30 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95 group"
              >
                <Plus size={14} className="transition-transform duration-300 group-hover:rotate-90" />
                Add New Line Item
              </button>
            </div>
          )}
        </div>
      )}

      {showTotals && totalPrice && !data.isReceipt && (
        <div className="mt-8 border-t border-slate-100">
          <TotalRow label="Sub Total" value={totalPrice.subTotal} readOnly className="bg-slate-100/50 font-bold" />
          {(totalPrice.summaries || []).map((item: any) => (
            <TotalRow key={item.id} label={item.label} value={item.calculatedValue || 0} onSaveLabel={(val) => onUpdateSummaryItem(item.id, val)} readOnly={isPreview} />
          ))}
          <div className="flex items-center justify-between p-2 px-5 text-white" style={{ backgroundColor: "#212121" }}>
            <span className="text-[14px] font-normal tracking-wide font-lexend uppercase">Total Amount Paid</span>
            <span className="text-[18px] font-bold font-lexend">₦{Math.round(totalPrice.grandTotal).toLocaleString()}</span>
          </div>
        </div>
      )}

      {showFooter && (
        <div className="mt-4">
            <div className="flex justify-between items-end border-t border-slate-100 pt-4 px-4">
               {/* Left: Thank You & Payment Method */}
                <div className="flex flex-col gap-6 max-w-[50%]">
                  <div className="text-[14px] font-medium text-slate-800 italic font-lexend min-h-[1.5em] max-h-16 relative custom-scrollbar w-full">
                    <Editable
                      value={data.receiptMessage || "Thank you for your patronage!"}
                      onSave={(val) => onUpdateReceiptMessage(val as string)}
                      multiline={true}
                      className="w-full text-left"
                      readOnly={isPreview}
                    />
                  </div>
               </div>

               {/* Right: Signature Area */}
               <div className="flex flex-col items-center gap-3 min-w-[200px]">
                  <div
                    className={cn(
                      "w-48 h-20 border-b-2 border-slate-200 relative flex items-center justify-center group/sign cursor-pointer overflow-hidden transition-all",
                      !data.signature && !isPreview && "hover:bg-slate-50 border-dashed"
                    )}
                    onClick={() => {
                      if (isPreview) return;
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (re) => {
                            onUpdateSignature(re.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                  >
                    {data.signature ? (
                      <img src={data.signature} alt="Authorized Signature" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                    ) : (
                      !isPreview && <div className="text-[9px] text-slate-300 font-bold uppercase tracking-widest group-hover/sign:text-primary transition-colors text-center px-4">Click to Upload Signature</div>
                    )}
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#503D36] font-lexend">Authorized Signature</span>
               </div>
            </div>
        </div>
      )}

      <div className="absolute left-0 w-full px-16 text-center bottom-10">
        <div className="border-t border-slate-100 pt-6 flex justify-between items-center text-[11px] text-slate-300 uppercase font-bold tracking-widest opacity-60 font-lexend">
          <span>Official Receipt 2026</span>
          <span>Page {pageIndex + 1}</span>
          <span>Payment Verified</span>
        </div>
      </div>
    </div>
  );
};
