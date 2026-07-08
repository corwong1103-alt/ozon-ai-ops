import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { FactoryWorkbench } from "@/components/FactoryWorkbench";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "lucide-react";

export default async function FactoryWorkbenchPage({ params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({
    where: { id: params.id, userId: user.id }
  });

  if (!product) notFound();

  return (
    <AppShell title="商品制作" eyebrow="STEP 2 / AI Workspace" user={user}>
      <Link href="/factory" className="mb-4 inline-flex items-center gap-1 text-xs text-steel hover:text-earth">
        <ArrowLeft size={13} /> 返回商品制作
      </Link>
      <FactoryWorkbench product={{
        id: product.id,
        title: product.title,
        description: product.description,
        price: Number(product.price),
        currency: product.currency,
        images: product.images,
        status: product.status,
        source: product.source
      }} />
    </AppShell>
  );
}
