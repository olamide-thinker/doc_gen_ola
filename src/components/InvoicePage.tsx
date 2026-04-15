import React from "react";
import { Plus } from "../lib/icons/lucide";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "../lib/utils";
import { Editable } from "./Editable";
import { A4PageProps } from "./A4PageProps";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableRow } from "../types";
import {
  serviceDictionary,
  findPriceColumnId,
  isDescriptionColumn,
} from "../lib/service-dictionary";

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
  onAddSubSectionBelow,
  onAddSubSectionAbove,
  useSections,
  rowNumbering,
  resolveFormula,
  resolveSectionTotalBackward,
  resolveSectionTotal,
}: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  const isSection = row.rowType === "section-header";
  const isSectionTotal = row.rowType === "section-total";
  const isSubSection = row.rowType === "sub-section-header";

  if (isSection || isSectionTotal || isSubSection) {
    // For section-total rows, auto-derive label from the nearest section-header above
    let parentSectionTitle = "";
    if (isSectionTotal) {
      for (let i = startIndex + idx - 1; i >= 0; i--) {
        const r = data.table.rows[i];
        if (r.rowType === "section-header" || r.rowType === "sub-section-header") {
          parentSectionTitle = (r.sectionTitle as string) || "";
          break;
        }
      }
    }

    return (
      <tr 
        ref={setNodeRef} 
        style={style} 
        className={cn(
          "group/row relative",
          isOver && !isDragging && "before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-primary before:z-50"
        )}
      >
        <td
          colSpan={data.table.columns.filter((c: any) => !c.hidden).length - 1}
          className={cn(
            "p-2 text-[11px] font-black uppercase tracking-[0.2em] font-lexend relative",
            isSection && "bg-[#8D6E63]/10 text-[#8D6E63] border-y border-[#8D6E63]/20 py-3",
            isSectionTotal && "bg-slate-100/50 text-slate-500",
            isSubSection && "bg-slate-50 text-slate-400 border-y border-slate-100",
          )}
        >
          <div className="flex items-center gap-2">
            {!isPreview && (
              <div {...attributes} {...listeners} className="cursor-grab opacity-0 group-hover/row:opacity-100 transition-opacity absolute left-[-20px] top-1/2 -translate-y-1/2">
                 <div className="w-4 h-4 rounded hover:bg-slate-200 flex items-center justify-center">
                  <div className="w-1 h-3 border-l-2 border-r-2 border-slate-300" />
                 </div>
              </div>
            )}
            {isSection && <span className="mr-2">{rowNumbering[row.id]}</span>}
            {isSectionTotal ? (
              <span>{parentSectionTitle ? `${parentSectionTitle} Total` : "Section Total"}</span>
            ) : (
              <Editable
                className="min-w-[150px] font-bold"
                value={row.sectionTitle || ""}
                onSave={(val) => onUpdateCell(startIndex + idx, "sectionTitle", val)}
                readOnly={isPreview}
              />
            )}
          </div>
        </td>
        <td
           className={cn(
            "p-2 text-[11px] font-black uppercase tracking-[0.2em] font-lexend text-left",
            isSection && "bg-[#8D6E63]/10 text-[#8D6E63] border-y border-[#8D6E63]/20 py-3",
            isSectionTotal && "bg-slate-100/50 text-slate-500",
            isSubSection && "bg-slate-50 text-slate-400 border-y border-slate-100",
          )}
        >
          {isSectionTotal && (
            <span className="font-bold">
              ₦{Math.round(resolveSectionTotalBackward(data.table.rows, startIndex + idx)).toLocaleString()}
            </span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-slate-100 hover:bg-amber-50/10 group/row transition-colors relative",
        isDragging && "bg-white shadow-xl z-50",
        isOver && !isDragging && "before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-primary before:z-50"
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
                (isNumeric || isFormula) && "font-lexend",
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
              ) : (() => {
                // Description-like text cells get Service Dictionary autocomplete.
                // The row's price column is resolved once per render and passed
                // to the suggestion-pick handler so selecting an entry fills
                // both the description and the adjacent price in one shot.
                const isDesc =
                  !isNumeric &&
                  isDescriptionColumn(col, data.table.columns || []);
                const priceColId = isDesc
                  ? findPriceColumnId(data.table.columns || [])
                  : null;
                return (
                  <Editable
                    className={cn(
                      "w-full",
                      (isNumeric || isFormula) && "text-left font-lexend",
                    )}
                    value={value as string | number}
                    numeric={isNumeric}
                    onSave={(val) => onUpdateCell(startIndex + idx, col.id, val)}
                    readOnly={isPreview}
                    getSuggestions={
                      isDesc
                        ? (q) => serviceDictionary.search(q, 6)
                        : undefined
                    }
                    onPickSuggestion={
                      isDesc
                        ? (entry) => {
                            // Fill the resolved price column, if any.
                            if (priceColId) {
                              onUpdateCell(
                                startIndex + idx,
                                priceColId,
                                entry.price,
                              );
                            }
                            // If the row has a "unit" column (type=text, label
                            // matches /unit/i) and the dictionary entry has a
                            // unit, pre-fill that too.
                            const unitCol = (
                              data.table.columns || []
                            ).find(
                              (c: any) =>
                                c?.type === "text" &&
                                /unit/i.test(c?.label || "") &&
                                c.id !== col.id,
                            );
                            if (unitCol && entry.unit) {
                              onUpdateCell(
                                startIndex + idx,
                                unitCol.id,
                                entry.unit,
                              );
                            }
                          }
                        : undefined
                    }
                  />
                );
              })()}
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

export const InvoicePage: React.FC<A4PageProps> = ({
  data,
  rows,
  pageIndex,
  totalPrice,
  headerHeight,
  onHeaderResize,
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
  onAddSubSectionBelow,
  onAddSubSectionAbove,
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
  resolveSectionTotalBackward,
  useSections,
  resolveSectionTotal,
  onUpdatePaymentMethod,
  onUpdateTransactionId,
  onUpdateReference,
  onUpdateSignature,
  onUpdateReceiptMessage,
}) => {
  const BOQSummary = () => {
    if (!data.showBOQSummary) return null;
    const sections = (data.table.rows || []).filter(r => r.rowType === "section-header" || r.rowType === "sub-section-header");
    if (sections.length === 0) return null;

    return (
      <div className="mb-10 w-full animate-in fade-in slide-in-from-top-4 duration-700">
        <h2 className="text-center font-lora text-[18px] uppercase tracking-[0.2em] text-[#503D36] mb-6">
          Summary of Bill of Quantity
        </h2>
        <div className="overflow-hidden border border-[#E5D3C8] rounded-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#E5D3C8] text-[#503D36] text-[11px] font-bold uppercase tracking-[0.15em]">
                <th className="p-3 text-left w-12 border-r border-white/20">#</th>
                <th className="p-3 text-left border-r border-white/20">Description</th>
                <th className="p-3 text-right">Amount (₦)</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section, idx) => {
                const total = resolveSectionTotal(data.table.rows, data.table.rows.indexOf(section));
                return (
                  <tr key={section.id} className={cn(
                    "text-[12px] font-lexend border-b border-[#F5EDE8]",
                    idx % 2 === 0 ? "bg-white" : "bg-[#FBF9F7]"
                  )}>
                    <td className="p-3 font-bold text-slate-400 border-r border-[#F5EDE8]">{String.fromCharCode(65 + idx)}</td>
                    <td className="p-3 font-bold text-slate-800 border-r border-[#F5EDE8] uppercase">{section.sectionTitle}</td>
                    <td className="p-3 text-right font-black text-slate-900">
                      ₦{Math.round(total).toLocaleString()}
                    </td>
                  </tr>
                );
              })}

              {(totalPrice?.grandTotal !== undefined) && (
                <>
                  <tr className="bg-[#F8F9FA] text-[12px] font-lexend border-b border-[#E5D3C8]">
                    <td colSpan={2} className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right border-r border-[#E5D3C8]">Sub Total</td>
                    <td className="p-3 text-right font-black text-slate-900 bg-white">
                      ₦{Math.round(totalPrice.subTotal).toLocaleString()}
                    </td>
                  </tr>
                  {(totalPrice.summaries || []).map((item: any, sidx: number) => (
                    <tr key={item.id || sidx} className="bg-[#F8F9FA] text-[12px] font-lexend border-b border-[#E5D3C8]">
                      <td colSpan={2} className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right border-r border-[#E5D3C8]">{item.label}</td>
                      <td className="p-3 text-right font-black text-slate-900 bg-white">
                        ₦{Math.round(item.calculatedValue || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="text-white text-[13px] font-lexend" style={{ backgroundColor: PRIMARY_BROWN }}>
                    <td colSpan={2} className="p-4 font-bold uppercase tracking-[0.15em] text-right border-r border-white/10">Grand Total</td>
                    <td className="p-4 text-right font-black text-[15px]">
                      ₦{Math.round(totalPrice.grandTotal).toLocaleString()}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div
      className="a4-page bg-white text-[#212121] shadow-2xl mb-12 relative overflow-hidden shrink-0"
      style={{
        width: "210mm",
        height: "297mm",
        maxHeight: "297mm",
        padding: "14mm 8mm 20mm 8mm",
        backgroundColor: "#FFFFFF",
      }}
    >
      {isFirstPage && (
        <div
          className="flex items-center justify-center overflow-hidden border-b border-slate-100"
          style={{
            margin: "-15mm -20mm 10mm -20mm",
            width: "calc(100% + 40mm)",
            height: `${headerHeight}px`,
            position: "relative",
          }}
        >
          <img
            src={data.isReceipt ? "/Shan-PaymentReceipt.png" : "/Shan-Invoice.png"}
            alt="Logo"
            className="object-contain object-center w-full h-full"
          />
          <div
            className="absolute bottom-0 left-0 right-0 z-10 h-2 bg-transparent cursor-ns-resize no-print"
            onMouseDown={onHeaderResize}
          />
        </div>
      )}

      {isFirstPage && (
        <>
          <div className="mb-8 flex items-center justify-between text-[14px] font-normal text-[#212121] font-lexend">
            <div className="opacity-80 relative h-[1.5em] overflow-hidden">
              <Editable value={data.date} onSave={(val) => onUpdateDate(val as string)} isDate={true} readOnly={isPreview} />
            </div>
            {data.invoiceCode && (
              <span className="font-bold text-[15px] whitespace-nowrap" style={{ color: data.invoiceCode.color }}>
                {data.invoiceCode.text}
              </span>
            )}
          </div>

          <div className="flex justify-between px-4 py-8 mb-12" style={{ backgroundColor: ADDRESS_BG }}>
            <div className="flex flex-col items-start w-1/2 font-lexend">
              <span className="block text-[#503D36] font-normal text-[13px] font-luzia uppercase mb-3 tracking-[0.1em]">Attention To:</span>
              <div className="w-full relative h-[1.5em] mb-1 overflow-hidden">
                <Editable
                  className="font-normal text-[#212121] text-[15px] uppercase"
                  value={data.contact.name}
                  onSave={(val) => onUpdateContact("name", val as string)}
                  readOnly={isPreview}
                />
              </div>
              <div className="w-full relative h-[1.5em] overflow-hidden">
                <Editable
                  className="font-normal text-[14px] opacity-90"
                  value={data.contact.address1}
                  onSave={(val) => onUpdateContact("address1", val as string)}
                  readOnly={isPreview}
                />
              </div>
              <div className="w-full relative h-[1.5em] overflow-hidden">
                <Editable
                  className="font-normal text-[14px] opacity-90"
                  value={data.contact.address2}
                  onSave={(val) => onUpdateContact("address2", val as string)}
                  readOnly={isPreview}
                />
              </div>
              {data.contact.phone && (
                <div className="w-full relative h-[1.5em] overflow-hidden mt-1">
                  <span className="font-normal text-[13px] opacity-60">{data.contact.phone}</span>
                </div>
              )}
              {data.contact.email && (
                <div className="w-full relative h-[1.5em] overflow-hidden">
                  <span className="font-normal text-[13px] opacity-60">{data.contact.email}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-start w-1/2 pl-12 text-left border-l font-lexend border-slate-200">
              <span className="block text-[#503D36] font-normal text-[13px] font-luzia uppercase mb-3 tracking-[0.1em]">{data.isReceipt ? "Ref:" : "Billed From:"}</span>
              {data.isReceipt ? (
                <div className="text-left font-normal text-[#212121] text-[12px] whitespace-pre-wrap">
                  {data.reference || ""}
                </div>
              ) : (
                <>
                  <div className="font-normal text-[#212121] mb-1 text-[12px]">B3F3, The Genesis Estate, Off Odobo Street,</div>
                  <div className="font-normal text-[12px] opacity-90">Ogba-Ikeja, Lagos.</div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-center mb-10 text-center uppercase tracking-widest text-[18px] font-medium leading-[139.4%] text-[#212121]">
            <div className="w-[500px] relative min-h-[1.5em] max-h-20 overflow-y-auto custom-scrollbar">
              <Editable className="w-full h-full" multiline={true} value={data.title} onSave={(val) => onUpdateTitle(val as string)} readOnly={isPreview} />
            </div>
          </div>
        </>
      )}

      {isFirstPage && <BOQSummary />}

      {showRows && (
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
                    onAddSubSectionBelow={onAddSubSectionBelow}
                    onAddSubSectionAbove={onAddSubSectionAbove}
                    useSections={useSections}
                    rowNumbering={rowNumbering}
                    resolveFormula={resolveFormula}
                    resolveSectionTotalBackward={resolveSectionTotalBackward}
                    resolveSectionTotal={resolveSectionTotal}
                  />
                ))}
              </SortableContext>
            </tbody>
          </table>
          {!isPreview && isEndOfRows && (
            <div className="p-4 border-t border-slate-50 bg-[#FBFBFB]/50 flex justify-center no-print">
              <button
                onClick={() => {
                  const lastRow = rows[rows.length - 1];
                  if (lastRow) onAddRowBelow(lastRow.id as string);
                }}
              >
                <Plus size={14} className="transition-transform duration-300 group-hover:rotate-90" />
                Add New Line Item
              </button>
            </div>
          )}
        </div>
      )}

      {showTotals && totalPrice && (
        <div className="mt-8 border-t border-slate-100">
          <TotalRow label="Sub Total" value={totalPrice.subTotal} readOnly className="bg-slate-100/50 font-bold" />
          {(totalPrice.summaries || []).map((item: any) => (
            <TotalRow key={item.id} label={item.label} value={item.calculatedValue || 0} onSaveLabel={(val) => onUpdateSummaryItem(item.id, val)} readOnly={isPreview} />
          ))}
          <div className="flex items-center justify-between p-2 px-5 text-white" style={{ backgroundColor: PRIMARY_BROWN }}>
            <span className="text-[14px] font-normal tracking-wide font-lexend uppercase">{data.isReceipt ? "Total Amount Paid" : "Grand Total"}</span>
            <span className="text-[18px] font-bold font-lexend">₦{Math.round(totalPrice.grandTotal).toLocaleString()}</span>
          </div>
        </div>
      )}

      {showFooter && (
        <div className="mt-8">
           {data.isReceipt ? (
            <div className="flex justify-between items-end border-t border-slate-100 pt-8 px-4">
                <div className="flex flex-col gap-6 max-w-[50%]">
                  <div className="text-[14px] font-medium text-slate-800 italic font-lexend whitespace-pre-wrap">
                    {data.receiptMessage || "Thank you for your patronage!"}
                  </div>
                 <div className="flex flex-row gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-lexend">Payment Method</span>
                    <span className="text-[8px] uppercase tracking-widest text-slate-400 font-normal font-lexend">Bank Transfer | Cash | POS | Cheque</span>
                    <div className="text-[13px] font-lexend text-slate-700">
                      {data.paymentMethod || "Transfer"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-lexend">Transaction ID</span>
                    <div className="text-[13px] font-lexend text-slate-700">
                      {data.transactionId || "TRX-000000000"}
                    </div>
                  </div>
                 </div>
                </div>
                
                <div className="flex flex-col items-center gap-2">
                 {data.signature && (
                    <div className="h-16 w-32 relative">
                      <img src={data.signature} alt="Signature" className="h-full w-full object-contain" />
                    </div>
                  )}
                  <div className="w-40 border-t border-slate-300"></div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold font-lexend">Authorized Signatory</span>
                </div>
            </div>
           ) : (
             <>
              {data.footer.notes && (
                <div className="p-4 border rounded bg-slate-50 border-slate-200">
                  <div className="text-[14px] font-normal text-[#212121] font-lexend leading-relaxed" dangerouslySetInnerHTML={{ __html: data.footer.notes }} />
                </div>
              )}

              {data.footer.emphasis && Array.isArray(data.footer.emphasis) && data.footer.emphasis.length > 0 && (
                <div className="mt-4 bg-[#EDEDED] px-8 py-5 flex flex-col gap-1.5">
                  {data.footer.emphasis.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="uppercase text-[12px] tracking-widest text-[#7A7672] font-black">{item.key}:</span>
                      <span className="text-[17px] font-bold tracking-wide text-[#4B4032]">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
           )}
        </div>
      )}

      <div className="absolute left-0 w-full px-16 text-center bottom-10">
        <div className="border-t border-slate-100 pt-6 flex justify-between items-center text-[11px] text-slate-300 uppercase font-bold tracking-widest opacity-60 font-lexend">
          <span>Maintenance Proposal 2026</span>
          <span>Page {pageIndex + 1}</span>
          <span>Quality Works Guaranteed</span>
        </div>
      </div>
    </div>
  );
};
