import React, { useState } from 'react';
import { Trash2, ChevronRight, CheckSquare, Square, History as HistoryIcon } from 'lucide-react';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function RightHistory({ 
  campaigns = [], 
  activeCampaignId, 
  onSelectCampaign, 
  onClearHistory,
  onDeleteCampaign
}) {
  const [selectedIds, setSelectedIds] = useState(['1']);
  const [campaignToDelete, setCampaignToDelete] = useState(null);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <aside className="w-72 bg-[#fbfbfe] border-l border-gray-200/80 flex flex-col justify-between h-full p-4 select-none shrink-0">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-800 text-sm">Campaign History</h3>
          </div>
          <span className="text-[11px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
            {campaigns.length}/50
          </span>
        </div>

        {/* History List matching user reference image */}
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-140px)] pr-1">
          {campaigns.map((item) => {
            const isChecked = selectedIds.includes(item.id);
            const isCurrentActive = activeCampaignId === item.id;

            return (
              <div
                key={item.id}
                onClick={() => onSelectCampaign && onSelectCampaign(item)}
                className={`group relative p-3 rounded-2xl border transition-all cursor-pointer ${
                  isCurrentActive
                    ? 'bg-white border-orange-200/90 shadow-sm shadow-orange-500/5'
                    : 'bg-white/70 border-gray-100 hover:bg-white hover:border-gray-200 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <button 
                    onClick={(e) => toggleSelect(item.id, e)}
                    className="mt-0.5 text-gray-400 hover:text-orange-500 transition"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-orange-500 fill-orange-50" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <h5 className="font-semibold text-xs text-gray-800 truncate mb-0.5">
                      {item.title}
                    </h5>
                    <p className="text-[11px] text-gray-400 truncate leading-tight">
                      {item.query}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60">
                        {item.leadsCount} leads scraped
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCampaignToDelete(item);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                      title="Delete Campaign"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Clear History Action matching reference */}
      <div className="pt-3 border-t border-gray-100">
        <button
          onClick={() => setShowClearHistoryConfirm(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium text-gray-500 hover:text-rose-600 hover:bg-rose-50 border border-gray-200/70 transition bg-white cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 text-gray-400" />
          <span>Clear history</span>
        </button>
      </div>

      {/* Single Campaign Delete Confirmation */}
      <DeleteConfirmModal 
        isOpen={!!campaignToDelete}
        title="Delete Campaign"
        message={`Are you sure you want to delete "${campaignToDelete?.title}" from your history?`}
        itemCount={campaignToDelete?.leadsCount || 0}
        itemCountLabel="leads"
        confirmText="Delete Campaign"
        onConfirm={() => {
          if (campaignToDelete && onDeleteCampaign) {
            onDeleteCampaign(campaignToDelete.id);
          }
          setCampaignToDelete(null);
        }}
        onClose={() => setCampaignToDelete(null)}
      />

      {/* Clear All History Confirmation */}
      <DeleteConfirmModal 
        isOpen={showClearHistoryConfirm}
        title="Clear All Campaign History"
        message="Are you sure you want to clear all campaign history? This will remove all campaigns from your sidebar."
        itemCount={campaigns.length}
        itemCountLabel="campaigns"
        confirmText="Clear All History"
        onConfirm={() => {
          if (onClearHistory) onClearHistory();
          setShowClearHistoryConfirm(false);
        }}
        onClose={() => setShowClearHistoryConfirm(false)}
      />
    </aside>
  );
}
