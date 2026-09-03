import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kalkulator Penjumlahan Sederhana" },
      { name: "description", content: "Kalkulator penjumlahan sangat sederhana: tambahkan dua angka dari 1 sampai 5." },
      { property: "og:title", content: "Kalkulator Penjumlahan Sederhana" },
      { property: "og:description", content: "Kalkulator penjumlahan sangat sederhana: tambahkan dua angka dari 1 sampai 5." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const ANGKA = [1, 2, 3, 4, 5];

function Index() {
  const [a, setA] = useState<number | "">("");
  const [b, setB] = useState<number | "">("");
  const [hasil, setHasil] = useState<number | null>(null);

  const angkaValid = (nilai: number | ""): nilai is number => {
    return typeof nilai === "number" && ANGKA.includes(nilai);
  };

  const hitung = () => {
    if (angkaValid(a) && angkaValid(b)) {
      setHasil(a + b);
    } else {
      setHasil(null);
    }
  };

  const reset = () => {
    setA("");
    setB("");
    setHasil(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">Kalkulator Sederhana</CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            Tambahkan dua angka dari 1 sampai 5
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={5}
              value={a}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                setA(val);
                setHasil(null);
              }}
              placeholder="1-5"
              className="text-center text-lg"
              aria-label="Angka pertama"
            />
            <span className="text-2xl font-semibold text-foreground">+</span>
            <Input
              type="number"
              min={1}
              max={5}
              value={b}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                setB(val);
                setHasil(null);
              }}
              placeholder="1-5"
              className="text-center text-lg"
              aria-label="Angka kedua"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button onClick={hitung} className="w-full">
              Hitung
            </Button>
            <Button variant="outline" onClick={reset} className="w-full">
              Reset
            </Button>
          </div>

          {hasil !== null && (
            <div className="rounded-lg bg-secondary p-4 text-center">
              <p className="text-sm text-muted-foreground">Hasil</p>
              <p className="text-3xl font-bold text-foreground" aria-live="polite">
                {a} + {b} = {hasil}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
