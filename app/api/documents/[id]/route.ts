import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { writeRequestAuditLog } from "@/lib/audit";
import { getAuthSession } from "@/lib/auth/session";

// Soft delete document by ID
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const document = await prisma.document.findUnique({
            where: { id },
        });

        if (!document) {
            return NextResponse.json(
                { error: "Document not found." },
                { status: 404 }
            );
        }
        // Gets the authenticated user performing the delete.
        const session = await getAuthSession();
        console.log("DELETE called for:", id);
        const deleted = await prisma.document.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                // Audit helper already captures who performed the action.
                // This field stores it directly on the document as well.
                deletedBy:
                    session?.user?.name ??
                    session?.user?.email ??
                    "Unknown",
            },
        });

        console.log("Soft deleted document:", {
            id: deleted.id,
            deletedAt: deleted.deletedAt,
            deletedBy: deleted.deletedBy,
        });

        await writeRequestAuditLog(request, {
            action: "DELETE",
            tableName: "documents",
            recordId: id,
            entityId: document.entityId,
            oldValues: document,
            newValues: deleted,
        });

        return NextResponse.json({
            success: true,
        });
    } catch (err) {
        console.error("[DELETE /api/documents/:id]", err);

        return NextResponse.json(
            { error: "Failed to delete document." },
            { status: 500 }
        );
    }
}