'use client';
import { X } from "lucide-react";

interface DeleteDocumentDialogProps {
    open: boolean;
    documentName?: string;
    loading: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function DeleteDocumentDialog({
    open,
    documentName,
    loading,
    onConfirm,
    onCancel,
}: DeleteDocumentDialogProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Delete Document
                    </h2>

                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">

                    <p className="text-sm text-gray-600 leading-6">
                        Are you sure you want to delete{" "}
                        <span className="font-medium text-gray-900">
                            "{documentName}"
                        </span>
                        ?
                    </p>

                    <p className="mt-3 text-xs text-gray-500">
                        This action removes the document from the active document vault.
                    </p>

                </div>
                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                        {loading ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
}