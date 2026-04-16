import React, { useRef, useState, useEffect, useMemo } from "react";
import { DocData, TableRow } from "../types";
import { InvoicePage } from "./InvoicePage";
import { ReceiptPage } from "./ReceiptPage";
import { DocumentThumbnail } from "./Thumbnail";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  computeTotalPrice as computeTotalPriceForData,
  getRowNumbering,
  resolveSectionTotalBackward,
  resolveSectionTotal,
  resolveFormula as resolveFormulaUtil,
} from "../lib/documentUtils";

const NOOP = () => {};
const A4_PX_WIDTH = 794;
const A4_PX_HEIGHT = 1123;

interface Props {
  data: DocData | null | undefined;
}

/**
 * Real miniature render of an invoice/receipt — Google-Docs-style thumbnail.
 *
 * Renders the actual InvoicePage/ReceiptPage components at full A4 dimensions
 * (794×1123) then CSS-scales them down to fit the dashboard card. The result
 * shows the real client name, invoice code, table rows, totals, etc — not a
 * faked skeleton.
 *
 * Performance guardrails:
 *   - IntersectionObserver defers render until the card enters the viewport
 *     (rootMargin: 300px so it pre-loads just before it's scrolled into view)
 *   - ResizeObserver computes the scale once from the card's actual width so
 *     the thumbnail is crisp at any grid column count
 *   - pointer-events: none so clicks fall through to the card wrapper and
 *     nothing inside the mini page is ever interactive
 *   - Graceful fallback to the old CSS skeleton when content is missing
 */
const CardDocumentPreviewInner: React.FC<Props> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.22);
  const [isVisible, setIsVisible] = useState(false);

  // Responsive scale: fit the A4 canvas to the card's current width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setScale(w / A4_PX_WIDTH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lazy render: only mount the heavy page component once the card is near
  // the viewport. Off-screen dashboards stay cheap.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hasValidContent =
    !!data && !!data.table && Array.isArray(data.table.rows);

  const totalPrice = useMemo(
    () =>
      hasValidContent
        ? computeTotalPriceForData(data as DocData)
        : { subTotal: 0, summaries: [], grandTotal: 0 },
    [data, hasValidContent],
  );

  const rowNumbering = useMemo(
    () =>
      hasValidContent
        ? getRowNumbering(
            (data as DocData).table.rows,
            (data as DocData).useSections,
          )
        : {},
    [data, hasValidContent],
  );

  if (!hasValidContent) {
    return <DocumentThumbnail data={(data || {}) as DocData} />;
  }

  const d = data as DocData;
  const resolveBackward = (rows: TableRow[], fromIdx: number) =>
    resolveSectionTotalBackward(rows, fromIdx, d);
  const resolveForward = (rows: TableRow[], fromIdx: number) =>
    resolveSectionTotal(rows, fromIdx, d);
  const headerHeight = 128;

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-white relative pointer-events-none select-none"
      aria-hidden="true"
    >
      {isVisible && (
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: A4_PX_WIDTH,
            height: A4_PX_HEIGHT,
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          <DndContext collisionDetection={closestCenter} onDragEnd={NOOP}>
            {d.isReceipt ? (
              <ReceiptPage
                data={d}
                rows={d.table.rows}
                pageIndex={0}
                totalPrice={totalPrice}
                headerImage=""
                headerHeight={headerHeight}
                onHeaderResize={NOOP}
                isFirstPage={true}
                isLastPage={false}
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
                onAddSubSectionBelow={NOOP}
                onAddSubSectionAbove={NOOP}
                useSections={d.useSections ?? false}
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
                resolveSectionTotalBackward={resolveBackward}
                resolveSectionTotal={resolveForward}
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
                data={d}
                rows={d.table.rows}
                pageIndex={0}
                totalPrice={totalPrice}
                headerImage=""
                headerHeight={headerHeight}
                onHeaderResize={NOOP}
                isFirstPage={true}
                isLastPage={false}
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
                onAddSubSectionBelow={NOOP}
                onAddSubSectionAbove={NOOP}
                useSections={d.useSections ?? false}
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
                resolveSectionTotalBackward={resolveBackward}
                resolveSectionTotal={resolveForward}
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
      )}
    </div>
  );
};

/**
 * Memoised so the same doc content doesn't re-render across parent re-renders.
 * Compares by reference + updatedAt when possible so filter/sort churn on the
 * dashboard doesn't thrash the page components.
 */
export const CardDocumentPreview = React.memo(
  CardDocumentPreviewInner,
  (prev, next) => prev.data === next.data,
);
