import React, { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Printer,
  ArrowLeft,
  RefreshCw,
  Check,
  Users,
  Shield,
} from "../lib/icons/lucide";
import { useAuth } from "../context/AuthContext";
import { CollaboratorsSheet } from "./CollaboratorsSheet";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { arrayMove } from "@dnd-kit/sortable";
import { DocData, TableRow, InvoiceCode } from "../types";
import { api } from "../lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReceiptPage } from "./ReceiptPage";
import { resolveSectionTotal, resolveSectionTotalBackward } from "../lib/documentUtils";
import { useSyncedStore } from "@syncedstore/react";
import { workspaceStore, authStore, connectWorkspace, connectEditor, authProvider } from "../store";

const ReceiptEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromFolder = location.state?.fromFolder;
  const queryClient = useQueryClient();

  const workspaceAction = useSyncedStore(workspaceStore);
  const authAction = useSyncedStore(authStore);
  const { user: currentUser, businessId } = useAuth();
  
  const [connectedClients, setConnectedClients] = useState<any[]>([]);
  const [isSyncReady, setIsSyncReady] = useState(false);
  const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);
  const [activeCollaboratorTab, setActiveCollaboratorTab] = useState<'live' | 'team'>('live');
  const [myClientId, setMyClientId] = useState<string>("unknown");
  const [businessName, setBusinessName] = useState("Your Business");

  useEffect(() => {
    const fetchBusinessName = async () => {
        if (!businessId) return;
        const { doc, getDoc } = await import("firebase/firestore");
        const { db } = await import("../lib/firebase");
        const bDoc = await getDoc(doc(db, "businesses", businessId));
        if (bDoc.exists()) {
            setBusinessName(bDoc.data().name);
        }
    };
    fetchBusinessName();
  }, [businessId]);

  useEffect(() => {
    if (currentUser?.email && authAction.bannedClients?.includes(currentUser.email)) {
      navigate("/denied");
    }
  }, [authAction.bannedClients, currentUser, navigate]);

  useEffect(() => {
    if (!currentUser || !businessId || !id) return;

    let cleanup: (() => void) | undefined;

    const startSync = async () => {
      const token = await currentUser.getIdToken();
      const workspaceProviders = connectWorkspace(businessId, token);
      const editorProvider = connectEditor(id, token);
      
      const updatePresence = () => {
        const states = workspaceProviders.authProvider.awareness?.getStates();
        if (!states) return;
        const clients: any[] = [];
        states.forEach((state: any, clientId: number) => {
          if (state.user && state.user.email) {
            clients.push({ id: clientId.toString(), user: state.user });
          }
        });
        setConnectedClients(clients);
      };

      workspaceProviders.authProvider.awareness?.on('change', updatePresence);
      setMyClientId(workspaceProviders.authProvider.awareness?.clientID.toString() || "unknown");
      workspaceProviders.authProvider.awareness?.setLocalStateField('user', { 
        name: currentUser.displayName || "Anonymous",
        email: currentUser.email || "guest@system.com",
        photo: currentUser.photoURL,
        id: currentUser.uid,
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
      });

      setIsSyncReady(true);
      cleanup = () => {
        workspaceProviders.authProvider.awareness?.off('change', updatePresence);
      };
    };

    startSync();
    return () => cleanup?.();
  }, [currentUser, businessId, id]);

  const docMetadata = workspaceAction.documents?.find((d: any) => d.id === id);
  const docData = docMetadata?.content;

  // Fetch parent invoice for breadcrumb
  const parentInvoice = workspaceAction.documents?.find(d => d.id === docMetadata?.invoiceId);

  const isLoadingDoc = !docMetadata;
  const [headerHeight, setHeaderHeight] = useState<number>(
    () => Number(localStorage.getItem("headerHeight")) || 128,
  );
  const [headerImage, setHeaderImage] = useState<string>(
    () => localStorage.getItem("receiptHeaderImage") || "/Shan-PaymentReceipt.png",
  );
  const [isPreview, setIsPreview] = useState(false);
  const useSections = docData?.useSections ?? false;

  useEffect(() => {
    localStorage.setItem("receiptHeaderImage", headerImage);
  }, [headerImage]);

  useEffect(() => {
    if (docData) {
      const receiptNo = docData.invoiceCode?.text || "Receipt";
      const clientName = docData.contact?.name || "Client";
      document.title = `${receiptNo} - ${clientName}`;
    }
  }, [docData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // --- Real-time content management ---
  useEffect(() => {
    if (!id || !docData) return;
  }, [docData, id]);

  const updateDocData = (
    newData: DocData | ((prev: DocData | null) => DocData | null),
  ) => {
    if (!docMetadata) return;
    const next = typeof newData === "function" ? newData(docData as any) : newData;
    if (next) {
      // Direct mutation of the synced store
      Object.assign(docMetadata.content, next);
    }
  };

  if (isLoadingDoc || !docData)
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <RefreshCw className="animate-spin text-primary" size={32} />
      </div>
    );

  const resolveFormula = (
    rowData: TableRow | Record<string, number>,
    formula: string | undefined,
    context: Record<string, number> = {},
  ): number => {
    if (!formula) return 0;
    try {
      let expression = formula.replace(/(\d*\.?\d+)\s*%/g, "($1/100)");
      Object.keys(context).forEach((key) => {
        expression = expression.replace(new RegExp(`\\b${key}\\b`, "g"), String(Number(context[key]) || 0));
      });
      const matches = formula.match(/[A-Z]+/g) || [];
      matches.forEach((cid) => {
        if (context[cid] !== undefined) return;
        expression = expression.replace(new RegExp(`\\b${cid}\\b`, "g"), String(Number((rowData as any)[cid]) || 0));
      });
      const idMatches = formula.match(/[a-z][a-zA-Z0-9]+/g) || [];
      idMatches.forEach((mid) => {
        if (context[mid] !== undefined) return;
        expression = expression.replace(new RegExp(`\\b${mid}\\b`, "g"), String(Number((rowData as any)[mid]) || 0));
      });
      if (/[^0-9\s+\-*/().]/.test(expression)) return 0;
      return new Function(`return ${expression}`)();
    } catch {
      return 0;
    }
  };

  const subTotal = (docData.table.rows || []).reduce((acc: number, row: TableRow) => {
    if (
      row.rowType === "section-header" || 
      row.rowType === "sub-section-header" || 
      (row.rowType === "section-total" && useSections)
    ) return acc;
    if (row.rowType === "section-total" && !useSections) return acc;
    const totalCol = [...docData.table.columns].reverse().find(
      (c) => (c.type === "formula" || c.type === "number") && !c.hidden
    );
    const rowTotal = totalCol?.type === "formula"
      ? resolveFormula(row, totalCol.formula)
      : Number(row[totalCol?.id || ""]) || 0;
    return acc + rowTotal;
  }, 0);

  const summaryForRender: any[] = [];
  let currentRunningTotal = subTotal;
  (docData.table.summary || []).forEach((item: any, idx: number) => {
    const displayId = String.fromCharCode(65 + idx);
    const val = item.type === "formula"
      ? resolveFormula({}, item.formula, { subTotal, prev: currentRunningTotal })
      : Number(item.value) || 0;
    summaryForRender.push({ ...item, calculatedValue: val, displayId });
    currentRunningTotal += val;
  });

  const grandTotal = currentRunningTotal;

  const getRowNumbering = (rows: TableRow[], useSections: boolean = false): Record<string, string> => {
    const numbering: Record<string, string> = {};
    let l1 = 0;
    let l2 = 0;
    let l3 = 0;
    let inLevel1 = false;
    let inLevel2 = false;

    rows.forEach((row) => {
      if (!useSections) {
        if (row.rowType === "row" || !row.rowType) {
          l1++;
          numbering[row.id] = `${l1}`;
        } else {
          numbering[row.id] = "";
        }
        return;
      }

      const type = row.rowType || "row";

      if (type === "section-header") {
        l1++;
        l2 = 0;
        l3 = 0;
        inLevel1 = true;
        inLevel2 = false;
        numbering[row.id] = `${l1}`;
      } else if (type === "sub-section-header") {
        if (inLevel1) {
          l2++;
          l3 = 0;
          inLevel2 = true;
          numbering[row.id] = `${l1}.${l2}`;
        } else {
          // Acts as a top-level item if no Level 1 active
          l1++;
          l2 = 0;
          l3 = 0;
          inLevel1 = true;
          inLevel2 = true;
          numbering[row.id] = `${l1}`;
        }
      } else if (type === "section-total") {
        inLevel1 = false;
        inLevel2 = false;
        numbering[row.id] = "";
      } else if (type === "row") {
        if (inLevel2) {
          l3++;
          numbering[row.id] = `${l1}.${l2}.${l3}`;
        } else if (inLevel1) {
          l2++;
          numbering[row.id] = `${l1}.${l2}`;
        } else {
          l1++;
          numbering[row.id] = `${l1}`;
        }
      } else {
        numbering[row.id] = "";
      }
    });
    return numbering;
  };

  const rowNumbering = docData ? getRowNumbering(docData.table.rows, useSections) : {};

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && docData) {
      const oldIndex = docData.table.rows.findIndex((r: any) => r.id === active.id);
      const newIndex = docData.table.rows.findIndex((r: any) => r.id === over.id);
      const updatedRows = arrayMove(docData.table.rows, oldIndex, newIndex);
      updateDocData({
        ...docData,
        table: { ...docData.table, rows: updatedRows },
      });
    }
  };

  const handleHeaderResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = headerHeight;
    const handleMouseMove = (em: MouseEvent) => {
      const newHeight = startHeight + (em.clientY - startY);
      setHeaderHeight(Math.max(50, newHeight));
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const pages = [{ rows: docData.table.rows, isFirstPage: true, showRows: true, showTotals: true, showFooter: true, isEndOfRows: true }];

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden print:overflow-visible print:h-auto">
      {/* ── Sticky breadcrumb header ── */}
      <header className="h-14 border-b border-border bg-white flex items-center gap-2 px-6 shrink-0 shadow-sm z-10 no-print print:hidden">
        <button
          onClick={() => navigate(fromFolder ? `/dashboard?folder=${fromFolder}` : "/dashboard")}
          className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-700 transition-colors uppercase tracking-widest shrink-0"
        >
          <ArrowLeft size={13} /> {fromFolder ? "Back to Folder" : "All Files"}
        </button>
        {docMetadata?.invoiceId && parentInvoice && (
          <>
            <span className="text-slate-200 font-thin text-base">/</span>
            <button
              onClick={() => navigate(`/invoice-preview/${docMetadata.invoiceId}`)}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              {parentInvoice.content?.invoiceCode?.text ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-primary/10 text-primary tracking-wider font-lexend">
                  {parentInvoice.content.invoiceCode.text}
                </span>
              ) : (
                <span className="text-xs font-semibold text-slate-600 truncate max-w-[160px]">
                  {parentInvoice.name}
                </span>
              )}
            </button>
          </>
        )}
        <span className="text-slate-200 font-thin text-base">/</span>
        {docData.invoiceCode?.text ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-800 text-white tracking-wider font-lexend">
            {docData.invoiceCode.text}
          </span>
        ) : (
          <span className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">
            {docMetadata?.name || "Receipt"}
          </span>
        )}

        {/* Save indicator */}
        <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-500 flex items-center gap-1.5">
              <Check size={11} /> Real-time Sync
            </span>
          <button
            onClick={() => updateDocData(prev => prev ? { ...prev, showBOQSummary: !prev.showBOQSummary } : null)}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 border",
              docData.showBOQSummary
                ? "bg-primary text-white border-primary"
                : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50",
            )}
          >
            {docData.showBOQSummary ? "Hide BOQ Summary" : "Show BOQ Summary"}
          </button>
          {isPreview ? (
            <>
              <button
                onClick={() => setIsPreview(false)}
                className="px-3 py-1.5 text-xs font-bold border border-border rounded-md bg-white hover:bg-slate-50 transition-all flex items-center gap-1.5"
              >
                <ArrowLeft size={12} /> Edit Mode
              </button>
              <div className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-50 text-slate-400 uppercase flex items-center gap-2 border border-slate-200">
                Real-time Sync Active
              </div>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-all flex items-center gap-1.5"
              >
                <Printer size={12} /> Print
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCollaboratorsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-all text-[11px] font-bold uppercase tracking-widest shadow-sm relative group"
              >
                <Users size={12} />
                {connectedClients.length > 1 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border border-white" />
                )}
                Collabs
              </button>
              <button
                onClick={() => setIsPreview(!isPreview)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all text-[11px] font-bold uppercase tracking-widest shadow-sm",
                  isPreview ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"
                )}
              >
                {isPreview ? "Exit Preview" : "Preview"}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="preview-container flex-1 overflow-y-auto p-6 lg:p-16 flex flex-col items-center print:bg-white print:p-0 print:overflow-visible print:h-auto">

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {pages.map((page, idx) => (
            <ReceiptPage
              key={idx}
              {...page}
              data={docData}
              pageIndex={idx}
              totalPrice={{ subTotal, summaries: summaryForRender, grandTotal }}
              rowNumbering={rowNumbering}
              headerImage={headerImage}
              headerHeight={headerHeight}
              onHeaderResize={handleHeaderResize}
              onHeaderImageUpload={setHeaderImage}
              isLastPage={idx === pages.length - 1}
              startIndex={0}
              onUpdateContact={(field, val) => updateDocData(prev => prev ? { ...prev, contact: { ...prev.contact, [field]: val } } : null)}
              onUpdateTitle={(val) => updateDocData(prev => prev ? { ...prev, title: val } : null)}
              onUpdateCell={(i, col, val) => updateDocData(prev => {
                if (!prev) return null;
                const nr = [...prev.table.rows];
                nr[i] = { ...nr[i], [col]: val };
                return { ...prev, table: { ...prev.table, rows: nr } };
              })}
              onRemoveRow={(i) => updateDocData(prev => {
                if (!prev) return null;
                const nr = [...prev.table.rows];
                nr.splice(i, 1);
                return { ...prev, table: { ...prev.table, rows: nr } };
              })}
              onAddRowBelow={(i) => updateDocData(prev => {
                if (!prev) return null;
                const nr = [...prev.table.rows];
                const newRow = { id: crypto.randomUUID(), rowType: "row", B: "New Item", C: 1, D: 0 };
                nr.splice(i + 1, 0, newRow as any);
                return { ...prev, table: { ...prev.table, rows: nr } };
              })}
              onAddRowAbove={() => {}}
              onAddSectionBelow={() => {}}
              onAddSectionAbove={() => {}}
              onAddSubSectionBelow={() => {}}
              onAddSubSectionAbove={() => {}}
              onMoveRow={() => {}}
              useSections={useSections}
              resolveFormula={resolveFormula}
              resolveSectionTotalBackward={(rows, idx) => resolveSectionTotalBackward(rows, idx, docData)}
              resolveSectionTotal={(rows, idx) => resolveSectionTotal(rows, idx, docData)}
              onUpdateInvoiceCode={(upd) => updateDocData(prev => prev ? { ...prev, invoiceCode: { ...(prev.invoiceCode || {}), ...upd } as any } : null)}
              onUpdateSummaryItem={() => {}}
              onUpdateDate={(val) => updateDocData(prev => prev ? { ...prev, date: val } : null)}
              onUpdatePaymentMethod={(val) => updateDocData(prev => prev ? { ...prev, paymentMethod: val } : null)}
              onUpdateSignature={(val) => updateDocData(prev => prev ? { ...prev, signature: val } : null)}
              onUpdateReceiptMessage={(val) => updateDocData(prev => prev ? { ...prev, receiptMessage: val } : null)}
              onUpdateTransactionId={(val) => updateDocData(prev => prev ? { ...prev, transactionId: val } : null)}
              onUpdateReference={(val) => updateDocData(prev => prev ? { ...prev, reference: val } : null)}
              onUpdateTotalInvoiceAmount={(val) => updateDocData(prev => prev ? { ...prev, totalInvoiceAmount: val } : null)}
              onUpdateAmountPaid={(val) => updateDocData(prev => prev ? { ...prev, amountPaid: val } : null)}
              onUpdateOutstandingBalance={(val) => updateDocData(prev => prev ? { ...prev, outstandingBalance: val } : null)}
              onUpdateAcknowledgement={(val) => updateDocData(prev => prev ? { ...prev, acknowledgement: val } : null)}
              isPreview={isPreview}
              showRows={false}
              showTotals={false}
              showFooter={true}
              isEndOfRows={true}
            />
          ))}
        </DndContext>
      </div>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0 !important;
          }
          html, body { 
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important;
          }
          .no-print { display: none !important; }
          .app-root, .app-main, .preview-container { 
            height: auto !important; 
            overflow: visible !important; 
            display: block !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
          }
          .a4-page {
            margin: 0 auto !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .a4-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
            margin-bottom: 0 !important;
          }
        }
      `}</style>
      {/* Collaborators Sheet */}
      <CollaboratorsSheet
        isOpen={isCollaboratorsOpen}
        onClose={() => setIsCollaboratorsOpen(false)}
        collaborators={connectedClients}
        ownerId={authAction.governance.ownerId || null}
        businessId={businessId}
        businessName={businessName}
        initialTab={activeCollaboratorTab}
        bannedClients={authAction.bannedClients}
        onBanClient={(email) => {
          if (!authAction.bannedClients.includes(email)) {
            authAction.bannedClients.push(email);
          }
        }}
        onMakeOwner={(email) => {
          authAction.governance.ownerId = email;
        }}
      />
    </div>
  );
};

export default ReceiptEditor;
