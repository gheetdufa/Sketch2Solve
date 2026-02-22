"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getCard } from "@/lib/api";
import { MentalModelCard } from "@/components/MentalModelCard";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CardPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [card, setCard] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getCard(sessionId)
      .then((data) => {
        if (data.error) setError(data.error);
        else setCard(data);
      })
      .catch(() => setError("Failed to load card"));
  }, [sessionId]);

  return (
    <div className="min-h-screen p-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-coach-muted hover:text-coach-text mb-8 transition-colors"
      >
        <ArrowLeft size={14} />
        New Session
      </Link>

      {error && <p className="text-red-400 text-center">{error}</p>}
      {card && <MentalModelCard card={card} />}
      {!card && !error && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-coach-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
