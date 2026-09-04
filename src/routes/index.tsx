import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  History,
  KeyRound,
  LayoutTemplate,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  Send,
  Settings,
  Trash2,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const SB_URL = "https://tbfndctalcrsebgocoto.supabase.co";
const SB_KEY = "sb_publishable_ug0zaXKB6aW4A37vICRzCw_cj8X-XjI";
const headers = (token?: string) => ({
  apikey: SB_KEY,
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});
type Notice = { success: boolean; message: string };
type Session = {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
};
type Contact = {
  id: string;
  email: string;
  registration_code?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  mobile?: string;
  category?: string;
  custom_fields?: Record<string, string>;
};
type Template = {
  id: string;
  name: string;
  subject: string;
  html_content: string;
};
type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
  scheduled_at?: string;
  created_at: string;
};
type View =
  "dashboard" | "compose" | "contacts" | "templates" | "history" | "settings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Safar Mail — Email Marketing" },
      {
        name: "description",
        content: "Dashboard email marketing Mailketing untuk Safar Iman.",
      },
    ],
  }),
  component: App,
});

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function tokenIssuedAt(token: string) {
  try {
    const value = (token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    return Number(JSON.parse(atob(value)).iat) * 1000;
  } catch {
    return 0;
  }
}
async function api(
  path: string,
  token: string,
  init?: RequestInit,
  retry = true,
) {
  if (path.includes("/functions/")) {
    const age = Date.now() - tokenIssuedAt(token);
    if (age < 2000) await pause(Math.min(2500, 2000 - age));
  }
  const response = await fetch(`${SB_URL}${path}`, {
    ...init,
    headers: { ...headers(token), ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => null);
  const message = String(
    data?.message || data?.msg || data?.error_description || data?.error || "",
  );
  if (
    !response.ok &&
    retry &&
    /issued at.*future|not valid yet|jwt.*future/i.test(message)
  ) {
    await pause(2500);
    return api(path, token, init, false);
  }
  if (!response.ok) throw new Error(message || `HTTP ${response.status}`);
  return data;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const restore = async () => {
      const raw = localStorage.getItem("safar-session");
      if (!raw) {
        setReady(true);
        return;
      }
      try {
        const saved = JSON.parse(raw) as Session;
        const res = await fetch(
          `${SB_URL}/auth/v1/token?grant_type=refresh_token`,
          {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ refresh_token: saved.refresh_token }),
          },
        );
        if (!res.ok) throw new Error("Sesi berakhir");
        const fresh = await res.json();
        localStorage.setItem("safar-session", JSON.stringify(fresh));
        setSession(fresh);
      } catch {
        localStorage.removeItem("safar-session");
      } finally {
        setReady(true);
      }
    };
    restore();
  }, []);
  if (!ready)
    return (
      <Center>
        <Loader2 className="animate-spin text-emerald-600" />
      </Center>
    );
  if (!session)
    return (
      <Auth
        onSession={(s) => {
          localStorage.setItem("safar-session", JSON.stringify(s));
          setSession(s);
        }}
      />
    );
  return (
    <Dashboard
      session={session}
      onLogout={() => {
        localStorage.removeItem("safar-session");
        setSession(null);
      }}
    />
  );
}

function Auth({ onSession }: { onSession: (s: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [loading, setLoading] = useState(false),
    [notice, setNotice] = useState<Notice | null>(null);
  const submit = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const endpoint =
        mode === "login"
          ? "/auth/v1/token?grant_type=password"
          : "/auth/v1/signup";
      const res = await fetch(`${SB_URL}${endpoint}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(
          mode === "login"
            ? { email, password }
            : { email, password, data: { full_name: name } },
        ),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.error_description ||
            data.msg ||
            data.message ||
            "Autentikasi gagal.",
        );
      if (!data.access_token) {
        setNotice({
          success: true,
          message:
            "Pendaftaran diterima. Periksa email jika konfirmasi diwajibkan.",
        });
        return;
      }
      onSession(data);
    } catch (e) {
      setNotice({
        success: false,
        message: e instanceof Error ? e.message : "Terjadi kesalahan.",
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="grid min-h-screen bg-[radial-gradient(circle_at_top_right,_#d1fae5_0,_#f8fafc_45%,_#ffffff_100%)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-xl font-bold">
          <span className="grid size-11 place-items-center rounded-xl bg-white/15">
            <Mail />
          </span>
          Safar Mail
        </div>
        <div>
          <h1 className="max-w-xl text-5xl font-bold leading-tight">
            Kirim email yang tepat, kepada orang yang tepat.
          </h1>
          <p className="mt-5 max-w-lg text-emerald-100">
            Satu dashboard untuk kampanye, kontak, template, jadwal, dan laporan
            Mailketing.
          </p>
        </div>
        <p className="text-sm text-emerald-200">Safar Iman Email Marketing</p>
      </div>
      <Center>
        <Card className="m-4 w-full max-w-md border-white bg-white/90 shadow-2xl shadow-emerald-900/10">
          <CardHeader>
            <CardTitle>
              {mode === "login" ? "Masuk ke Dashboard" : "Buat Admin Pertama"}
            </CardTitle>
            <p className="text-sm text-slate-500">
              {mode === "login"
                ? "Gunakan akun admin Safar Mail."
                : "Akun pertama otomatis menjadi administrator."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {notice && <NoticeBox notice={notice} />}{" "}
            {mode === "register" && (
              <Field label="Nama lengkap">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            )}
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
              />
            </Field>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={loading || !email || password.length < 8}
              onClick={submit}
            >
              {loading ? <Loader2 className="animate-spin" /> : <KeyRound />}
              {mode === "login" ? "Masuk" : "Buat Akun"}
            </Button>
            <button
              className="w-full text-sm text-emerald-700"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login"
                ? "Belum ada admin? Buat akun pertama"
                : "Sudah punya akun? Masuk"}
            </button>
          </CardContent>
        </Card>
      </Center>
    </div>
  );
}

function Dashboard({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => void;
}) {
  const token = session.access_token;
  const [view, setView] = useState<View>("dashboard"),
    [loading, setLoading] = useState(false),
    [notice, setNotice] = useState<Notice | null>(null),
    [profile, setProfile] = useState<any>(null),
    [contacts, setContacts] = useState<Contact[]>([]),
    [templates, setTemplates] = useState<Template[]>([]),
    [campaigns, setCampaigns] = useState<Campaign[]>([]),
    [provider, setProvider] = useState<any>(null),
    [profileLoaded, setProfileLoaded] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const [p, c, t, h] = await Promise.all([
        api(`/rest/v1/profiles?id=eq.${session.user.id}&select=*`, token),
        api(
          "/rest/v1/contacts?select=*&order=created_at.desc&limit=1000",
          token,
        ),
        api("/rest/v1/templates?select=*&order=updated_at.desc", token),
        api(
          "/rest/v1/campaigns?select=*&order=created_at.desc&limit=100",
          token,
        ),
      ]);
      setProfile(p[0] ?? null);
      setProfileLoaded(true);
      setContacts(c);
      setTemplates(t);
      setCampaigns(h);
    } catch (e) {
      setNotice({
        success: false,
        message: e instanceof Error ? e.message : "Gagal memuat data.",
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const invoke = async (body: any) =>
    api("/functions/v1/mailketing", token, {
      method: "POST",
      body: JSON.stringify(body),
    });
  const sync = async () => {
    setLoading(true);
    try {
      const d = await invoke({ action: "sync" });
      if (d.code === "ACCOUNT_INACTIVE") {
        setProvider(null);
        setProfile((current: any) =>
          current ? { ...current, active: false } : current,
        );
        setProfileLoaded(true);
        setNotice({
          success: false,
          message: "Akun Anda belum aktif. Hubungi admin untuk mengaktifkannya.",
        });
        return;
      }
      setProvider(d);
      setNotice({ success: d.success, message: d.message });
    } catch (e) {
      setNotice({
        success: false,
        message: e instanceof Error ? e.message : "Koneksi gagal.",
      });
    } finally {
      setLoading(false);
    }
  };
  const stats = {
    sent: campaigns.reduce((n, c) => n + c.sent_count, 0),
    failed: campaigns.reduce((n, c) => n + c.failed_count, 0),
    scheduled: campaigns.filter((c) => c.status === "scheduled").length,
  };
  const nav = [
    { id: "dashboard" as View, label: "Ringkasan", icon: BarChart3 },
    { id: "compose" as View, label: "Kampanye", icon: Send },
    { id: "contacts" as View, label: "Kontak", icon: Users },
    { id: "templates" as View, label: "Template", icon: LayoutTemplate },
    { id: "history" as View, label: "Riwayat", icon: History },
    { id: "settings" as View, label: "Pengaturan", icon: Settings },
  ];
  if (profileLoaded && !profile?.active)
    return (
      <Center>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Akun belum aktif</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              Akun <b>{session.user.email}</b>{" "}
              {profile
                ? "berstatus nonaktif."
                : "belum memiliki profil di sistem."}{" "}
              Minta admin mengaktifkan akun Anda, lalu masuk kembali.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => load()}>
                Coba lagi
              </Button>
              <Button onClick={onLogout}>
                <LogOut /> Keluar
              </Button>
            </div>
          </CardContent>
        </Card>
      </Center>
    );
  const activeNav = nav.find((item) => item.id === view);
  const content = (
    <>
      {notice && <NoticeBox notice={notice} />}
      {view === "dashboard" && (
        <Overview
          campaigns={campaigns}
          contacts={contacts.length}
          stats={stats}
          provider={provider}
          sync={sync}
          loading={loading}
        />
      )}
      {view === "contacts" && (
        <Contacts
          contacts={contacts}
          token={token}
          userId={session.user.id}
          reload={load}
          setNotice={setNotice}
        />
      )}
      {view === "templates" && (
        <Templates
          templates={templates}
          contacts={contacts}
          token={token}
          userId={session.user.id}
          reload={load}
          setNotice={setNotice}
        />
      )}
      {view === "compose" && (
        <Compose
          contacts={contacts}
          templates={templates}
          provider={provider}
          invoke={invoke}
          reload={load}
          sync={sync}
          setNotice={setNotice}
        />
      )}
      {view === "history" && (
        <HistoryView
          campaigns={campaigns}
          invoke={invoke}
          reload={load}
          setNotice={setNotice}
        />
      )}
      {view === "settings" && (
        <SettingsView
          invoke={invoke}
          sync={sync}
          provider={provider}
          admin={profile?.role === "admin"}
          setNotice={setNotice}
        />
      )}
    </>
  );
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ecfdf5_0,_#f8fafc_38%,_#f8fafc_100%)] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-200">
              <Mail size={20} />
            </span>
            <div className="min-w-0">
              <b className="block truncate text-sm sm:text-base">Safar Mail</b>
              <p className="truncate text-xs text-slate-500">
                {activeNav?.label} · {session.user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 size={18} className="animate-spin text-emerald-600" />}
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold capitalize text-emerald-700 sm:inline">
              {profile?.role || "Memuat"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              aria-label="Keluar"
              className="rounded-xl"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-7 px-3 py-4 sm:px-6 sm:py-7 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="sticky top-24 hidden h-fit rounded-3xl border border-white/80 bg-white/90 p-3 shadow-xl shadow-slate-200/50 backdrop-blur lg:block">
          <div className="mb-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 p-4 text-white">
            <p className="text-xs font-medium text-emerald-100">Email Marketing</p>
            <p className="mt-1 font-semibold">Kelola kampanye lebih mudah</p>
          </div>
          <nav className="grid gap-1.5">
            {nav.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setView(id);
                  setNotice(null);
                }}
                className={`group flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-medium transition-all ${view === id ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-slate-600 hover:translate-x-0.5 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                <span className={`grid size-8 place-items-center rounded-xl transition-colors ${view === id ? "bg-emerald-600 text-white" : "bg-slate-100 group-hover:bg-white"}`}>
                  <Icon size={17} />
                </span>
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 space-y-5 pb-24 lg:pb-8">{content}</main>
      </div>

      <nav className="fixed inset-x-2 bottom-2 z-40 grid grid-cols-6 rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-2xl shadow-slate-400/30 backdrop-blur-xl lg:hidden">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setView(id);
              setNotice(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition ${view === id ? "bg-emerald-600 text-white" : "text-slate-500"}`}
          >
            <Icon size={18} />
            <span className="w-full truncate">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Overview({
  campaigns,
  contacts,
  stats,
  provider,
  sync,
  loading,
}: any) {
  return (
    <>
      <PageHeading title="Ringkasan" description="Aktivitas email marketing terbaru." icon={<BarChart3 />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Kredit Mailketing"
          value={provider?.credits?.data?.credits ?? "—"}
          icon={<Mail />}
        />
        <Stat label="Total kontak" value={contacts} icon={<Users />} />
        <Stat
          label="Email diantrekan"
          value={stats.sent}
          icon={<CheckCircle2 />}
        />
        <Stat label="Terjadwal" value={stats.scheduled} icon={<Clock3 />} />
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Kampanye Terbaru</CardTitle>
          <Button variant="outline" onClick={sync} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Sinkronkan
          </Button>
        </CardHeader>
        <CardContent>
          <CampaignTable campaigns={campaigns.slice(0, 5)} />
        </CardContent>
      </Card>
    </>
  );
}

function Contacts({ contacts, token, userId, reload, setNotice }: any) {
  const emptyForm = {
    registration_code: "",
    full_name: "",
    email: "",
    mobile: "",
    category: "Umum",
  };
  const [form, setForm] = useState(emptyForm);
  const [importCategory, setImportCategory] = useState("Umum");
  const [bulkText, setBulkText] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [deleteCategory, setDeleteCategory] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [contactCategoryFilter, setContactCategoryFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [contactPage, setContactPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const contactCategories = Array.from(
    new Set(contacts.map((contact: Contact) => contact.category || "Umum")),
  ).sort() as string[];
  const normalizedQuery = contactQuery.trim().toLowerCase();
  const filteredContacts = contacts.filter((contact: Contact) => {
    const matchesCategory =
      contactCategoryFilter === "all" ||
      (contact.category || "Umum") === contactCategoryFilter;
    const searchable = [
      contact.registration_code,
      contact.full_name,
      contact.first_name,
      contact.last_name,
      contact.email,
      contact.mobile,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
  const totalContactPages = Math.max(
    1,
    Math.ceil(filteredContacts.length / rowsPerPage),
  );
  const safeContactPage = Math.min(contactPage, totalContactPages);
  const visibleContactRows = filteredContacts.slice(
    (safeContactPage - 1) * rowsPerPage,
    safeContactPage * rowsPerPage,
  );
  useEffect(() => {
    setContactPage(1);
  }, [contactQuery, contactCategoryFilter, rowsPerPage]);

  const save = async () => {
    setBusy(true);
    try {
      await api("/rest/v1/contacts", token, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          ...form,
          first_name: form.full_name,
          created_by: userId,
        }),
      });
      setForm(emptyForm);
      await reload();
      setNotice({ success: true, message: "Kontak ditambahkan." });
    } catch (e) {
      setNotice({
        success: false,
        message: e instanceof Error ? e.message : "Gagal.",
      });
    } finally {
      setBusy(false);
    }
  };

  const normalizeHeader = (value: unknown) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

  const parseCsv = (text: string) => {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const separators = [",", ";", "\t"] as const;
    const separator = separators.reduce((best, candidate) =>
      firstLine.split(candidate).length > firstLine.split(best).length
        ? candidate
        : best,
    );
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = !quoted;
      } else if (char === separator && !quoted) {
        row.push(cell.trim());
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[i + 1] === "\n") i++;
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = "";
      } else cell += char;
    }
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
  };

  const readXlsx = async (file: File): Promise<unknown[][]> => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);
    let eocd = bytes.length - 22;
    while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
    if (eocd < 0) throw new Error("File Excel tidak valid.");

    const entries = new Map<string, Uint8Array>();
    const total = view.getUint16(eocd + 10, true);
    let pointer = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();
    for (let index = 0; index < total; index++) {
      if (view.getUint32(pointer, true) !== 0x02014b50) break;
      const method = view.getUint16(pointer + 10, true);
      const compressedSize = view.getUint32(pointer + 20, true);
      const nameLength = view.getUint16(pointer + 28, true);
      const extraLength = view.getUint16(pointer + 30, true);
      const commentLength = view.getUint16(pointer + 32, true);
      const localOffset = view.getUint32(pointer + 42, true);
      const name = decoder.decode(
        bytes.slice(pointer + 46, pointer + 46 + nameLength),
      );
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      let content: Uint8Array;
      if (method === 0) content = compressed;
      else if (method === 8) {
        const stream = new Blob([compressed]).stream().pipeThrough(
          new DecompressionStream("deflate-raw"),
        );
        content = new Uint8Array(await new Response(stream).arrayBuffer());
      } else throw new Error("Format kompresi Excel tidak didukung.");
      entries.set(name, content);
      pointer += 46 + nameLength + extraLength + commentLength;
    }

    const parseXml = (path: string) => {
      const content = entries.get(path);
      if (!content) return null;
      return new DOMParser().parseFromString(decoder.decode(content), "text/xml");
    };
    const sharedXml = parseXml("xl/sharedStrings.xml");
    const shared = sharedXml
      ? Array.from(sharedXml.getElementsByTagName("si")).map(
          (node) => node.textContent ?? "",
        )
      : [];
    const sheetPath = Array.from(entries.keys())
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .sort()[0];
    if (!sheetPath) throw new Error("Sheet Excel tidak ditemukan.");
    const xml = parseXml(sheetPath);
    if (!xml) throw new Error("Sheet Excel tidak dapat dibaca.");

    return Array.from(xml.getElementsByTagName("row")).map((row) => {
      const values: unknown[] = [];
      Array.from(row.getElementsByTagName("c")).forEach((cell) => {
        const reference = cell.getAttribute("r") ?? "";
        const letters = reference.match(/[A-Z]+/)?.[0] ?? "A";
        let column = 0;
        for (const letter of letters)
          column = column * 26 + letter.charCodeAt(0) - 64;
        column--;
        const type = cell.getAttribute("t");
        const raw =
          cell.getElementsByTagName("v")[0]?.textContent ??
          cell.getElementsByTagName("t")[0]?.textContent ??
          "";
        values[column] = type === "s" ? shared[Number(raw)] ?? "" : raw;
      });
      return values;
    });
  };

  const importContacts = async (file: File) => {
    setBusy(true);
    try {
      const sheet = file.name.toLowerCase().endsWith(".xlsx")
        ? await readXlsx(file)
        : parseCsv(await file.text());

      const headers = (sheet[0] ?? []).map(normalizeHeader);
      const aliases: Record<string, string> = {
        kode: "registration_code",
        "kode pendaftaran": "registration_code",
        nama: "full_name",
        "daftar nama": "full_name",
        email: "email",
        whatsapp: "mobile",
        "no whatsapp": "mobile",
        wa: "mobile",
      };
      const required = ["kode", "daftar nama", "email", "whatsapp"];
      const missing = required.filter((name) => !headers.includes(name));
      if (missing.length) {
        throw new Error(
          `Header Excel belum sesuai. Gunakan: Kode | Daftar Nama | Email | WhatsApp. Kolom tidak ditemukan: ${missing.join(", ")}.`,
        );
      }

      const rows = sheet
        .slice(1)
        .map((values) => {
          const contact: Record<string, unknown> = {
            created_by: userId,
            source: file.name.toLowerCase().endsWith(".xlsx") ? "excel" : "csv",
            category: importCategory.trim() || "Umum",
          };
          headers.forEach((header, index) => {
            const field = aliases[header];
            if (field) contact[field] = String(values[index] ?? "").trim();
          });
          contact.first_name = contact.full_name;
          return contact;
        })
        .filter((contact) => contact.email);

      if (!rows.length) throw new Error("Tidak ada baris kontak dengan email yang valid.");
      for (let i = 0; i < rows.length; i += 250) {
        await api("/rest/v1/contacts?on_conflict=email", token, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rows.slice(i, i + 250)),
        });
      }
      await reload();
      setNotice({
        success: true,
        message: `${rows.length} kontak dari ${file.name} berhasil diproses.`,
      });
    } catch (e) {
      setNotice({
        success: false,
        message: e instanceof Error ? e.message : "Import gagal.",
      });
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const csv = "\uFEFFKode,Daftar Nama,Email,WhatsApp\nHXP-001,Nama Lengkap,nama@email.com,081234567890\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "template-kontak-safar-mail.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveBulkContacts = async () => {
    setBusy(true);
    try {
      const parsed = parseCsv(bulkText);
      const firstIsHeader =
        normalizeHeader(parsed[0]?.[0]) === "kode" &&
        normalizeHeader(parsed[0]?.[2]) === "email";
      const dataRows = firstIsHeader ? parsed.slice(1) : parsed;
      const invalidLines: number[] = [];
      const seen = new Set<string>();
      const rows = dataRows
        .map((values, index) => {
          const lineNumber = index + (firstIsHeader ? 2 : 1);
          const registrationCode = String(values[0] ?? "").trim();
          const mobile = String(values.at(-1) ?? "").trim();
          const email = String(values.at(-2) ?? "").trim().toLowerCase();
          const fullName = values.slice(1, -2).join(", ").trim();
          if (
            values.length < 4 ||
            !registrationCode ||
            !fullName ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !mobile
          ) {
            invalidLines.push(lineNumber);
            return null;
          }
          if (seen.has(email)) return null;
          seen.add(email);
          return {
            registration_code: registrationCode,
            full_name: fullName,
            first_name: fullName,
            email,
            mobile,
            category: importCategory.trim() || "Umum",
            source: "bulk",
            created_by: userId,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (!rows.length)
        throw new Error(
          invalidLines.length
            ? `Tidak ada data valid. Periksa baris ${invalidLines.slice(0, 10).join(", ")}.`
            : "Belum ada kontak valid untuk disimpan.",
        );

      const batchSize = 200;
      for (let i = 0; i < rows.length; i += batchSize)
        await api("/rest/v1/contacts?on_conflict=email", token, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rows.slice(i, i + batchSize)),
        });
      setBulkText("");
      await reload();
      setNotice({
        success: true,
        message: invalidLines.length
          ? `${rows.length} kontak disimpan. ${invalidLines.length} baris dilewati: ${invalidLines.slice(0, 10).join(", ")}${invalidLines.length > 10 ? " dan lainnya" : ""}.`
          : `${rows.length} kontak berhasil dimasukkan ke kategori “${importCategory.trim() || "Umum"}”.`,
      });
    } catch (e) {
      setNotice({ success: false, message: e instanceof Error ? e.message : "Input massal gagal." });
    } finally {
      setBusy(false);
    }
  };

  const deleteContacts = async (ids: string[]) => {
    if (
      !ids.length ||
      !window.confirm(`Hapus ${ids.length} kontak yang dipilih? Tindakan ini tidak dapat dibatalkan.`)
    ) return;
    setBusy(true);
    try {
      for (let i = 0; i < ids.length; i += 100)
        await api(
          `/rest/v1/contacts?id=in.(${ids.slice(i, i + 100).join(",")})`,
          token,
          { method: "DELETE", headers: { Prefer: "return=minimal" } },
        );
      setSelectedContactIds([]);
      await reload();
      setNotice({ success: true, message: `${ids.length} kontak berhasil dihapus.` });
    } catch (e) {
      setNotice({ success: false, message: e instanceof Error ? e.message : "Kontak gagal dihapus." });
    } finally {
      setBusy(false);
    }
  };

  const deleteWholeCategory = async () => {
    if (!deleteCategory) return;
    const count = contacts.filter(
      (contact: Contact) => (contact.category || "Umum") === deleteCategory,
    ).length;
    if (!window.confirm(
      `Hapus kategori “${deleteCategory}” beserta ${count} kontak di dalamnya? Tindakan ini tidak dapat dibatalkan.`,
    )) return;
    setBusy(true);
    try {
      const removedCategory = deleteCategory;
      await api(
        `/rest/v1/contacts?category=eq.${encodeURIComponent(removedCategory)}`,
        token,
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
      );
      setDeleteCategory("");
      setSelectedContactIds([]);
      await reload();
      setNotice({ success: true, message: `Kategori “${removedCategory}” dan seluruh kontaknya berhasil dihapus.` });
    } catch (e) {
      setNotice({ success: false, message: e instanceof Error ? e.message : "Kategori gagal dihapus." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeading title="Kontak" description="Kelola penerima, kategori, dan data personalisasi." icon={<Users />} />
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-6">
          <Input
            placeholder="Kode Pendaftaran"
            value={form.registration_code}
            onChange={(e) =>
              setForm({ ...form, registration_code: e.target.value })
            }
          />
          <Input
            placeholder="Daftar Nama"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <Input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            placeholder="WhatsApp"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
          <Input
            placeholder="Kategori"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <Button onClick={save} disabled={busy || !form.email}>
            Tambah
          </Button>
          <Input
            placeholder="Kategori import dan input massal"
            value={importCategory}
            onChange={(e) => setImportCategory(e.target.value)}
          />
          <label className="flex cursor-pointer sm:col-span-2 xl:col-span-4 items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm text-slate-600 hover:bg-slate-50">
            <Upload size={18} /> Import Excel/CSV: Kode | Daftar Nama | Email |
            WhatsApp
            <input
              hidden
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) =>
                e.target.files?.[0] && importContacts(e.target.files[0])
              }
            />
          </label>
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            <FileSpreadsheet size={18} /> Unduh Contoh
          </Button>
        </CardContent>
      </Card>
 
      <Card>
        <CardHeader>
          <CardTitle>Input Kontak Massal</CardTitle>
          <p className="text-sm text-slate-500">
            Tempel beberapa kontak. Gunakan satu baris untuk satu kontak tanpa
            header.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-800">
            Format: <code>Kode,Nama,Email,WhatsApp</code>
            <br />
            Contoh:{" "}
            <code>
              HXP-EFE8A860,tria Nurul
              kamilah,tnurulkamilah@gmail.com,085800685672
            </code>
          </div>
          <Textarea
            rows={8}
            className="font-mono text-sm"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"HXP-EFE8A860,tria Nurul kamilah,tnurulkamilah@gmail.com,085800685672\nHXP-ABC123,Nama Kedua,emailkedua@gmail.com,081234567890"}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Masukkan ke kategori">
              <Input
                value={importCategory}
                onChange={(e) => setImportCategory(e.target.value)}
                placeholder="Contoh: Peserta Essay"
              />
            </Field>
            <Button
              type="button"
              onClick={saveBulkContacts}
              disabled={busy || !bulkText.trim() || !importCategory.trim()}
              className="sm:mb-0.5"
            >
              {busy ? <Loader2 className="animate-spin" /> : <Users />}
              Simpan Kontak Massal
            </Button>
          </div>
        </CardContent>
      </Card>     <Card>
        <CardHeader>
          <CardTitle>Kelola dan Hapus Kontak</CardTitle>
          <p className="text-sm text-slate-500">
            Pilih kontak dari tabel untuk menghapus beberapa data sekaligus,
            atau hapus seluruh kontak berdasarkan kategori.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <select
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm shadow-sm"
            value={deleteCategory}
            onChange={(e) => setDeleteCategory(e.target.value)}
          >
            <option value="">Pilih kategori yang akan dihapus</option>
            {contactCategories.map((category) => (
              <option key={category} value={category}>
                {category} ({contacts.filter((contact: Contact) => (contact.category || "Umum") === category).length} kontak)
              </option>
            ))}
          </select>
          <Button type="button" variant="destructive" disabled={busy || !deleteCategory} onClick={deleteWholeCategory}>
            <Trash2 /> Hapus Kategori & Kontak
          </Button>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              disabled={!contacts.length}
              onClick={() =>
                setSelectedContactIds(
                  selectedContactIds.length === contacts.length
                    ? []
                    : contacts.map((contact: Contact) => contact.id),
                )
              }
            >
              {selectedContactIds.length === contacts.length && contacts.length
                ? "Batalkan Semua"
                : "Pilih Semua Kontak"}
            </Button>
            <Button type="button" variant="destructive" disabled={busy || !selectedContactIds.length} onClick={() => deleteContacts(selectedContactIds)}>
              <Trash2 /> Hapus Terpilih ({selectedContactIds.length})
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="gap-4">
          <div>
            <CardTitle>Daftar Kontak</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Menampilkan {filteredContacts.length} dari {contacts.length} kontak.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_150px]">
            <label className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-3 text-slate-400"
              />
              <Input
                className="pl-10"
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Cari kode, nama, email, atau WhatsApp"
              />
            </label>
            <select
              className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm shadow-sm"
              value={contactCategoryFilter}
              onChange={(e) => setContactCategoryFilter(e.target.value)}
            >
              <option value="all">Semua kategori</option>
              {contactCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm shadow-sm"
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((amount) => (
                <option key={amount} value={amount}>
                  {amount} baris
                </option>
              ))}
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[860px] w-full text-sm">
              <thead>
                <tr className="border-y bg-slate-50/80 text-left">
                  <Th>
                    <input
                      type="checkbox"
                      aria-label="Pilih kontak pada halaman ini"
                      checked={
                        visibleContactRows.length > 0 &&
                        visibleContactRows.every((contact: Contact) =>
                          selectedContactIds.includes(contact.id),
                        )
                      }
                      onChange={(e) => {
                        const pageIds = visibleContactRows.map(
                          (contact: Contact) => contact.id,
                        );
                        setSelectedContactIds(
                          e.target.checked
                            ? Array.from(new Set([...selectedContactIds, ...pageIds]))
                            : selectedContactIds.filter(
                                (id) => !pageIds.includes(id),
                              ),
                        );
                      }}
                    />
                  </Th>
                  <Th>Kode</Th>
                  <Th>Daftar Nama</Th>
                  <Th>Email</Th>
                  <Th>WhatsApp</Th>
                  <Th>Kategori</Th>
                  <Th>Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {visibleContactRows.length ? (
                  visibleContactRows.map((c: Contact) => (
                    <tr
                      key={c.id}
                      className={`border-b transition-colors ${selectedContactIds.includes(c.id) ? "bg-emerald-50/70" : "hover:bg-slate-50"}`}
                    >
                      <Td>
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${c.email}`}
                          checked={selectedContactIds.includes(c.id)}
                          onChange={(e) =>
                            setSelectedContactIds(
                              e.target.checked
                                ? [...selectedContactIds, c.id]
                                : selectedContactIds.filter((id) => id !== c.id),
                            )
                          }
                        />
                      </Td>
                      <Td>{c.registration_code || "—"}</Td>
                      <Td>
                        {c.full_name ||
                          [c.first_name, c.last_name].filter(Boolean).join(" ") ||
                          "—"}
                      </Td>
                      <Td>{c.email}</Td>
                      <Td>{c.mobile || "—"}</Td>
                      <Td>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                          {c.category || "Umum"}
                        </span>
                      </Td>
                      <Td>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => deleteContacts([c.id])}
                        >
                          <Trash2 /> Hapus
                        </Button>
                      </Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Kontak tidak ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y md:hidden">
            {visibleContactRows.length ? (
              visibleContactRows.map((c: Contact) => (
                <article
                  key={c.id}
                  className={`space-y-3 p-4 transition-colors ${selectedContactIds.includes(c.id) ? "bg-emerald-50/70" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4"
                      aria-label={`Pilih ${c.email}`}
                      checked={selectedContactIds.includes(c.id)}
                      onChange={(e) =>
                        setSelectedContactIds(
                          e.target.checked
                            ? [...selectedContactIds, c.id]
                            : selectedContactIds.filter((id) => id !== c.id),
                        )
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">
                          {c.full_name || c.first_name || "Tanpa nama"}
                        </h3>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          {c.category || "Umum"}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-sm text-slate-600">{c.email}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-xs">
                    <div>
                      <dt className="text-slate-400">Kode</dt>
                      <dd className="mt-1 font-medium text-slate-700">
                        {c.registration_code || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">WhatsApp</dt>
                      <dd className="mt-1 font-medium text-slate-700">
                        {c.mobile || "—"}
                      </dd>
                    </div>
                  </dl>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={() => deleteContacts([c.id])}
                  >
                    <Trash2 /> Hapus Kontak
                  </Button>
                </article>
              ))
            ) : (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                Kontak tidak ditemukan.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t bg-slate-50/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-xs text-slate-500 sm:text-left">
              Halaman {safeContactPage} dari {totalContactPages} ·{" "}
              {filteredContacts.length} kontak
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safeContactPage <= 1}
                onClick={() => setContactPage((page) => Math.max(1, page - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safeContactPage >= totalContactPages}
                onClick={() =>
                  setContactPage((page) => Math.min(totalContactPages, page + 1))
                }
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function Templates({
  templates,
  contacts,
  token,
  userId,
  reload,
  setNotice,
}: any) {
  const [f, setF] = useState({
    name: "",
    subject: "",
    html_content: "<h2>Halo {{nama}}</h2><p>Tulis isi email.</p>",
  });
  const [preview, setPreview] = useState(true);
  const [savedPreview, setSavedPreview] = useState<string | null>(null);
  const canonicalKeywords = [
    { key: "kode", label: "Kode Pendaftaran" },
    { key: "nama", label: "Nama Lengkap" },
    { key: "email", label: "Email" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "kategori", label: "Kategori" },
  ];
  const legacyAliases = new Set([
    "kode_pendaftaran",
    "registration_code",
    "daftar_nama",
    "full_name",
    "first_name",
    "last_name",
    "mobile",
    "category",
  ]);
  const customKeywords = Array.from(
    new Set(
      contacts.flatMap((contact: Contact) =>
        Object.keys(contact.custom_fields ?? {}),
      ),
    ),
  ).filter((keyword) => !legacyAliases.has(keyword));
  const keywords = [
    ...canonicalKeywords,
    ...customKeywords.map((key) => ({ key, label: "Field tambahan" })),
  ];
  const sample = contacts[0] as Contact | undefined;
  const sampleVariables: Record<string, string> = {
    kode: sample?.registration_code || "HXP-001",
    nama:
      sample?.full_name ||
      [sample?.first_name, sample?.last_name].filter(Boolean).join(" ") ||
      "Nama Penerima",
    email: sample?.email || "penerima@email.com",
    whatsapp: sample?.mobile || "081234567890",
    kategori: sample?.category || "Umum",
    ...(sample?.custom_fields ?? {}),
  };
  const renderPreview = (value: string) =>
    value.replace(/{{\s*([^{}]+)\s*}}/g, (_, key) => sampleVariables[key] ?? `{{${key}}}`);

  const insertKeyword = (
    keyword: string,
    target: "subject" | "html_content",
  ) => {
    const value = `{{${keyword}}}`;
    setF((current) => ({
      ...current,
      [target]: `${current[target]}${current[target] ? " " : ""}${value}`,
    }));
  };
  const save = async () => {
    try {
      await api("/rest/v1/templates", token, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ ...f, created_by: userId }),
      });
      await reload();
      setF({ name: "", subject: "", html_content: "" });
      setNotice({ success: true, message: "Template disimpan." });
    } catch (e) {
      setNotice({
        success: false,
        message: e instanceof Error ? e.message : "Gagal.",
      });
    }
  };
  return (
    <>
      <PageHeading title="Template Email" description="Buat desain HTML dan lihat hasil personalisasi secara langsung." icon={<LayoutTemplate />} />
      <Card>
        <CardContent className="space-y-4 p-5">
          <Field label="Nama template">
            <Input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </Field>
          <Field label="Subjek">
            <Input
              value={f.subject}
              onChange={(e) => setF({ ...f, subject: e.target.value })}
            />
          </Field>
          <div className="space-y-2">
            <Label>Keyword data kontak</Label>
            <div className="flex flex-wrap gap-2">
              {keywords.map(({ key: keyword, label }) => (
                <div
                  key={keyword}
                  className="flex overflow-hidden rounded-lg border bg-white text-xs"
                >
                  <span className="px-2 py-1.5">
                    <b className="block font-medium text-slate-700">{label}</b>
                    <code className="text-[11px] text-emerald-700">{`{{${keyword}}}`}</code>
                  </span>
                  <button
                    type="button"
                    className="border-l px-2 hover:bg-slate-50"
                    onClick={() => insertKeyword(keyword, "subject")}
                  >
                    + Subjek
                  </button>
                  <button
                    type="button"
                    className="border-l px-2 hover:bg-slate-50"
                    onClick={() => insertKeyword(keyword, "html_content")}
                  >
                    + Isi
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Pilihan utama mengikuti field kontak. Keyword lama tetap didukung
              di template yang sudah tersimpan.
            </p>
          </div>
          <Field label="HTML">
            <Textarea
              rows={10}
              className="font-mono"
              value={f.html_content}
              onChange={(e) => setF({ ...f, html_content: e.target.value })}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={save}
              disabled={!f.name || !f.subject || !f.html_content}
            >
              Simpan Template
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreview(!preview)}
            >
              {preview ? "Sembunyikan Preview" : "Tampilkan Preview"}
            </Button>
          </div>
          {preview && (
            <div className="overflow-hidden rounded-xl border bg-slate-100">
              <div className="border-b bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Preview Email
                </p>
                <p className="mt-1 font-semibold">
                  {renderPreview(f.subject) || "Tanpa subjek"}
                </p>
              </div>
              <iframe
                title="Preview template"
                sandbox=""
                srcDoc={renderPreview(f.html_content)}
                className="h-96 w-full bg-white"
              />
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((t: Template) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="text-base">{t.name}</CardTitle>
              <p className="truncate text-sm text-slate-500">{t.subject}</p>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSavedPreview(savedPreview === t.id ? null : t.id)
                }
              >
                {savedPreview === t.id ? "Tutup Preview" : "Lihat Preview"}
              </Button>
              {savedPreview === t.id && (
                <div className="mt-3 overflow-hidden rounded-lg border">
                  <div className="border-b bg-slate-50 px-3 py-2 text-sm font-medium">
                    {t.subject}
                  </div>
                  <iframe
                    title={`Preview ${t.name}`}
                    sandbox=""
                    srcDoc={t.html_content}
                    className="h-80 w-full bg-white"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function Compose({
  contacts,
  templates,
  provider,
  invoke,
  reload,
  sync,
  setNotice,
}: any) {
  const [f, setF] = useState({
      name: "",
      from_name: "Safar Iman",
      from_email: "",
      subject: "",
      html_content: "",
      scheduled_at: "",
      attachments: ["", "", ""],
    }),
    [selected, setSelected] = useState<string[]>([]),
    [manual, setManual] = useState(""),
    [categoryFilter, setCategoryFilter] = useState("all"),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false);
  const senders = (provider?.senders?.data?.senders ?? [])
    .map((s: any) => s.sender_email ?? s.email)
    .filter(Boolean);
  const categories = Array.from(
    new Set(
      contacts.map((contact: Contact) => contact.category || "Umum"),
    ),
  ).sort() as string[];
  const visibleContacts =
    categoryFilter === "all"
      ? contacts
      : contacts.filter(
          (contact: Contact) =>
            (contact.category || "Umum") === categoryFilter,
        );
  useEffect(() => {
    if (!provider) sync();
  }, []);
  useEffect(() => {
    if (!f.from_email && senders[0])
      setF((current) => ({ ...current, from_email: senders[0] }));
  }, [senders.join("|")]);
  const recipients = useMemo(() => {
    const picked = contacts
      .filter((c: Contact) => selected.includes(c.id))
      .map((c: Contact) => ({
        contact_id: c.id,
        email: c.email,
        variables: {
          email: c.email,
          registration_code: c.registration_code ?? "",
          kode_pendaftaran: c.registration_code ?? "",
          kode: c.registration_code ?? "",
          full_name:
            c.full_name ??
            [c.first_name, c.last_name].filter(Boolean).join(" "),
          nama:
            c.full_name ??
            [c.first_name, c.last_name].filter(Boolean).join(" "),
          daftar_nama:
            c.full_name ??
            [c.first_name, c.last_name].filter(Boolean).join(" "),
          whatsapp: c.mobile ?? "",
          first_name: c.first_name ?? c.full_name ?? "",
          last_name: c.last_name ?? "",
          mobile: c.mobile ?? "",
          category: c.category ?? "Umum",
          kategori: c.category ?? "Umum",
          ...(c.custom_fields ?? {}),
        },
      }));
    const extra = manual
      .split(/[\n,;]+/)
      .map((e: string) => e.trim())
      .filter(Boolean)
      .map((email: string) => ({ email, variables: { email } }));
    return [...picked, ...extra].filter(
      (r, i, a) => a.findIndex((x) => x.email === r.email) === i,
    );
  }, [selected, manual, contacts]);
  const useTemplate = (id: string) => {
    const t = templates.find((x: Template) => x.id === id);
    if (t) setF({ ...f, subject: t.subject, html_content: t.html_content });
  };
  const submit = async (test = false) => {
    setBusy(true);
    try {
      let d;
      if (test) {
        const recipient = prompt("Masukkan email tujuan percobaan:");
        if (!recipient) return;
        d = await invoke({
          action: "send-test",
          recipient,
          email: {
            from_name: f.from_name,
            from_email: f.from_email,
            subject: f.subject,
            content: f.html_content,
            attach1: f.attachments[0] || undefined,
            attach2: f.attachments[1] || undefined,
            attach3: f.attachments[2] || undefined,
          },
        });
      } else {
        d = await invoke({
          action: "create-campaign",
          campaign: {
            name: f.name,
            from_name: f.from_name,
            from_email: f.from_email,
            subject: f.subject,
            html_content: f.html_content,
            scheduled_at: f.scheduled_at
              ? new Date(f.scheduled_at).toISOString()
              : null,
            attachments: f.attachments.filter(Boolean),
          },
          recipients,
        });
        if (d.success && !f.scheduled_at)
          await invoke({ action: "process-queue" });
        await reload();
      }
      setNotice({ success: d.success, message: d.message });
    } catch (e) {
      setNotice({
        success: false,
        message: e instanceof Error ? e.message : "Gagal.",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading title="Buat Kampanye" description="Pilih penerima, susun email, lalu kirim sekarang atau terjadwal." icon={<Send />} />
      {provider?.credits?.data?.credits !== undefined &&
        recipients.length > provider.credits.data.credits && (
          <NoticeBox
            notice={{
              success: false,
              message: `Kredit tidak cukup: perlu ${recipients.length}, tersedia ${provider.credits.data.credits}.`,
            }}
          />
        )}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama kampanye">
              <Input
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <Field label="Template">
              <select
                className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                onChange={(e) => useTemplate(e.target.value)}
              >
                <option value="">Tanpa template</option>
                {templates.map((t: Template) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nama pengirim">
              <Input
                value={f.from_name}
                onChange={(e) => setF({ ...f, from_name: e.target.value })}
              />
            </Field>
            <Field label="Sender terverifikasi">
              <select
                className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                value={f.from_email}
                onChange={(e) => setF({ ...f, from_email: e.target.value })}
              >
                <option value="">Pilih sender</option>
                {senders.map((email: string) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Subjek">
            <Input
              value={f.subject}
              onChange={(e) => setF({ ...f, subject: e.target.value })}
            />
          </Field>
          <Field label="Kontak tersimpan">
            <div className="mb-3 flex flex-wrap gap-2">
              <select
                className="h-10 rounded-md border bg-white px-3 text-sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">Semua kategori</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSelected(
                    Array.from(
                      new Set([
                        ...selected,
                        ...visibleContacts.map((contact: Contact) => contact.id),
                      ]),
                    ),
                  )
                }
              >
                Pilih semua kategori ini
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSelected(
                    selected.filter(
                      (id) =>
                        !visibleContacts.some(
                          (contact: Contact) => contact.id === id,
                        ),
                    ),
                  )
                }
              >
                Kosongkan kategori ini
              </Button>
            </div>
            <p className="mb-2 text-xs text-slate-500">
              {visibleContacts.length} kontak tampil, {selected.length} dipilih.
            </p>
            <div className="max-h-48 overflow-auto rounded-xl border p-3">
              {visibleContacts.map((c: Contact) => (
                <label key={c.id} className="flex gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, c.id]
                          : selected.filter((x) => x !== c.id),
                      )
                    }
                  />
                  <span>
                    {c.email} — {c.full_name || c.first_name || "Tanpa nama"}
                    <span className="ml-2 text-xs text-emerald-700">
                      [{c.category || "Umum"}]
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Penerima tambahan">
            <Textarea
              rows={3}
              placeholder="Pisahkan dengan baris baru atau koma"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
          </Field>
          <Field label="Konten HTML">
            <Textarea
              rows={12}
              className="font-mono"
              value={f.html_content}
              onChange={(e) => setF({ ...f, html_content: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            {f.attachments.map((a: string, i: number) => (
              <Field key={i} label={`URL lampiran ${i + 1}`}>
                <Input
                  value={a}
                  onChange={(e) => {
                    const x = [...f.attachments];
                    x[i] = e.target.value;
                    setF({ ...f, attachments: x });
                  }}
                />
              </Field>
            ))}
          </div>
          <Field label="Jadwalkan (opsional)">
            <Input
              type="datetime-local"
              value={f.scheduled_at}
              onChange={(e) => setF({ ...f, scheduled_at: e.target.value })}
            />
          </Field>
          <p className="rounded-xl bg-slate-50 p-3 text-sm">
            <b>{recipients.length}</b> penerima · estimasi{" "}
            <b>{recipients.length}</b> kredit
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setPreview(!preview)}>
              Pratinjau
            </Button>
            <Button
              variant="outline"
              onClick={() => submit(true)}
              disabled={busy || !f.from_email}
            >
              Kirim Tes
            </Button>
            <Button
              onClick={() => submit(false)}
              disabled={
                busy ||
                !f.name ||
                !f.from_email ||
                !f.subject ||
                !f.html_content ||
                !recipients.length ||
                (provider?.credits?.data?.credits !== undefined &&
                  recipients.length > provider.credits.data.credits)
              }
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {busy ? <Loader2 className="animate-spin" /> : <Send />}
              {f.scheduled_at ? "Jadwalkan" : "Kirim Sekarang"}
            </Button>
          </div>
          {preview && (
            <div className="rounded-xl border bg-white p-5">
              <p className="mb-3 border-b pb-3 font-semibold">
                {f.subject || "Tanpa subjek"}
              </p>
              <div dangerouslySetInnerHTML={{ __html: f.html_content }} />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function HistoryView({ campaigns, invoke, reload, setNotice }: any) {
  const retry = async (id: string) => {
    try {
      const r = await invoke({ action: "retry", campaign_id: id });
      if (r.success) await invoke({ action: "process-queue" });
      await reload();
      setNotice({ success: r.success, message: r.message });
    } catch (e) {
      setNotice({
        success: false,
        message: e instanceof Error ? e.message : "Gagal.",
      });
    }
  };
  return (
    <>
      <PageHeading title="Riwayat Pengiriman" description="Pantau hasil kampanye dan ulangi email yang gagal." icon={<History />} />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <CampaignTable campaigns={campaigns} retry={retry} />
        </CardContent>
      </Card>
    </>
  );
}

function SettingsView({ invoke, sync, provider, admin, setNotice }: any) {
  const [token, setToken] = useState(""),
    [fromName, setFromName] = useState("Safar Iman"),
    [fromEmail, setFromEmail] = useState(""),
    [corporate, setCorporate] = useState(false),
    [verifyEmail, setVerifyEmail] = useState(""),
    [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await invoke({
        action: "save-settings",
        token,
        default_from_name: fromName,
        default_from_email: fromEmail,
        corporate_mode: corporate,
      });
      setNotice({ success: r.success, message: r.message });
      if (r.success) {
        setToken("");
        await sync();
      }
    } catch (e) {
      setNotice({
        success: false,
        message: e instanceof Error ? e.message : "Gagal.",
      });
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    try {
      const r = await invoke({
        action: "verify-corporate",
        email: verifyEmail,
      });
      setNotice({ success: r.success, message: r.message });
    } catch (e) {
      setNotice({
        success: false,
        message: e instanceof Error ? e.message : "Gagal.",
      });
    }
  };
  return (
    <>
      <PageHeading title="Pengaturan API" description="Kelola koneksi Mailketing dan sender dengan aman." icon={<Settings />} />
      <Card>
        <CardContent className="space-y-4 p-5">
          {!admin && (
            <NoticeBox
              notice={{
                success: false,
                message: "Hanya administrator yang dapat mengubah API.",
              }}
            />
          )}
          <Field label="Token Mailketing">
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Token dari API Integration"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama pengirim default">
              <Input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </Field>
            <Field label="Email pengirim default">
              <Input
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={corporate}
              onChange={(e) => setCorporate(e.target.checked)}
            />{" "}
            Aktifkan Corporate API
          </label>
          <div className="flex gap-2">
            <Button
              onClick={save}
              disabled={!admin || busy || token.length < 8}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <ShieldCheck /> Simpan Aman
            </Button>
            <Button variant="outline" onClick={sync}>
              <RefreshCw /> Uji Koneksi
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Verifikasi Domain Corporate</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={verifyEmail}
            onChange={(e) => setVerifyEmail(e.target.value)}
            placeholder="sender@domain.com"
          />
          <Button variant="outline" onClick={verify} disabled={!verifyEmail}>
            Verifikasi
          </Button>
        </CardContent>
      </Card>
      {provider && (
        <Card>
          <CardHeader>
            <CardTitle>Status Mailketing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Kredit"
              value={provider.credits?.data?.credits ?? "—"}
              icon={<Mail />}
            />
            <Stat
              label="Sender"
              value={provider.senders?.data?.senders?.length ?? 0}
              icon={<ShieldCheck />}
            />
            <Stat
              label="List"
              value={provider.lists?.data?.lists?.length ?? 0}
              icon={<FileSpreadsheet />}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function CampaignTable({ campaigns, retry }: any) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
    <table className="min-w-[680px] w-full text-sm">
      <thead>
        <tr className="border-b bg-slate-50 text-left">
          <Th>Kampanye</Th>
          <Th>Status</Th>
          <Th>Pengiriman</Th>
          <Th>Jadwal</Th>
          {retry && <Th>Aksi</Th>}
        </tr>
      </thead>
      <tbody>
        {campaigns.length ? (
          campaigns.map((c: Campaign) => (
            <tr key={c.id} className="border-b">
              <Td>
                <b>{c.name}</b>
                <p className="max-w-xs truncate text-xs text-slate-500">
                  {c.subject}
                </p>
              </Td>
              <Td>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                  {c.status}
                </span>
              </Td>
              <Td>
                {c.sent_count}/{c.total_count}
                {c.failed_count > 0 && (
                  <span className="ml-1 text-red-600">
                    ({c.failed_count} gagal)
                  </span>
                )}
              </Td>
              <Td>
                {c.scheduled_at
                  ? new Date(c.scheduled_at).toLocaleString("id-ID")
                  : "Langsung"}
              </Td>
              {retry && (
                <Td>
                  {c.failed_count > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retry(c.id)}
                    >
                      Coba Lagi
                    </Button>
                  )}
                </Td>
              )}
            </tr>
          ))
        ) : (
          <tr>
            <Td>Belum ada kampanye.</Td>
          </tr>
        )}
      </tbody>
    </table>
    </div>
  );
}
function PageHeading({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur sm:p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
        {icon}
      </span>
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: any;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
          {icon}
        </span>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
function NoticeBox({ notice }: { notice: Notice }) {
  return (
    <div
      className={`flex gap-3 rounded-xl border p-4 text-sm ${notice.success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}
    >
      {notice.success ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}
      <p>{notice.message}</p>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Center({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      {children}
    </div>
  );
}
function Th({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}
function Td({ children }: { children?: ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
