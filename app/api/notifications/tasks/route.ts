import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth/config";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.name) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const userName = session.user.name.trim();
    const obligations = await prisma.complianceObligation.findMany({
        where: {
            owner: userName,
            status: {
                not: "completed",
            },
        },
        include: {
            entity: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: {
            dueDate: "asc",
        },
    });

    const now = new Date();

    const tasks = obligations.map((item) => {
        const diffDays = Math.ceil(
            (item.dueDate.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        let priority: "critical" | "warning" | "info";
        let status: string;

        if (diffDays < 0) {
            priority = "critical";
            status = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"
                }`;
        } else if (diffDays <= 7) {
            priority = "warning";
            status =
                diffDays === 0
                    ? "Due today"
                    : `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
        } else {
            priority = "info";
            status = `Due in ${diffDays} days`;
        }

        return {
            id: item.id,
            type: "compliance",

            priority,

            title: item.requirementType,

            entityName: item.entity?.name ?? "",

            dueDate: item.dueDate,

            status,

            url: `/compliance?id=${item.id}`,
        };
    });

    return NextResponse.json({
        tasks,
    });
}