'use client';

import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface UploadItem {
    id: string;
    file: File;
    status: 'queued' | 'uploading' | 'uploaded' | 'failed';
    progress: number;
    error?: string;
}

interface UploadSummaryDialogProps {
    open: boolean;
    uploads: UploadItem[];
    onClose: () => void;
}

export default function UploadSummaryDialog({
    open,
    uploads,
    onClose,
}: UploadSummaryDialogProps) {
    if (!open) return null;

    // -----------------------------------------------------------------------------
    // Calculate upload outcome statistics.
    // Used for summary counts displayed at the bottom of the dialog.
    // -----------------------------------------------------------------------------
    // -----------------------------------------------------------------------------
    // Determine the overall upload result to display an appropriate dialog title.
    // -----------------------------------------------------------------------------
    const uploaded = uploads.filter(u => u.status === "uploaded");
    const failed = uploads.filter(u => u.status === "failed");

    const title =
        failed.length === 0
            ? "Upload Complete"
            : uploaded.length === 0
                ? "Upload Failed"
                : "Upload Finished";

    const subtitle =
        failed.length === 0
            ? "All selected documents were uploaded successfully."
            : uploaded.length === 0
                ? "No documents were uploaded."
                : "Some documents could not be uploaded.";

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            {title}
                        </h2>

                        <p className="text-sm text-gray-500">
                            {subtitle}
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-4 space-y-3 max-h-80 overflow-y-auto">

                    {uploads.map(upload => (
                        <div
                            key={upload.id}
                            className="flex items-start gap-3"
                        >
                            {upload.status === "uploaded" ? (
                                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                            )}

                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                    {upload.file.name}
                                </p>

                                <p className="text-xs text-gray-500">
                                    {upload.status === "uploaded"
                                        ? "Uploaded successfully"
                                        : upload.error}
                                </p>
                            </div>
                        </div>
                    ))}

                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">

                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            ✓ {uploaded.length} Uploaded
                        </span>

                        {failed.length > 0 && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                ✕ {failed.length} Failed
                            </span>
                        )}

                    </div>

                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                        Close
                    </button>

                </div>

            </div>
        </div>
    );
}