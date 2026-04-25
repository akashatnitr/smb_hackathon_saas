"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { trpc } from "@/trpc/client";
import {
  ArrowLeft,
  FileText,
  Send,
  PenTool,
  CheckCircle,
  Calendar,
  User,
} from "lucide-react";

export default function ContractDetailPage() {
  const router = useRouter();
  const params = useParams();
  const contractId = params.id as string;
  const utils = trpc.useUtils();
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [showSignForm, setShowSignForm] = useState(false);

  const { data: contract, isLoading } = trpc.contract.get.useQuery({
    id: contractId,
  });

  const updateMutation = trpc.contract.update.useMutation({
    onSuccess: () => utils.contract.get.invalidate({ id: contractId }),
  });

  const signMutation = trpc.contract.sign.useMutation({
    onSuccess: () => {
      utils.contract.get.invalidate({ id: contractId });
      setShowSignForm(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-12 text-gray-500">
        Contract not found.
      </div>
    );
  }

  const statusColors = {
    DRAFT: "bg-gray-100 text-gray-700",
    SENT: "bg-blue-100 text-blue-700",
    SIGNED: "bg-green-100 text-green-700",
    EXPIRED: "bg-red-100 text-red-700",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/contracts")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {contract.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {contract.status === "DRAFT" && (
            <button
              onClick={() =>
                updateMutation.mutate({
                  id: contract.id,
                  status: "SENT",
                })
              }
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
              Mark as Sent
            </button>
          )}
          {contract.status !== "SIGNED" && (
            <button
              onClick={() => setShowSignForm(!showSignForm)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <PenTool className="w-4 h-4" />
              Sign
            </button>
          )}
        </div>
      </div>

      {/* Metadata bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span
              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                statusColors[contract.status as keyof typeof statusColors]
              }`}
            >
              {contract.status}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400" />
            {new Date(contract.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          {contract.client && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4 text-gray-400" />
              {contract.client.name}
            </div>
          )}
          {contract.signatures.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              Signed by {contract.signatures[0].signerName}
            </div>
          )}
        </div>
      </div>

      {/* Sign form */}
      {showSignForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-indigo-200">
          <h3 className="font-semibold text-gray-900 mb-4">
            Sign this document
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              placeholder="Signer name *"
              className="px-3 py-2 border rounded-lg"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
            <input
              placeholder="Signer email *"
              type="email"
              className="px-3 py-2 border rounded-lg"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
            />
          </div>
          <button
            onClick={() =>
              signMutation.mutate({
                contractId: contract.id,
                signerName,
                signerEmail,
                signatureData: `Signed by ${signerName} (${signerEmail}) on ${new Date().toISOString()}`,
              })
            }
            disabled={!signerName || !signerEmail || signMutation.isPending}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {signMutation.isPending ? "Signing..." : "Confirm Signature"}
          </button>
        </div>
      )}

      {/* Contract content */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: contract.content }}
        />
      </div>
    </div>
  );
}
