"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  IconFileTypePdf,
  IconFileSpreadsheet,
  IconSearch,
  IconUserCheck,
  IconUserX,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type RosterRow = {
  student_id: string;
  code: string | null;
  nom: string | null;
  prenom: string | null;
  section: string | null;
  status: "present" | "absent" | "late" | "excused";
  qr_scanned: boolean;
  marked_at: string | null;
};

export type SessionMeta = {
  id: string;
  courseCode: string;
  courseName: string | null;
  section: string;
  date: string;
  periodLabel: string;
  teacherName: string;
  room: string | null;
  isTP: boolean;
  eventLabels: string[];
  qrToken: string | null;
  deepLinkBase: string;
};

const ROSTER_POLL_MS = 4_000;

export function SessionLiveView({
  meta,
  initialRoster,
}: {
  meta: SessionMeta;
  initialRoster: RosterRow[];
}) {
  const [roster, setRoster] = useState<RosterRow[]>(initialRoster);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [search, setSearch] = useState("");

  const present = roster.filter((r) => r.status !== "absent").length;
  const absent = roster.length - present;

  // ── Render the fixed QR image once on mount ─────────────────────────
  useEffect(() => {
    if (!meta.qrToken) return;
    const qrContent = `${meta.deepLinkBase}${meta.qrToken}`;
    QRCode.toDataURL(qrContent, { width: 320, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [meta.qrToken, meta.deepLinkBase]);

  // ── Poll roster for live present/absent updates ─────────────────────
  const loadRoster = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${meta.id}/roster`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data?.success) setRoster(data.roster as RosterRow[]);
    } catch {
      /* ignore transient errors */
    }
  }, [meta.id]);

  useEffect(() => {
    const interval = setInterval(loadRoster, ROSTER_POLL_MS);
    return () => clearInterval(interval);
  }, [loadRoster]);

  // ── Manual toggle present/absent ────────────────────────────────────
  async function setStatus(studentId: string, status: RosterRow["status"]) {
    setRoster((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, status } : r)),
    );
    await fetch(`/api/sessions/${meta.id}/roster`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, status }),
    });
  }

  const filtered = roster.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.code ?? "").toLowerCase().includes(q) ||
      (r.nom ?? "").toLowerCase().includes(q) ||
      (r.prenom ?? "").toLowerCase().includes(q)
    );
  });

  const headerLine = [
    "ENSAM-Meknes",
    meta.courseName || meta.courseCode,
    meta.section,
    `Prof: ${meta.teacherName}`,
    `Date: ${meta.date}`,
    `Créneau: ${meta.periodLabel}`,
    meta.room ? `S: ${meta.room}` : null,
  ]
    .filter(Boolean)
    .join("  |  ");

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,oklch(0.45_0.12_255),oklch(0.55_0.14_265))] text-white shadow-lg">
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-widest text-white/70">
              Maintenance par l&apos;IA — séance en direct
            </p>
            <h2 className="text-2xl font-bold">
              {meta.courseName || meta.courseCode}
            </h2>
            <p className="text-sm text-white/80">{headerLine}</p>
          </div>
          <div className="flex gap-3">
            <Stat label="Total" value={roster.length} tone="neutral" />
            <Stat label="Présents" value={present} tone="success" />
            <Stat label="Absents" value={absent} tone="danger" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* QR panel */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Code QR de présence</CardTitle>
            <CardDescription>
              Les étudiants scannent ce code pour marquer leur présence.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border bg-white p-3 shadow-sm">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR code" width={260} height={260} />
              ) : (
                <div className="flex size-[260px] items-center justify-center text-sm text-muted-foreground">
                  Génération du QR…
                </div>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Code fixe — valide pendant toute la séance
            </p>
          </CardContent>
        </Card>

        {/* Roster table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">
                  Liste des étudiants
                </CardTitle>
                <CardDescription>
                  Présence en temps réel — {present}/{roster.length} présents.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => exportCsv(meta, roster)}
                  className="gap-1.5"
                >
                  <IconFileSpreadsheet className="size-4" />
                  Excel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => exportPdf(meta, roster)}
                  className="gap-1.5"
                >
                  <IconFileTypePdf className="size-4" />
                  PDF
                </Button>
              </div>
            </div>

            <div className="relative mt-2">
              <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par code, nom ou prénom…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Code Étu</th>
                    <th className="px-4 py-3 font-semibold">Nom</th>
                    <th className="px-4 py-3 font-semibold">Prénom</th>
                    <th className="px-4 py-3 text-center font-semibold">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        Aucun étudiant inscrit à ce cours pour cette section.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => (
                      <tr
                        key={r.student_id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs">
                          {r.code ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 font-medium uppercase">
                          {r.nom ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">{r.prenom ?? "—"}</td>
                        <td className="px-4 py-2.5 text-center">
                          {r.status === "absent" ? (
                            <Badge
                              variant="outline"
                              className="border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
                            >
                              Absent
                            </Badge>
                          ) : (
                            <Badge className="border-0 bg-emerald-500/90 text-white">
                              {r.qr_scanned ? "Présent (QR)" : "Présent"}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                              onClick={() => setStatus(r.student_id, "present")}
                              title="Marquer présent"
                            >
                              <IconUserCheck className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                              onClick={() => setStatus(r.student_id, "absent")}
                              title="Marquer absent"
                            >
                              <IconUserX className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-200"
      : tone === "danger"
        ? "text-red-200"
        : "text-white";
  return (
    <div className="rounded-xl bg-white/10 px-4 py-2 text-center backdrop-blur">
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-white/70">
        {label}
      </p>
    </div>
  );
}

// ── Exports (dependency-free) ─────────────────────────────────────────

function fileBase(meta: SessionMeta) {
  return `presence_${meta.courseCode}_${meta.section}_${meta.date}`.replace(
    /\s+/g,
    "",
  );
}

function exportCsv(meta: SessionMeta, roster: RosterRow[]) {
  const header = [
    "Code Etu",
    "Nom",
    "Prenom",
    "Section",
    "Statut",
    "Scan QR",
    "Heure",
  ];
  const lines = roster.map((r) =>
    [
      r.code ?? "",
      r.nom ?? "",
      r.prenom ?? "",
      r.section ?? "",
      r.status === "absent" ? "Absent" : "Present",
      r.qr_scanned ? "Oui" : "Non",
      r.marked_at ? new Date(r.marked_at).toLocaleString("fr-FR") : "",
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(";"),
  );
  // BOM so Excel reads UTF-8 accents correctly
  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${fileBase(meta)}.csv`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPdf(meta: SessionMeta, roster: RosterRow[]) {
  const present = roster.filter((r) => r.status !== "absent").length;
  const rows = roster
    .map(
      (r, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="mono">${escapeHtml(r.code)}</td>
        <td class="up">${escapeHtml(r.nom)}</td>
        <td>${escapeHtml(r.prenom)}</td>
        <td class="status ${r.status === "absent" ? "abs" : "pre"}">${
          r.status === "absent" ? "Absent" : "Présent"
        }</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <title>${escapeHtml(fileBase(meta))}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 32px; }
    .head { border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 6px; }
    .head h1 { font-size: 16px; margin: 0 0 4px; color: #1e3a8a; }
    .meta { font-size: 12px; color: #334155; }
    .meta b { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #1e3a8a; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    td.num { width: 36px; text-align: center; color: #64748b; }
    td.mono { font-family: 'Courier New', monospace; }
    td.up { text-transform: uppercase; font-weight: 600; }
    td.status { text-align: center; font-weight: 600; }
    td.status.pre { color: #059669; }
    td.status.abs { color: #dc2626; }
    tr:nth-child(even) td { background: #f8fafc; }
    .foot { margin-top: 20px; display: flex; justify-content: space-between; font-size: 12px; }
    .sign { margin-top: 36px; border-top: 1px solid #94a3b8; width: 220px; padding-top: 4px; color: #64748b; }
    @media print { body { margin: 12mm; } }
  </style></head><body>
    <div class="head">
      <h1>ENSAM-Meknes &nbsp;|&nbsp; ${escapeHtml(meta.courseName || meta.courseCode)} &nbsp;|&nbsp; ${escapeHtml(meta.section)}</h1>
      <div class="meta">
        <b>Prof:</b> ${escapeHtml(meta.teacherName)} &nbsp;&nbsp;
        <b>Date:</b> ${escapeHtml(meta.date)} &nbsp;&nbsp;
        <b>Créneau:</b> ${escapeHtml(meta.periodLabel)}
        ${meta.room ? `&nbsp;&nbsp; <b>S:</b> ${escapeHtml(meta.room)}` : ""}
        &nbsp;&nbsp; <b>Type:</b> ${meta.isTP ? "TP" : "Cours"}
      </div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Code Étu</th><th>Nom</th><th>Prénom</th><th>Présence</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="foot">
      <div class="sign">Prof: ${escapeHtml(meta.teacherName)} — Signature</div>
      <div><b>Total:</b> ${roster.length} &nbsp;&nbsp; <b>Présents:</b> ${present} &nbsp;&nbsp; <b>Absents:</b> ${roster.length - present}</div>
    </div>
    <script>window.onload = () => { window.print(); };</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Veuillez autoriser les pop-ups pour exporter le PDF.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
