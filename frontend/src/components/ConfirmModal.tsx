"use client";

import { useState } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmColor?: "emerald" | "purple" | "blue" | "amber";
  onConfirm: () => Promise<string>;
  onClose: () => void;
}

const colorMap = {
  emerald: "bg-emerald-600 hover:bg-emerald-500",
  purple: "bg-purple-600 hover:bg-purple-500",
  blue: "bg-blue-600 hover:bg-blue-500",
  amber: "bg-amber-600 hover:bg-amber-500",
};

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  confirmColor = "emerald",
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleConfirm = async () => {
    setRunning(true);
    setError(null);
    try {
      const msg = await onConfirm();
      setResult(msg);
    } catch {
      setError("Action failed. Please check if the backend is running.");
    }
    setRunning(false);
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={!running ? handleClose : undefined} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
        {/* Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[confirmColor]} text-white`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 leading-relaxed mb-6">{description}</p>

        {/* Result / Error */}
        {result && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm text-emerald-700 font-medium">Success</p>
            <p className="text-sm text-emerald-600 mt-1">{result}</p>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">Error</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {result ? (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                disabled={running}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={running}
                className={`px-4 py-2 ${colorMap[confirmColor]} disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2`}
              >
                {running && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                )}
                {running ? "Running..." : confirmLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
