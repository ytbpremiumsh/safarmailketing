import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Settings,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const BASE_URL = "https://stackapi.mailketing.co.id/api/v2";

type Action = "credits" | "senders" | "lists" | "send" | "subscriber";
type MailketingInput = {
  action: Action;
  token: string;
  fromName?: string;
  fromEmail?: string;
  subject?: string;
  recipients?: string[];
  content?: string;
  listId?: number;
  subscriber?: { email: string; first_name?: string; last_name?: string; mobile?: string };
};

type ApiResult = {
  success: boolean;
  message: string;
  data?: unknown;
  results?: Array<{ recipient: string; success: boolean; message: string }>;
};

const callMailketing = createServerFn({ method: "POST" })
  .validator((input: MailketingInput) => input)
  .handler(async ({ data }): Promise<ApiResult> => {
    const token = data.token?.trim();
    if (!token) return { success: false, message: "API token wajib diisi." };

    const request = async (path: string, init?: RequestInit) => {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-Api-Token": token,
          ...(init?.headers ?? {}),
        },
      });
      const payload = (await response.json().catch(() => null)) as ApiResult | null;
      if (!payload) return { success: false, message: `Mailketing merespons HTTP ${response.status}.` };
      return payload;
    };

    if (data.action === "credits") return request("/credits");
    if (data.action === "senders") return request("/senders");
    if (data.action === "lists") return request("/lists");
    if (data.action === "subscriber") {
      if (!data.listId || !data.subscriber?.email) {
        return { success: false, message: "List dan email subscriber wajib diisi." };
      }
      return request("/subscribers", {
        method: "POST",
        body: JSON.stringify({ list_id: data.listId, ...data.subscriber }),
      });
    }

    const recipients = [...new Set((data.recipients ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean))];
    if (!data.fromName || !data.fromEmail || !data.subject || !data.content || recipients.length === 0) {
      return { success: false, message: "Data pengirim, subjek, isi, dan penerima wajib dilengkapi." };
    }
    if (recipients.length > 100) return { success: false, message: "Maksimal 100 penerima dalam satu proses." };

    const results: Array<{ recipient: string; success: boolean; message: string }> = [];
    for (const recipient of recipients) {
      const response = await request("/send", {
        method: "POST",
        body: JSON.stringify({
          from_name: data.fromName,
          from_email: data.fromEmail,
          subject: data.subject.replaceAll("{{email}}", recipient),
          recipient,
          content: data.content.replaceAll("{{email}}", recipient),
        }),
      });
      results.push({ recipient, success: response.success, message: response.message });
    }
    const sent = results.filter((item) => item.success).length;
    return {
      success: sent === results.length,
      message: `${sent} dari ${results.length} email berhasil dimasukkan ke antrean.`,
      results,
    };
  });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Safar Mail — Email Marketing Dashboard" },
      { name: "description", content: "Dashboard pengiriman email menggunakan Mailketing API." },
    ],
  }),
  component: Index,
});

type View = "compose" | "subscribers" | "settings";

function Index() {
  const [view, setView] = useState<View>("compose");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<ApiResult | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [senders, setSenders] = useState<string[]>([]);
  const [lists, setLists] = useState<Array<{ list_id: number; list_name: string }>>([]);
  const [fromName, setFromName] = useState("Safar Iman");
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [recipientsText, setRecipientsText] = useState("");
  const [content, setContent] = useState("<h2>Assalamu'alaikum</h2><p>Tulis pesan Anda di sini.</p>");
  const [listId, setListId] = useState("");
  const [subscriber, setSubscriber] = useState({ email: "", first_name: "", last_name: "", mobile: "" });

  useEffect(() => {
    const saved = window.sessionStorage.getItem("safar-mailketing-token");
    if (saved) setToken(saved);
  }, []);

  const recipients = useMemo(
    () => recipientsText.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean),
    [recipientsText],
  );

  const run = async (input: Omit<MailketingInput, "token">) => {
    setLoading(true);
    setNotice(null);
    try {
      const result = await callMailketing({ data: { ...input, token } });
      setNotice(result);
      return result;
    } catch {
      const result = { success: false, message: "Tidak dapat terhubung ke server aplikasi." };
      setNotice(result);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const connect = async () => {
    const result = await run({ action: "credits" });
    if (!result.success) return;
    const value = (result.data as { credits?: number } | undefined)?.credits;
    setCredits(typeof value === "number" ? value : null);
    setConnected(true);
    window.sessionStorage.setItem("safar-mailketing-token", token);
    const [senderResult, listResult] = await Promise.all([
      callMailketing({ data: { action: "senders", token } }),
      callMailketing({ data: { action: "lists", token } }),
    ]);
    const senderData = senderResult.data as { senders?: Array<{ email: string }> } | undefined;
    const listData = listResult.data as { lists?: Array<{ list_id: number; list_name: string }> } | undefined;
    const emails = senderData?.senders?.map((item) => item.email) ?? [];
    setSenders(emails);
    if (!fromEmail && emails[0]) setFromEmail(emails[0]);
    setLists(listData?.lists ?? []);
    setNotice({ success: true, message: "API Mailketing berhasil terhubung." });
  };

  const sendEmail = async () => {
    if (!confirm(`Kirim email kepada ${recipients.length} penerima? Setiap email akan memakai 1 kredit.`)) return;
    await run({ action: "send", fromName, fromEmail, subject, recipients, content });
  };

  const addSubscriber = async () => {
    const result = await run({ action: "subscriber", listId: Number(listId), subscriber });
    if (result.success) setSubscriber({ email: "", first_name: "", last_name: "", mobile: "" });
  };

  const nav = [
    { id: "compose" as const, label: "Kirim Email", icon: Send },
    { id: "subscribers" as const, label: "Subscriber", icon: Users },
    { id: "settings" as const, label: "Pengaturan API", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white"><Mail size={21} /></div>
            <div><h1 className="font-bold tracking-tight">Safar Mail</h1><p className="text-xs text-slate-500">Mailketing Email Dashboard</p></div>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-slate-50 px-3 py-2 text-sm">
            <span className={`size-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
            {connected ? "Terhubung" : "Belum terhubung"}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_1fr]">
        <aside className="h-fit rounded-2xl border bg-white p-3 shadow-sm">
          <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Dashboard Admin</p>
          <nav className="grid gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {nav.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setView(id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${view === id ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50"}`}>
                <Icon size={18} /> {label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><WalletCards /></div><div><p className="text-sm text-slate-500">Sisa Kredit</p><p className="text-2xl font-bold">{credits ?? "—"}</p></div></CardContent></Card>
            <Card><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Mail /></div><div><p className="text-sm text-slate-500">Sender Terverifikasi</p><p className="text-2xl font-bold">{senders.length}</p></div></CardContent></Card>
          </div>

          {notice && <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${notice.success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{notice.success ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}<div><p className="font-semibold">{notice.success ? "Berhasil" : "Terjadi kendala"}</p><p>{notice.message}</p></div></div>}

          {view === "settings" && (
            <Card><CardHeader><CardTitle>Pengaturan Mailketing API</CardTitle><p className="text-sm text-slate-500">Token hanya disimpan selama sesi browser dan diteruskan melalui server aplikasi.</p></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="token">API Token</Label><div className="relative"><Input id="token" type={showToken ? "text" : "password"} value={token} onChange={(e) => { setToken(e.target.value); setConnected(false); }} placeholder="Masukkan token dari API Integration" className="pr-11" /><button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-2.5 text-slate-400">{showToken ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div><Button onClick={connect} disabled={loading || !token} className="bg-emerald-600 hover:bg-emerald-700">{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Uji & Simpan Sesi</Button></CardContent></Card>
          )}

          {view === "compose" && (
            <Card><CardHeader><CardTitle>Kirim Email</CardTitle><p className="text-sm text-slate-500">Kirim email transaksional ke satu atau beberapa penerima.</p></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Nama Pengirim"><Input value={fromName} onChange={(e) => setFromName(e.target.value)} /></Field><Field label="Email Pengirim">{senders.length ? <select value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} className="h-9 w-full rounded-md border bg-white px-3 text-sm">{senders.map((email) => <option key={email}>{email}</option>)}</select> : <Input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="noreply@domain-terverifikasi.com" />}</Field></div><Field label="Subjek"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subjek email" /></Field><Field label={`Penerima (${recipients.length}/100)`}><Textarea value={recipientsText} onChange={(e) => setRecipientsText(e.target.value)} placeholder={'satu@email.com\ndua@email.com'} rows={5} /><p className="text-xs text-slate-500">Pisahkan alamat dengan baris baru, koma, atau titik koma.</p></Field><Field label="Konten HTML"><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={11} className="font-mono text-sm" /><p className="text-xs text-slate-500">Gunakan <code>{"{{email}}"}</code> untuk memasukkan email penerima.</p></Field><div className="flex justify-end"><Button onClick={sendEmail} disabled={loading || !connected || recipients.length === 0} className="bg-emerald-600 hover:bg-emerald-700">{loading ? <Loader2 className="animate-spin" /> : <Send />} Kirim {recipients.length || ""} Email</Button></div></CardContent></Card>
          )}

          {view === "subscribers" && (
            <Card><CardHeader><CardTitle>Tambah Subscriber</CardTitle><p className="text-sm text-slate-500">Tambahkan kontak langsung ke list Mailketing.</p></CardHeader><CardContent className="space-y-4"><Field label="List Tujuan"><select value={listId} onChange={(e) => setListId(e.target.value)} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><option value="">Pilih list</option>{lists.map((list) => <option key={list.list_id} value={list.list_id}>{list.list_name}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Email"><Input type="email" value={subscriber.email} onChange={(e) => setSubscriber({ ...subscriber, email: e.target.value })} /></Field><Field label="Nomor HP"><Input value={subscriber.mobile} onChange={(e) => setSubscriber({ ...subscriber, mobile: e.target.value })} placeholder="0812..." /></Field><Field label="Nama Depan"><Input value={subscriber.first_name} onChange={(e) => setSubscriber({ ...subscriber, first_name: e.target.value })} /></Field><Field label="Nama Belakang"><Input value={subscriber.last_name} onChange={(e) => setSubscriber({ ...subscriber, last_name: e.target.value })} /></Field></div><Button onClick={addSubscriber} disabled={loading || !connected || !listId || !subscriber.email} className="bg-emerald-600 hover:bg-emerald-700">Tambah Subscriber <ChevronRight /></Button></CardContent></Card>
          )}
        </main>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
