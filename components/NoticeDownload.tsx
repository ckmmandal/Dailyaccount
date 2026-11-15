import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Megaphone, DownloadCloud, Plus, X, Search, FileText, 
  Image as ImageIcon, Eye, Download, Trash2, Calendar, 
  Info, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, 
  Paperclip, FileUp, Filter, ChevronRight, LayoutGrid,
  BellRing, AlertTriangle, Sparkles, Building2, ToggleLeft, 
  ToggleRight, Edit3, ExternalLink, Layers, RefreshCw, Clock
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { useAuth } from '../AuthContext';
import { Notice, DownloadableDocument, PopupNotice } from '../types';
import { NepaliDatePicker } from './NepaliDatePicker';
import { LoginPopupNoticeModal } from './LoginPopupNoticeModal';
import NepaliDate from 'nepali-date-converter';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

type ContentTab = 'notice' | 'download' | 'popup';

const NoticeDownload: React.FC = () => {
  const { branch, user, hasPermission } = useAuth();
  const isDayEnded = useDayEndLock(branch?.id);
  const location = useLocation();
  const navigate = useNavigate();

  const activeTabFromUrl = useMemo<ContentTab>(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'notice-download') {
      const sub = parts[1].toLowerCase() as ContentTab;
      if (sub === 'notice' || sub === 'download' || sub === 'popup') return sub;
    }
    return 'notice';
  }, [location.pathname]);

  const activeTab = activeTabFromUrl;

  const handleTabChange = (tab: ContentTab) => {
    if (tab === 'notice') {
      navigate('/notice-download');
    } else {
      navigate(`/notice-download/${tab}`);
    }
  };
  const [notices, setNotices] = useState<Notice[]>([]);
  const [documents, setDocuments] = useState<DownloadableDocument[]>([]);
  const [popupNotices, setPopupNotices] = useState<PopupNotice[]>([]);
  const [filter, setFilter] = useState('');
  
  // Modals
  const [showAddNotice, setShowAddNotice] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [editingPopup, setEditingPopup] = useState<PopupNotice | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DownloadableDocument | null>(null);
  const [previewPopup, setPreviewPopup] = useState<PopupNotice | null>(null);

  const loadData = async () => {
    const isSuper = user?.roleId === '1' || user?.username === 'admin';
    try {
      const [n, d, p] = await Promise.all([
        storageService.getNotices(isSuper ? undefined : branch?.id),
        storageService.getDocuments(isSuper ? undefined : branch?.id),
        storageService.getPopupNotices(isSuper ? undefined : branch?.id)
      ]);
      setNotices(Array.isArray(n) ? n : []);
      setDocuments(Array.isArray(d) ? d : []);
      setPopupNotices(Array.isArray(p) ? p : []);
    } catch (error) {
      console.error("Failed to load notices/documents/popups", error);
    }
  };

  useEffect(() => { 
    loadData(); 
    const handlePopupUpdate = () => loadData();
    window.addEventListener('saccos_popup_notice_updated', handlePopupUpdate);
    return () => {
      window.removeEventListener('saccos_popup_notice_updated', handlePopupUpdate);
    };
  }, [branch, user]);

  const filteredNotices = notices.filter(n => 
    n.title.toLowerCase().includes(filter.toLowerCase()) || 
    n.description.toLowerCase().includes(filter.toLowerCase())
  ).sort((a,b) => b.createdAt - a.createdAt);

  const filteredDocs = documents.filter(d => 
    d.title.toLowerCase().includes(filter.toLowerCase()) || 
    d.category.toLowerCase().includes(filter.toLowerCase())
  ).sort((a,b) => b.createdAt - a.createdAt);

  const filteredPopups = popupNotices.filter(p =>
    p.title.toLowerCase().includes(filter.toLowerCase()) ||
    p.message.toLowerCase().includes(filter.toLowerCase()) ||
    (p.targetBranchId && p.targetBranchId.toLowerCase().includes(filter.toLowerCase()))
  ).sort((a,b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-8">
      {/* Header View */}
      <div className="bg-white py-4 px-6 rounded-3xl border border-slate-200 shadow-sm no-print">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-md">
              <Megaphone size={18} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                Notice, Downloads & <span className="text-emerald-600">Popup Alerts</span>
              </h2>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 italic leading-none">
                Official Information, File Repository & Login Popups
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
             <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-100 shadow-inner">
                <TabButton id="notice" label="Notices & Bulletins" icon={<Megaphone size={12} />} active={activeTab} onClick={handleTabChange} />
                <TabButton id="download" label="Downloads & Files" icon={<DownloadCloud size={12} />} active={activeTab} onClick={handleTabChange} />
                <TabButton 
                  id="popup" 
                  label="Popup Alerts" 
                  icon={<BellRing size={12} />} 
                  active={activeTab} 
                  onClick={handleTabChange} 
                />
             </div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 bg-white py-3 px-5 rounded-3xl border border-slate-200 shadow-sm no-print italic font-black">
        <div className="relative flex-1 w-full max-w-xl">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input 
            type="text" 
            placeholder={`Search ${activeTab === 'notice' ? 'notices...' : activeTab === 'download' ? 'documents...' : 'popup alerts...'}`} 
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 font-black text-[9px] uppercase outline-none focus:border-emerald-500 transition-all shadow-inner"
          />
        </div>
        {hasPermission('manage_notices') && (
           <button 
             onClick={() => {
               if (activeTab === 'notice') setShowAddNotice(true);
               else if (activeTab === 'download') setShowAddDoc(true);
               else {
                 setEditingPopup(null);
                 setShowAddPopup(true);
               }
             }} 
             disabled={isDayEnded}
             title={isDayEnded ? getDayEndedBlockMessage() : undefined}
             className="bg-slate-950 text-white h-9 px-5 rounded-lg font-black uppercase text-[9px] tracking-widest hover:bg-emerald-600 transition-all flex items-center space-x-2 shadow-md active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <Plus size={14} />
             <span>
               {activeTab === 'notice' ? 'Post New Notice' : activeTab === 'download' ? 'Upload Resource' : 'Create Popup Notice'}
             </span>
           </button>
        )}
      </div>

      {/* Main Content */}
      <div className="min-h-[40vh]">
        {activeTab === 'notice' ? (
          <NoticeGrid notices={filteredNotices} onView={openNoticeInNewTab} onReload={loadData} />
        ) : activeTab === 'download' ? (
          <DocumentList documents={filteredDocs} onView={setSelectedDoc} onReload={loadData} />
        ) : (
          <PopupNoticeList 
            popups={filteredPopups} 
            onPreview={setPreviewPopup} 
            onEdit={(p) => {
              setEditingPopup(p);
              setShowAddPopup(true);
            }} 
            onReload={loadData} 
          />
        )}
      </div>

      {/* Modals */}
      {showAddNotice && <AddNoticeModal onClose={() => setShowAddNotice(false)} onReload={loadData} />}
      {showAddDoc && <AddDocumentModal onClose={() => setShowAddDoc(false)} onReload={loadData} />}
      {showAddPopup && (
        <AddEditPopupNoticeModal 
          initialData={editingPopup} 
          onClose={() => {
            setShowAddPopup(false);
            setEditingPopup(null);
          }} 
          onReload={loadData} 
          onTestPreview={setPreviewPopup}
        />
      )}
      {selectedNotice && <ViewNoticeModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />}
      {selectedDoc && <ViewDocumentModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />}
      {previewPopup && (
        <LoginPopupNoticeModal 
          popup={previewPopup} 
          onClose={() => setPreviewPopup(null)} 
          isPreview={true}
        />
      )}
    </div>
  );
};

const TabButton = ({ id, label, icon, active, onClick }: any) => (
  <button
    onClick={() => onClick(id)}
    className={`
      flex items-center space-x-2 px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all duration-300
      ${active === id 
        ? 'bg-white text-emerald-600 shadow-md shadow-emerald-100/50' 
        : 'text-slate-400 hover:text-slate-600'}
    `}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const openFileInNewTab = (fileUrl: string, title: string) => {
  try {
    if (!fileUrl) return;
    if (!fileUrl.startsWith('data:')) {
      window.open(fileUrl, '_blank');
      return;
    }
    
    const parts = fileUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : '';
    const byteString = atob(parts[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    
    const blob = new Blob([arrayBuffer], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    
    window.open(blobUrl, '_blank');
  } catch (error) {
    console.error("Failed to open file in new tab:", error);
    window.open(fileUrl, '_blank');
  }
};

const openNoticeInNewTab = (notice: Notice) => {
  const attachmentSection = notice.attachmentUrl ? `
    <div class="mt-8 max-w-3xl mx-auto">
      ${notice.attachmentType === 'image' ? `
        <div class="rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-white p-2">
          <img src="${notice.attachmentUrl}" class="w-full max-h-[80vh] object-contain mx-auto" />
        </div>
      ` : notice.attachmentType === 'pdf' ? `
        <div class="h-[80vh] rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-white">
          <iframe src="${notice.attachmentUrl}" class="w-full h-full border-0"></iframe>
        </div>
      ` : `
        <div class="p-6 text-center bg-white rounded-2xl border border-slate-200">
          <p class="text-slate-400 text-xs uppercase font-bold">Preview not available for this file type</p>
        </div>
      `}
    </div>
  ` : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${notice.title}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', sans-serif;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
            padding: 0 !important;
          }
          .main-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      </style>
    </head>
    <body class="bg-slate-50 min-h-screen py-12 px-6">
      <!-- Floating Action Buttons -->
      <div class="fixed top-4 right-4 flex items-center space-x-2 no-print bg-white/90 backdrop-blur-md border border-slate-200 shadow-lg rounded-xl p-1.5 z-50">
        <button onclick="window.print()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-widest px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-sm">Print / PDF</button>
        <button onclick="window.close()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-widest px-4 py-2 rounded-lg cursor-pointer transition-colors">Close</button>
      </div>

      <div class="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-8 md:p-12 relative overflow-hidden main-card">
        <!-- Meta Info -->
        <div class="flex items-center justify-between text-xs text-slate-400 mb-6 font-bold uppercase tracking-wide">
          <div>Published Date: ${notice.date}</div>
        </div>

        <!-- Title -->
        <h1 class="text-2xl md:text-3xl font-black text-slate-900 leading-tight mb-6">
          ${notice.title}
        </h1>

        <!-- Horizontal Divider -->
        <div class="w-full h-[2px] bg-slate-100 mb-8"></div>

        <!-- Content / Description -->
        <div class="text-slate-800 text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium mb-12 select-text normal-case">
          ${notice.description}
        </div>

        <!-- Attachment Block -->
        ${attachmentSection}
      </div>
    </body>
    </html>
  `;

  try {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (error) {
    console.error("Failed to open notice in new tab:", error);
  }
};

const NoticeGrid = ({ notices, onView, onReload }: { notices: Notice[], onView: (n: Notice) => void, onReload: () => void }) => {
  const { hasPermission } = useAuth();

  const deleteNotice = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this notice?")) {
      await storageService.deleteNotice(id);
      await storageService.deletePopupNotice(id);
      onReload();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 italic font-black">
      {notices.length === 0 ? (
        <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center">
           <AlertCircle size={32} className="text-slate-300 mb-3" />
           <p className="text-slate-400 text-xs uppercase tracking-[0.3em] font-black">No official notices currently posted</p>
        </div>
      ) : (
        notices.map(n => (
          <div 
            key={n.id} 
            onClick={() => onView(n)}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all duration-300 group cursor-pointer relative flex flex-row gap-4 items-stretch"
          >
             {/* Left side attachment thumbnail */}
             <div className="w-24 h-20 md:w-32 md:h-24 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center relative">
                {n.attachmentUrl && n.attachmentType === 'image' ? (
                   <img src={n.attachmentUrl} className="w-full h-full object-cover" alt="Notice Attachment" referrerPolicy="no-referrer" />
                ) : (
                   <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-teal-50 flex flex-col items-center justify-center text-emerald-600 p-2 text-center">
                      <Megaphone size={20} className="mb-1 opacity-75" />
                      <span className="text-[7.5px] uppercase font-bold tracking-wider leading-none text-emerald-700">Official Notice</span>
                   </div>
                )}
             </div>

             {/* Right side textual details */}
             <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                <div>
                   <div className="flex justify-between items-start gap-2 mb-1.5">
                      <div className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[8px] uppercase font-black tracking-wider">
                         {n.date}
                      </div>
                      {hasPermission('manage_notices') && (
                         <button onClick={(e) => deleteNotice(e, n.id)} disabled={isDayEndedForBranch()} title={isDayEndedForBranch() ? getDayEndedBlockMessage() : 'Delete Notice'} className="p-1 -mt-1 text-slate-300 hover:text-rose-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                            <Trash2 size={14} />
                         </button>
                      )}
                   </div>
                   <h3 className="text-xs md:text-sm font-extrabold uppercase tracking-tight text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-2 leading-snug">
                      {n.title}
                   </h3>
                   <p className="text-[10px] text-slate-400 font-normal leading-relaxed mt-1 line-clamp-2 normal-case">
                      {n.description}
                   </p>
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[8px] uppercase tracking-wider text-slate-400">
                   <div>
                      {n.attachmentUrl ? (
                         <span className="text-emerald-600">Attachment Included</span>
                      ) : (
                         <span>Text Only Notice</span>
                      )}
                   </div>
                   <div className="text-emerald-500 group-hover:translate-x-1 transition-transform flex items-center gap-0.5 font-extrabold">
                      View details <ChevronRight size={10} />
                   </div>
                </div>
             </div>
          </div>
        ))
      )}
    </div>
  );
};

const DocumentList = ({ documents, onView, onReload }: { documents: DownloadableDocument[], onView: (d: DownloadableDocument) => void, onReload: () => void }) => {
  const { hasPermission } = useAuth();

  const handleAction = (e: React.MouseEvent, doc: DownloadableDocument, type: 'view' | 'dl' | 'del') => {
    e.stopPropagation();
    if (type === 'view') {
      if (doc.fileUrl) {
        openFileInNewTab(doc.fileUrl, doc.title);
      } else {
        onView(doc);
      }
    }
    if (type === 'dl') {
      const link = document.createElement('a');
      link.href = doc.fileUrl;
      link.download = doc.fileName;
      link.click();
    }
    if (type === 'del') {
      if (window.confirm("Delete this document?")) {
        (async () => {
          await storageService.deleteDocument(doc.id);
          onReload();
        })();
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden font-black italic">
       <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-black border-collapse text-center">
             <thead>
                <tr className="bg-slate-950 text-white uppercase tracking-[0.2em] text-[7.5px] h-10">
                   <th className="p-2 text-left pl-6 w-16 opacity-30">#</th>
                   <th className="p-2 text-left">Resource Title / Category</th>
                   <th className="p-2">Upload Date</th>
                   <th className="p-2">File Type</th>
                   <th className="p-2 text-right pr-6">Actions</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {documents.length === 0 ? (
                   <tr>
                      <td colSpan={5} className="p-16 text-slate-200 uppercase tracking-[0.5em] font-black italic text-center">No downloadable documents found</td>
                   </tr>
                ) : (
                   documents.map((doc, idx) => (
                      <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                         <td className="p-2 text-left pl-6 text-slate-300 font-black">{idx + 1}</td>
                         <td className="p-2 text-left">
                            <div className="text-slate-950 uppercase text-[10px] leading-none mb-0.5 font-extrabold">{doc.title}</div>
                            <div className="text-[7.5px] text-slate-400 uppercase tracking-widest">{doc.category}</div>
                         </td>
                         <td className="p-2 text-slate-500 font-black italic text-[8.5px]">{doc.date}</td>
                         <td className="p-2">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[7.5px] uppercase text-slate-500">{doc.fileType}</span>
                         </td>
                         <td className="p-2 text-right pr-6">
                            <div className="flex items-center justify-end space-x-1.5">
                               <button 
                                 onClick={(e) => handleAction(e, doc, 'view')} 
                                 className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                 title="Open in New Tab"
                               >
                                  <Eye size={12} />
                               </button>
                               <button 
                                 onClick={(e) => handleAction(e, doc, 'dl')} 
                                 className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                 title="Download"
                               >
                                  <Download size={12} />
                               </button>
                               {hasPermission('manage_notices') && (
                                  <button 
                                    type="button"
                                    disabled={isDayEndedForBranch()}
                                    onClick={(e) => handleAction(e, doc, 'del')} 
                                    className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                                    title={isDayEndedForBranch() ? getDayEndedBlockMessage() : 'Delete'}
                                  >
                                     <Trash2 size={12} />
                                  </button>
                               )}
                            </div>
                         </td>
                      </tr>
                   ))
                )}
             </tbody>
          </table>
       </div>
    </div>
  );
};

// Popup Notice List Component (English UI)
const PopupNoticeList: React.FC<{
  popups: PopupNotice[];
  onPreview: (p: PopupNotice) => void;
  onEdit: (p: PopupNotice) => void;
  onReload: () => void;
}> = ({ popups, onPreview, onEdit, onReload }) => {
  const { hasPermission } = useAuth();

  const handleToggle = async (p: PopupNotice) => {
    try {
      await storageService.togglePopupNoticeStatus(p.id, !p.isActive);
      onReload();
    } catch (err) {
      console.error("Failed to toggle popup status", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this popup announcement?")) {
      try {
        await storageService.deletePopupNotice(id);
        onReload();
      } catch (err) {
        console.error("Failed to delete popup notice", err);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Grid of Popup Announcements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {popups.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center">
            <BellRing size={36} className="text-slate-300 mb-3" />
            <h4 className="text-slate-800 font-bold text-sm uppercase tracking-wider">No Popup Announcements</h4>
            <p className="text-slate-400 text-xs mt-1 max-w-md">
              Create a popup notice with message and optional photo to broadcast urgent information on user login.
            </p>
          </div>
        ) : (
          popups.map(p => {
            const priorityClass = 
              p.priority === 'Urgent' ? 'bg-rose-50 text-rose-700 border-rose-200' :
              p.priority === 'Important' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-emerald-50 text-emerald-700 border-emerald-200';

            return (
              <div 
                key={p.id}
                className={`bg-white rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between space-y-4 shadow-sm ${
                  p.isActive ? 'border-emerald-500/40' : 'border-slate-200 opacity-80'
                }`}
              >
                <div>
                  {/* Top Bar: Badges & Toggle */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${priorityClass}`}>
                        {p.priority || 'Normal'} Priority
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {p.targetBranchId === 'all' || !p.targetBranchId ? 'All Branches' : p.targetBranchId.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${p.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {hasPermission('manage_notices') && (
                        <button
                          type="button"
                          onClick={() => handleToggle(p)}
                          disabled={isDayEndedForBranch()}
                          className="text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isDayEndedForBranch() ? getDayEndedBlockMessage() : (p.isActive ? 'Turn Off Popup' : 'Activate Popup on Login')}
                        >
                          {p.isActive ? (
                            <ToggleRight size={26} className="text-emerald-600" />
                          ) : (
                            <ToggleLeft size={26} className="text-slate-300" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title & Message */}
                  <div className="flex items-start gap-3">
                    {p.imageUrl && !p.imageUrl.startsWith('[TRUNCATED') && (
                      <div className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                        <img 
                          src={p.imageUrl} 
                          alt={p.imageName || "Thumbnail"} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).parentElement?.classList.add('hidden');
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-1">
                        {p.title}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-3 leading-relaxed">
                        {p.message}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Info & Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-400">
                    <div className="flex items-center space-x-1">
                      <Calendar size={12} />
                      <span>{p.date || new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                    {p.validUntil && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        Active Until: {p.validUntil}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => onPreview(p)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1 transition-all"
                      title="Test Live Preview"
                    >
                      <Eye size={12} />
                      <span>Preview</span>
                    </button>

                    {hasPermission('manage_notices') && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEdit(p)}
                          disabled={isDayEndedForBranch()}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isDayEndedForBranch() ? getDayEndedBlockMessage() : "Edit Announcement"}
                        >
                          <Edit3 size={12} />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          disabled={isDayEndedForBranch()}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isDayEndedForBranch() ? getDayEndedBlockMessage() : "Delete"}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// Add / Edit Popup Notice Modal (English UI)
const AddEditPopupNoticeModal: React.FC<{
  initialData?: PopupNotice | null;
  onClose: () => void;
  onReload: () => void;
  onTestPreview: (p: PopupNotice) => void;
}> = ({ initialData, onClose, onReload, onTestPreview }) => {
  const { branch, branches } = useAuth();
  const isDayEnded = useDayEndLock(branch?.id);
  const [title, setTitle] = useState(initialData?.title || '');
  const [message, setMessage] = useState(initialData?.message || '');
  const [priority, setPriority] = useState<'Normal' | 'Important' | 'Urgent'>(initialData?.priority || 'Normal');
  const [targetBranchId, setTargetBranchId] = useState(initialData?.targetBranchId || 'all');
  const [isActive, setIsActive] = useState(initialData?.isActive !== undefined ? initialData.isActive : true);
  const [date, setDate] = useState(initialData?.date || new NepaliDate().format('YYYY-MM-DD'));
  const [validUntil, setValidUntil] = useState(initialData?.validUntil || '');
  const [actionButtonText, setActionButtonText] = useState(initialData?.actionButtonText || 'I Acknowledge & Understand');
  
  const calculateBsOffset = (days: number): string => {
    try {
      const todayNepali = new NepaliDate();
      const ad = todayNepali.toJsDate();
      ad.setDate(ad.getDate() + days);
      return new NepaliDate(ad).format('YYYY-MM-DD');
    } catch {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    }
  };

  type DurationType = 'today' | '3days' | 'week' | 'monthly' | 'until';

  const [durationMode, setDurationMode] = useState<DurationType>(() => {
    if (!initialData?.validUntil) return 'until';
    const v = initialData.validUntil;
    if (v === calculateBsOffset(0)) return 'today';
    if (v === calculateBsOffset(3)) return '3days';
    if (v === calculateBsOffset(7)) return 'week';
    if (v === calculateBsOffset(30)) return 'monthly';
    return 'until';
  });

  const cleanInitialImg = initialData?.imageUrl && !initialData.imageUrl.startsWith('[TRUNCATED') ? initialData.imageUrl : undefined;
  const [image, setImage] = useState<{ name?: string; url?: string } | null>(
    cleanInitialImg ? { name: initialData?.imageName || 'Attached Photo', url: cleanInitialImg } : null
  );
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, JPEG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawData = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.84);
          setImage({
            name: file.name,
            url: compressed
          });
        } else {
          setImage({
            name: file.name,
            url: rawData
          });
        }
      };
      img.onerror = () => {
        setImage({
          name: file.name,
          url: rawData
        });
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  };

  const currentPayload: PopupNotice = {
    id: initialData?.id || crypto.randomUUID(),
    title: title.trim(),
    message: message.trim(),
    imageUrl: image?.url,
    imageName: image?.name,
    priority,
    targetBranchId,
    isActive,
    date,
    validUntil: validUntil.trim() || undefined,
    showOnLogin: true,
    actionButtonText: actionButtonText.trim() || 'I Acknowledge & Understand',
    createdAt: initialData?.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !message.trim() && !image?.url) {
      setError('Please provide at least a Title, Image, or Message to create the popup.');
      return;
    }
    if (isBackDateBlockedForEntry(date)) {
      setError(getBackDateBlockedMessage(date));
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await storageService.savePopupNotice(currentPayload);
      try {
        window.dispatchEvent(new CustomEvent('saccos_popup_notice_updated', { detail: currentPayload }));
      } catch (e) {
        // ignore dispatch error
      }
      onReload();
      onClose();
    } catch (err: any) {
      console.error("Failed to save popup notice:", err);
      setError(err?.message || 'Failed to save popup notice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[2500] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-8">
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <BellRing size={20} />
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-wider text-white">
                  {initialData ? 'Edit Popup Announcement' : 'Create Login Popup Announcement'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure the image and message that will appear upon user login
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-5">
            <DayEndFieldset branchId={branch?.id} className="space-y-5">
            {error && (
              <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-rose-700 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                Title (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Urgent System Maintenance / Annual General Meeting / Happy Anniversary"
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>

            {/* Publish Date (BS) */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                Publish Date (BS)
              </label>
              <NepaliDatePicker
                value={date}
                onChange={setDate}
                disallowBackDateIfDisabled={true}
                disabled={isDayEnded}
                className="w-full"
              />
            </div>

            {/* Display Duration Selector (Today, 3 days, Week, Monthly, Until) */}
            <div className="space-y-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <Clock size={14} className="text-emerald-600" />
                  <span>Display Duration</span>
                </label>
                {validUntil ? (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded-lg">
                    Expires: {validUntil} (BS)
                  </span>
                ) : (
                  <span className="text-[10.5px] font-semibold text-slate-400">
                    No expiration date set
                  </span>
                )}
              </div>

              {/* Duration Buttons: Today, 3 days, Week, Monthly, Until */}
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2 pt-0.5">
                {[
                  { id: 'today', label: 'Today', days: 0 },
                  { id: '3days', label: '3 Days', days: 3 },
                  { id: 'week', label: 'Week', days: 7 },
                  { id: 'monthly', label: 'Monthly', days: 30 },
                  { id: 'until', label: 'Until', days: null },
                ].map((item) => {
                  const isSelected = durationMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setDurationMode(item.id as DurationType);
                        if (item.days !== null) {
                          setValidUntil(calculateBsOffset(item.days));
                        } else {
                          if (!validUntil) {
                            setValidUntil(calculateBsOffset(7));
                          }
                        }
                      }}
                      className={`py-2 px-1 text-center rounded-xl font-bold text-xs transition-all border ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/30'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                      }`}
                    >
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* If 'Until' mode is active, show the Custom BS Expiry Date Picker */}
              {durationMode === 'until' && (
                <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                    <span>Select Specific Expiry Date (BS):</span>
                    {validUntil && (
                      <button
                        type="button"
                        onClick={() => setValidUntil('')}
                        className="text-rose-500 hover:text-rose-700 text-[10px] font-bold lowercase"
                      >
                        clear date
                      </button>
                    )}
                  </div>
                  <NepaliDatePicker
                    value={validUntil}
                    onChange={(bsVal) => setValidUntil(bsVal)}
                    placeholder="Set custom expiry date (BS)"
                    disabled={isDayEnded}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* Row: Priority & Target Branch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                  Priority Level
                </label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500"
                >
                  <option value="Normal">Normal Priority (Green)</option>
                  <option value="Important">Important Priority (Amber)</option>
                  <option value="Urgent">Urgent Priority (Red Alert)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                  Target Branch
                </label>
                <select
                  value={targetBranchId}
                  onChange={e => setTargetBranchId(e.target.value)}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500"
                >
                  <option value="all">All Branches (Global Broadcast)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Photo / Image Attachment */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center justify-between">
                <span>Image</span>
                {image?.url && !image.url.startsWith('[TRUNCATED') && (
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    className="text-rose-500 hover:text-rose-700 text-[11px] font-bold lowercase"
                  >
                    Remove image
                  </button>
                )}
              </label>

              {image?.url && !image.url.startsWith('[TRUNCATED') ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center space-x-4">
                  <img
                    src={image.url}
                    alt={image.name || "Preview"}
                    className="w-20 h-20 object-contain rounded-xl border border-slate-300 bg-white"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{image.name || 'Attached Photo'}</p>
                    <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Image Attached</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-slate-500 hover:text-slate-800 underline mt-1 font-medium"
                    >
                      Change Image
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-emerald-50/30 transition-all"
                >
                  <ImageIcon size={28} className="text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Click to Upload Image
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">PNG, JPG, JPEG or WebP</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFile}
                className="hidden"
              />
            </div>

            {/* Main Message Content */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                Message
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Write any message details here (Optional if image is provided)..."
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-medium text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all leading-relaxed"
              />
            </div>

            {/* Active Status */}
            <div className="pt-2">
              <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="isActiveCheck" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                  Activate popup immediately on user login
                </label>
              </div>
            </div>
            </DayEndFieldset>
          </div>

          {/* Footer Bar */}
          <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onTestPreview(currentPayload)}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all"
            >
              <Eye size={14} />
              <span>Test Live Preview</span>
            </button>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-950 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <CheckCircle2 size={14} />
                <span>{submitting ? 'Saving...' : initialData ? 'Update Popup' : 'Save & Publish'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// Existing Modals
const AddNoticeModal = ({ onClose, onReload }: any) => {
  const { branch } = useAuth();
  const isDayEnded = useDayEndLock(branch?.id);
  const [formData, setFormData] = useState({ title: '', description: '', date: new NepaliDate().format('YYYY-MM-DD') });
  const [file, setFile] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFile = (e: any) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFile({
        name: f.name,
        type: f.type.startsWith('image/') ? 'image' : f.type === 'application/pdf' ? 'pdf' : 'other',
        url: reader.result
      });
    };
    reader.readAsDataURL(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description || submitting) return;
    if (isBackDateBlockedForEntry(formData.date)) {
      setError(getBackDateBlockedMessage(formData.date));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const notice: Notice = {
        id: crypto.randomUUID(),
        title: formData.title,
        description: formData.description,
        date: formData.date,
        attachmentUrl: file?.url,
        attachmentName: file?.name,
        attachmentType: file?.type,
        status: 'Active',
        branchId: branch?.id || '',
        createdAt: Date.now()
      };

      await storageService.saveNotice(notice);
      onReload();
      onClose();
    } catch (err: any) {
      console.error("Failed to save notice:", err);
      setError(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[2000] flex items-center justify-center p-6 italic font-black no-print">
       <div className="bg-white w-full max-w-2xl rounded-[3rem] border-2 border-slate-950 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          <form onSubmit={handleSubmit} className="p-10 space-y-6">
             <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-3">
                   <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><Megaphone size={24}/></div>
                   <h3 className="text-2xl italic tracking-tighter uppercase text-slate-900">Publish Official Notice</h3>
                </div>
                <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-rose-600 transition-all"><X size={24}/></button>
             </div>

             {error && (
                <div id="notice-error-banner" className="bg-rose-50 border-2 border-rose-500 rounded-3xl p-6 text-rose-700 text-[11px] italic font-black space-y-3 normal-case leading-relaxed">
                   <p className="text-xs font-extrabold uppercase text-rose-600">⚠️ Database Connection Notice</p>
                   <p>{error}</p>
                </div>
             )}
                    
             <DayEndFieldset branchId={branch?.id} className="space-y-4">
             <div className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Notice Title</label>
                   <input 
                     type="text" 
                     value={formData.title}
                     onChange={e => setFormData({...formData, title: e.target.value})}
                     className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 font-black text-sm outline-none focus:border-emerald-500 uppercase italic shadow-inner"
                     placeholder="ENTER NOTICE HEADING..."
                     required
                   />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Publication Date</label>
                      <NepaliDatePicker value={formData.date} onChange={v => setFormData({...formData, date: v})} disallowBackDateIfDisabled={true} disabled={isDayEnded} className="w-full" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Attach Media (Image/PDF)</label>
                      <button 
                        type="button" 
                        onClick={() => fileRef.current?.click()}
                        className={`w-full h-11 border-2 border-dashed rounded-2xl flex items-center justify-center space-x-2 transition-all ${file ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-emerald-500'}`}
                      >
                         {file ? <CheckCircle2 size={16}/> : <FileUp size={16}/>}
                         <span className="text-[10px] uppercase">{file ? file.name : 'Choose File'}</span>
                      </button>
                      <input ref={fileRef} type="file" className="hidden" onChange={handleFile} accept="image/*,.pdf" />
                   </div>
                </div>

                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Full Description</label>
                   <textarea 
                     value={formData.description}
                     onChange={e => setFormData({...formData, description: e.target.value})}
                     className="w-full h-40 bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 font-black text-xs outline-none focus:border-emerald-500 uppercase italic resize-none shadow-inner leading-relaxed"
                     placeholder="PROVIDE DETAILED INFORMATION, RULES, TIME, LOCATION ETC..."
                     required
                   />
                </div>
             </div>
             </DayEndFieldset>

             <div className="flex justify-end pt-6 border-t border-slate-50">
                <button type="submit" disabled={submitting || isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : undefined} className="bg-slate-950 text-white px-12 py-4 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:bg-emerald-600 transition-all active:scale-95 flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed">
                   <Megaphone size={18}/>
                   <span>Broadcast Notice</span>
                </button>
             </div>
          </form>
       </div>
    </div>
  );
};

const AddDocumentModal = ({ onClose, onReload }: any) => {
  const { branch } = useAuth();
  const isDayEnded = useDayEndLock(branch?.id);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Official Policy');
  const [file, setFile] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFile = (e: any) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFile({
        name: f.name,
        type: f.type.startsWith('image/') ? 'image' : f.type === 'application/pdf' ? 'pdf' : 'other',
        url: reader.result
      });
    };
    reader.readAsDataURL(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !file || submitting) return;

    setError(null);
    setSubmitting(true);
    try {
      const doc: DownloadableDocument = {
        id: crypto.randomUUID(),
        title,
        category,
        date: new NepaliDate().format('YYYY-MM-DD'),
        fileUrl: file.url,
        fileName: file.name,
        fileType: file.type,
        branchId: branch?.id || '',
        createdAt: Date.now()
      };

      await storageService.saveDocument(doc);
      onReload();
      onClose();
    } catch (err: any) {
      console.error("Failed to save document:", err);
      setError(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[2000] flex items-center justify-center p-6 italic font-black no-print">
       <div className="bg-white w-full max-w-lg rounded-[3rem] border-2 border-slate-950 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          <form onSubmit={handleSubmit} className="p-10 space-y-6">
             <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-3">
                   <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><FileUp size={24}/></div>
                   <h3 className="text-2xl italic tracking-tighter uppercase text-slate-900">Upload Shared Resource</h3>
                </div>
                <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-rose-600 transition-all"><X size={24}/></button>
             </div>

             {error && (
                <div id="document-error-banner" className="bg-rose-50 border-2 border-rose-500 rounded-3xl p-6 text-rose-700 text-[11px] italic font-black space-y-3 normal-case leading-relaxed">
                   <p className="text-xs font-extrabold uppercase text-rose-600">⚠️ Database Connection Notice</p>
                   <p>{error}</p>
                </div>
             )}

             <DayEndFieldset branchId={branch?.id}>
             <div className="space-y-5">
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Document Title</label>
                   <input 
                     type="text" 
                     value={title}
                     onChange={e => setTitle(e.target.value)}
                     className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 uppercase italic shadow-inner"
                     placeholder="E.G. BYLAWS 2082..."
                     required
                   />
                </div>

                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Registry Category</label>
                   <select 
                     value={category}
                     onChange={e => setCategory(e.target.value)}
                     className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 font-black text-xs outline-none focus:border-blue-500 uppercase italic"
                   >
                      <option>Official Policy</option>
                      <option>Form Templates</option>
                      <option>Annual Reports</option>
                      <option>Circulars</option>
                      <option>KYC Documents</option>
                   </select>
                </div>

                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Select Local File</label>
                   <div 
                     onClick={() => fileRef.current?.click()}
                     className={`w-full p-8 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center space-y-3 cursor-pointer transition-all ${file ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-300 hover:border-blue-500 hover:text-blue-500'}`}
                   >
                      {file ? (
                        <>
                           <CheckCircle2 size={32}/>
                           <span className="text-[10px] uppercase text-center">{file.name}</span>
                        </>
                      ) : (
                        <>
                           <Download size={32} className="opacity-20" />
                           <span className="text-[10px] uppercase">Click to Select PDF or Image</span>
                        </>
                      )}
                   </div>
                   <input ref={fileRef} type="file" className="hidden" onChange={handleFile} accept="image/*,.pdf" />
                </div>
             </div>
             </DayEndFieldset>

             <div className="flex justify-end pt-6 border-t border-slate-50">
                <button type="submit" disabled={submitting || isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : undefined} className="w-full bg-slate-950 text-white h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:bg-blue-600 transition-all active:scale-95 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed">
                   <ShieldCheck size={20}/>
                   <span>Establish Record</span>
                </button>
             </div>
          </form>
       </div>
    </div>
  );
};

const ViewNoticeModal = ({ notice, onClose }: { notice: Notice, onClose: () => void }) => (
  <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-[3000] flex items-center justify-center p-6 italic font-black">
     <div className="bg-white w-full max-w-4xl h-[90vh] rounded-[3rem] border-2 border-slate-950 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-8 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center shrink-0">
           <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><Megaphone size={24}/></div>
              <div>
                 <h3 className="text-xl italic tracking-tighter uppercase text-slate-900 leading-none mb-1">Official Broadcast</h3>
                 <div className="text-[9px] text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                    <Calendar size={10}/> <span>PUBLISHED: {notice.date}</span>
                 </div>
              </div>
           </div>
           <button onClick={onClose} className="p-3 bg-white border-2 border-slate-200 rounded-2xl text-slate-400 hover:text-rose-600 transition-all shadow-sm"><X size={24}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-12 space-y-12">
           <div className="max-w-2xl mx-auto space-y-6">
              <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 italic border-b-4 border-emerald-500 inline-block pr-8 pb-2">
                 {notice.title}
              </h1>
              <p className="text-lg text-slate-600 font-bold uppercase tracking-wide leading-relaxed">
                 {notice.description}
              </p>
           </div>

           {notice.attachmentUrl && (
              <div className="max-w-3xl mx-auto bg-slate-50 p-8 rounded-[3rem] border-2 border-slate-100 shadow-inner">
                 <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                       <Paperclip className="text-emerald-500" size={20}/>
                       <span className="text-xs uppercase font-black text-slate-400">Attached Resource: {notice.attachmentName}</span>
                    </div>
                    <a href={notice.attachmentUrl} download={notice.attachmentName} className="flex items-center space-x-2 bg-slate-950 text-white px-6 py-2 rounded-xl text-[9px] uppercase tracking-widest hover:bg-emerald-600 transition-all">
                       <Download size={14}/>
                       <span>Save Locally</span>
                    </a>
                 </div>
                 
                 {notice.attachmentType === 'image' ? (
                    <div className="rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl">
                       <img src={notice.attachmentUrl} className="w-full object-contain max-h-[600px]" alt="Notice Attachment" referrerPolicy="no-referrer" />
                    </div>
                 ) : notice.attachmentType === 'pdf' ? (
                    <div className="h-[600px] rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl bg-white">
                       <iframe src={notice.attachmentUrl} className="w-full h-full" title="PDF Preview" />
                    </div>
                 ) : (
                    <div className="p-12 text-center">
                       <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl"><FileText size={40} className="text-slate-300"/></div>
                       <p className="text-slate-400 uppercase text-[10px]">Preview unavailable for this file type</p>
                    </div>
                 )}
              </div>
           )}
        </div>
        <div className="p-8 bg-slate-950 text-white flex items-center justify-between shrink-0">
           <div className="text-[10px] uppercase font-black tracking-widest opacity-60 italic">Authorized System Registry Entry</div>
           <button onClick={onClose} className="px-10 py-3 bg-white text-slate-950 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 hover:text-white transition-all">Close Portal</button>
        </div>
     </div>
  </div>
);

const ViewDocumentModal = ({ doc, onClose }: { doc: DownloadableDocument, onClose: () => void }) => (
  <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-[3000] flex items-center justify-center p-6 italic font-black">
     <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[3rem] border-2 border-slate-950 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-8 border-b-2 border-slate-100 flex justify-between items-center bg-slate-50 italic">
           <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><Eye size={24}/></div>
              <div>
                 <h3 className="text-xl uppercase tracking-tighter leading-none mb-1">{doc.title}</h3>
                 <span className="text-[9px] text-slate-400 uppercase tracking-widest">{doc.category} • Resource ID: {doc.id.slice(0,8)}</span>
              </div>
           </div>
           <div className="flex items-center space-x-4">
              <a href={doc.fileUrl} download={doc.fileName} className="flex items-center space-x-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-950 transition-all shadow-xl shadow-emerald-100">
                 <Download size={18}/>
                 <span>Download Locally</span>
              </a>
              <button onClick={onClose} className="p-3 bg-white border-2 border-slate-200 rounded-2xl text-slate-400 hover:text-rose-600 transition-all"><X size={24}/></button>
           </div>
        </div>
        <div className="flex-1 bg-slate-100 p-12 overflow-hidden flex items-center justify-center">
           {doc.fileType === 'image' ? (
              <div className="max-w-full max-h-full rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white bg-white">
                 <img src={doc.fileUrl} className="max-w-full max-h-[70vh] object-contain" alt="Document Preview" referrerPolicy="no-referrer" />
              </div>
           ) : doc.fileType === 'pdf' ? (
              <div className="w-full h-full rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white bg-white">
                 <iframe src={doc.fileUrl} className="w-full h-full" title="PDF Document" />
              </div>
           ) : (
              <div className="text-center p-24 bg-white rounded-[3rem] shadow-xl border-2 border-slate-200">
                 <FileText size={80} className="text-slate-100 mx-auto mb-6" />
                 <h4 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-2 italic">Format Not Supported</h4>
                 <p className="text-xs text-slate-400 uppercase tracking-widest mb-8">Direct preview is not available for this file type. Please download to view.</p>
                 <a href={doc.fileUrl} download={doc.fileName} className="inline-flex items-center space-x-3 bg-slate-950 text-white px-12 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all">
                    <Download size={20}/>
                    <span>Download File</span>
                 </a>
              </div>
           )}
        </div>
     </div>
  </div>
);

export default NoticeDownload;
