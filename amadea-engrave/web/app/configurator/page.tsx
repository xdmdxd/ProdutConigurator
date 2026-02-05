"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Stage,
    Layer,
    Rect,
    Circle,
    Line,
    Text,
    Transformer,
    Path,
    Image as KonvaImage,
} from "react-konva";
import Konva from "konva";
import { v4 as uuid } from "uuid";

/** UI jen pro práci v px, export bude v mm */
const MM_TO_PX = 4;

const PRODUCT = {
    code: "PRKENKO_01",
    canvasMm: { w: 300, h: 200 },
    engraveMm: { x: 70, y: 40, w: 160, h: 90, margin: 5 },
    minFontMm: 3,
    maxFontMm: 40,
};

type BaseItem = {
    id: string;
    x: number;
    y: number;
    rotation?: number;
    stroke?: string;
    strokeWidthMm?: number;
};

type TextItem = BaseItem & {
    type: "text";
    text: string;
    fontFamily: string;
    fontSizeMm: number;
    fontStyle: "normal" | "bold" | "italic" | "bold italic";
    align: "left" | "center" | "right";
    fill?: string;
};

type RectItem = BaseItem & {
    type: "rect";
    w: number;
    h: number;
    fillEnabled: boolean;
    fill?: string;
};

type CircleItem = BaseItem & {
    type: "circle";
    r: number;
    fillEnabled: boolean;
    fill?: string;
};

type LineItem = BaseItem & {
    type: "line";
    x2: number;
    y2: number;
};

type OrnamentKind = "heart" | "wreath" | "star";
type OrnamentItem = BaseItem & {
    type: "ornament";
    kind: OrnamentKind;
    scaleMm: number;
};

type Item = TextItem | RectItem | CircleItem | LineItem | OrnamentItem;

const BLACK = "#000000";

/**
 * Fonty v selectu.
 * - System fonty fungují hned.
 * - Google fonty (Inter/Roboto/Montserrat/Playfair/Lobster/Pacifico/Dancing/Great Vibes)
 *   se načtou přes web/app/layout.tsx (next/font/google) a mapují se přes fontCss().
 */
const FONTS = [
    // system
    { id: "Arial", label: "Arial" },
    { id: "Helvetica", label: "Helvetica" },
    { id: "Verdana", label: "Verdana" },
    { id: "Tahoma", label: "Tahoma" },
    { id: "Georgia", label: "Georgia (serif)" },
    { id: "Times New Roman", label: "Times New Roman" },
    { id: "Palatino Linotype", label: "Palatino" },
    { id: "Courier New", label: "Courier New (mono)" },
    { id: "Consolas", label: "Consolas (mono)" },

    // google (načítá layout)
    { id: "Inter", label: "Inter (moderní)" },
    { id: "Roboto", label: "Roboto" },
    { id: "Montserrat", label: "Montserrat" },
    { id: "Playfair Display", label: "Playfair Display (elegantní serif)" },
    { id: "Lobster", label: "Lobster (script)" },
    { id: "Pacifico", label: "Pacifico (script)" },
    { id: "Dancing Script", label: "Dancing Script (script)" },
    { id: "Great Vibes", label: "Great Vibes (svatební)" },
];

function fontCss(name: string) {
    // mapování na CSS variables z layout.tsx (next/font/google)
    switch (name) {
        case "Inter":
            return "var(--font-inter), Inter, Arial, sans-serif";
        case "Roboto":
            return "var(--font-roboto), Roboto, Arial, sans-serif";
        case "Montserrat":
            return "var(--font-montserrat), Montserrat, Arial, sans-serif";
        case "Playfair Display":
            return "var(--font-playfair), 'Playfair Display', Georgia, serif";
        case "Lobster":
            return "var(--font-lobster), Lobster, cursive";
        case "Pacifico":
            return "var(--font-pacifico), Pacifico, cursive";
        case "Dancing Script":
            return "var(--font-dancing), 'Dancing Script', cursive";
        case "Great Vibes":
            return "var(--font-greatvibes), 'Great Vibes', cursive";
        default:
            // systémové fonty + fallback
            if (name === "Georgia" || name === "Times New Roman" || name === "Palatino Linotype") {
                return `${name}, Georgia, "Times New Roman", serif`;
            }
            if (name === "Courier New" || name === "Consolas") {
                return `${name}, "Courier New", monospace`;
            }
            return `${name}, Arial, sans-serif`;
    }
}

const ORNAMENTS: { kind: OrnamentKind; label: string; path: string }[] = [
    {
        kind: "heart",
        label: "Srdce",
        path: "M 10 30 C 10 10 30 10 30 20 C 30 10 50 10 50 30 C 50 45 30 55 30 55 C 30 55 10 45 10 30 Z",
    },
    {
        kind: "wreath",
        label: "Věnec",
        path: "M 50 30 A 20 20 0 1 1 49.9 30 Z M 50 30 A 12 12 0 1 0 49.9 30 Z",
    },
    {
        kind: "star",
        label: "Hvězda",
        path: "M 30 5 L 37 22 L 55 22 L 40 33 L 46 50 L 30 40 L 14 50 L 20 33 L 5 22 L 23 22 Z",
    },
];

/** Pozadí z /public/bg */
const BACKGROUNDS = [
    { id: "none", label: "Bez pozadí", url: "" },
    { id: "ozdobicka", label: "Ozdobička", url: "/bg/ozdobicka.jpg" },
    { id: "srdce", label: "Srdce", url: "/bg/srdce.jpg" },
];

function mm(v: number) {
    return v * MM_TO_PX;
}
function pxToMm(v: number) {
    return v / MM_TO_PX;
}
function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}
function escapeXml(s: string) {
    return s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

/** Hook pro načtení obrázku (pro KonvaImage) */
function useHtmlImage(src: string) {
    const [image, setImage] = useState<HTMLImageElement | null>(null);

    useEffect(() => {
        if (!src) {
            setImage(null);
            return;
        }
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => setImage(img);
        img.src = src;
    }, [src]);

    return image;
}

/** Background fit: COVER (bez deformace, může oříznout) */
function fitCover(imgW: number, imgH: number, boxW: number, boxH: number) {
    const s = Math.max(boxW / imgW, boxH / imgH);
    const w = imgW * s;
    const h = imgH * s;
    return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

export default function ConfiguratorPage() {
    const stageRef = useRef<Konva.Stage>(null);
    const trRef = useRef<Konva.Transformer>(null);

    // ===== UI theme =====
    const COLORS = {
        text: "#111827",
        muted: "#374151",
        border: "#e5e7eb",
        panel: "#ffffff",
        bg: "#f8fafc",
        primary: "#1f86ff",
        danger: "#ef4444",
    };

    const panelStyle: React.CSSProperties = {
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: 14,
        background: COLORS.panel,
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
    };

    const sectionTitle: React.CSSProperties = {
        background: COLORS.primary,
        color: "white",
        padding: "8px 12px",
        borderRadius: 12,
        fontWeight: 900,
        fontSize: 14,
        display: "inline-block",
        marginBottom: 10,
    };

    const labelStyle: React.CSSProperties = {
        fontSize: 13,
        fontWeight: 800,
        color: COLORS.text,
    };

    const helpStyle: React.CSSProperties = {
        fontSize: 12,
        color: COLORS.muted,
        lineHeight: 1.35,
    };

    function btnBase(disabled?: boolean): React.CSSProperties {
        return {
            borderRadius: 12,
            padding: "10px 12px",
            border: `1px solid ${COLORS.border}`,
            background: "#fff",
            color: disabled ? "#6b7280" : COLORS.text,
            cursor: disabled ? "not-allowed" : "pointer",
            fontWeight: 900,
            fontSize: 13,
            opacity: disabled ? 0.7 : 1,
        };
    }

    const btnPrimary: React.CSSProperties = {
        borderRadius: 12,
        padding: "10px 12px",
        border: `1px solid ${COLORS.primary}`,
        background: COLORS.primary,
        color: "white",
        cursor: "pointer",
        fontWeight: 900,
        fontSize: 13,
    };

    const btnDanger: React.CSSProperties = {
        ...btnBase(false),
        border: `1px solid ${COLORS.danger}`,
        color: COLORS.danger,
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: 10,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        outline: "none",
        color: COLORS.text,
        background: "#fff",
    };

    // ===== Background state =====
    const [bgId, setBgId] = useState<string>("none");
    const [bgDataUrl, setBgDataUrl] = useState<string>(""); // upload vlastního

    const bgUrl = useMemo(() => {
        if (bgDataUrl) return bgDataUrl;
        return BACKGROUNDS.find((b) => b.id === bgId)?.url ?? "";
    }, [bgId, bgDataUrl]);

    const bgImg = useHtmlImage(bgUrl);

    const canvasPx = useMemo(
        () => ({ w: mm(PRODUCT.canvasMm.w), h: mm(PRODUCT.canvasMm.h) }),
        []
    );

    // ===== Items =====
    const [items, setItems] = useState<Item[]>([
        {
            id: uuid(),
            type: "text",
            text: "Lenka & Tomáš",
            x: PRODUCT.engraveMm.x + 10,
            y: PRODUCT.engraveMm.y + 25,
            fontFamily: "Playfair Display",
            fontSizeMm: 12,
            fontStyle: "bold",
            align: "left",
            fill: BLACK,
            stroke: undefined,
            strokeWidthMm: 0,
        },
    ]);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selected = useMemo(
        () => items.find((i) => i.id === selectedId) ?? null,
        [items, selectedId]
    );

    // ===== Transformer attach =====
    useEffect(() => {
        const stage = stageRef.current;
        const tr = trRef.current;
        if (!stage || !tr) return;

        if (!selectedId) {
            tr.nodes([]);
            tr.getLayer()?.batchDraw();
            return;
        }

        const node = stage.findOne(`#${selectedId}`);
        if (node) {
            tr.nodes([node as any]);
            tr.getLayer()?.batchDraw();
        } else {
            tr.nodes([]);
            tr.getLayer()?.batchDraw();
        }
    }, [selectedId, items]);

    function select(id: string | null) {
        setSelectedId(id);
    }

    function withinEngraveArea(it: Item): boolean {
        const a = PRODUCT.engraveMm;
        const ax1 = a.x + a.margin;
        const ay1 = a.y + a.margin;
        const ax2 = a.x + a.w - a.margin;
        const ay2 = a.y + a.h - a.margin;

        if (it.type === "text") return it.x >= ax1 && it.y >= ay1 && it.x <= ax2 && it.y <= ay2;
        if (it.type === "rect") return it.x >= ax1 && it.y >= ay1 && it.x + it.w <= ax2 && it.y + it.h <= ay2;
        if (it.type === "circle") return it.x - it.r >= ax1 && it.y - it.r >= ay1 && it.x + it.r <= ax2 && it.y + it.r <= ay2;

        if (it.type === "line") {
            const minX = Math.min(it.x, it.x2);
            const maxX = Math.max(it.x, it.x2);
            const minY = Math.min(it.y, it.y2);
            const maxY = Math.max(it.y, it.y2);
            return minX >= ax1 && minY >= ay1 && maxX <= ax2 && maxY <= ay2;
        }

        if (it.type === "ornament") {
            const size = it.scaleMm;
            return it.x >= ax1 && it.y >= ay1 && it.x + size <= ax2 && it.y + size <= ay2;
        }
        return true;
    }

    function addText() {
        const id = uuid();
        const it: TextItem = {
            id,
            type: "text",
            text: "Napište vlastní text",
            x: PRODUCT.engraveMm.x + PRODUCT.engraveMm.margin + 5,
            y: PRODUCT.engraveMm.y + PRODUCT.engraveMm.margin + 15,
            fontFamily: "Inter",
            fontSizeMm: 10,
            fontStyle: "normal",
            align: "left",
            fill: BLACK,
            stroke: undefined,
            strokeWidthMm: 0,
        };
        setItems((p) => [...p, it]);
        select(id);
    }

    function addRect() {
        const id = uuid();
        const it: RectItem = {
            id,
            type: "rect",
            x: PRODUCT.engraveMm.x + 10,
            y: PRODUCT.engraveMm.y + 10,
            w: 40,
            h: 20,
            stroke: BLACK,
            strokeWidthMm: 0.4,
            fillEnabled: false,
            fill: BLACK,
        };
        setItems((p) => [...p, it]);
        select(id);
    }

    function addCircle() {
        const id = uuid();
        const it: CircleItem = {
            id,
            type: "circle",
            x: PRODUCT.engraveMm.x + 30,
            y: PRODUCT.engraveMm.y + 30,
            r: 12,
            stroke: BLACK,
            strokeWidthMm: 0.4,
            fillEnabled: false,
            fill: BLACK,
        };
        setItems((p) => [...p, it]);
        select(id);
    }

    function addLine() {
        const id = uuid();
        const it: LineItem = {
            id,
            type: "line",
            x: PRODUCT.engraveMm.x + 10,
            y: PRODUCT.engraveMm.y + 60,
            x2: PRODUCT.engraveMm.x + 90,
            y2: PRODUCT.engraveMm.y + 60,
            stroke: BLACK,
            strokeWidthMm: 0.6,
        };
        setItems((p) => [...p, it]);
        select(id);
    }

    function addOrnament(kind: OrnamentKind) {
        const id = uuid();
        const it: OrnamentItem = {
            id,
            type: "ornament",
            kind,
            x: PRODUCT.engraveMm.x + 10,
            y: PRODUCT.engraveMm.y + 10,
            scaleMm: 25,
            stroke: BLACK,
            strokeWidthMm: 0.4,
        };
        setItems((p) => [...p, it]);
        select(id);
    }

    function deleteSelected() {
        if (!selectedId) return;
        setItems((p) => p.filter((i) => i.id !== selectedId));
        select(null);
    }

    function duplicateSelected() {
        if (!selected) return;
        const copy = { ...selected, id: uuid(), x: selected.x + 5, y: selected.y + 5 } as Item;
        setItems((p) => [...p, copy]);
        select(copy.id);
    }

    function moveSelected(dir: "front" | "back") {
        if (!selectedId) return;
        setItems((p) => {
            const idx = p.findIndex((i) => i.id === selectedId);
            if (idx < 0) return p;
            const arr = [...p];
            const [it] = arr.splice(idx, 1);
            if (dir === "front") arr.push(it);
            else arr.unshift(it);
            return arr;
        });
    }

    function updateSelected(patch: Partial<Item>) {
        if (!selectedId) return;
        setItems((prev) => prev.map((it) => (it.id === selectedId ? ({ ...it, ...patch } as Item) : it)));
    }

    function validateAll(): { ok: boolean; problems: string[] } {
        const probs: string[] = [];
        for (const it of items) {
            if (!withinEngraveArea(it)) probs.push(`Prvek mimo gravírovací plochu (typ=${it.type}).`);
            if (it.type === "text" && it.fontSizeMm < PRODUCT.minFontMm)
                probs.push(`Text je příliš malý (min ${PRODUCT.minFontMm} mm).`);
        }
        return { ok: probs.length === 0, problems: probs };
    }

    function exportSvgMm(): string {
        const parts: string[] = [];

        for (const it of items) {
            const stroke = it.stroke ?? BLACK;
            const sw = (it.strokeWidthMm ?? 0) > 0 ? ` stroke="${stroke}" stroke-width="${it.strokeWidthMm}"` : "";
            const rot = it.rotation ? ` transform="rotate(${it.rotation} ${it.x} ${it.y})"` : "";

            if (it.type === "text") {
                const fill = ` fill="${it.fill ?? BLACK}"`;
                parts.push(
                    `<text x="${it.x}" y="${it.y}" font-family="${escapeXml(it.fontFamily)}" font-size="${it.fontSizeMm}" font-style="${
                        it.fontStyle.includes("italic") ? "italic" : "normal"
                    }" font-weight="${it.fontStyle.includes("bold") ? "bold" : "normal"}" text-anchor="${
                        it.align === "left" ? "start" : it.align === "center" ? "middle" : "end"
                    }"${fill}${sw}${rot}>${escapeXml(it.text)}</text>`
                );
            }

            if (it.type === "rect") {
                const fill = it.fillEnabled ? ` fill="${it.fill ?? BLACK}"` : ` fill="none"`;
                parts.push(`<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}"${fill}${sw}${rot} />`);
            }

            if (it.type === "circle") {
                const fill = it.fillEnabled ? ` fill="${it.fill ?? BLACK}"` : ` fill="none"`;
                parts.push(`<circle cx="${it.x}" cy="${it.y}" r="${it.r}"${fill}${sw} />`);
            }

            if (it.type === "line") {
                parts.push(`<line x1="${it.x}" y1="${it.y}" x2="${it.x2}" y2="${it.y2}"${sw} />`);
            }

            if (it.type === "ornament") {
                const def = ORNAMENTS.find((o) => o.kind === it.kind)!;
                const scale = it.scaleMm / 60;
                parts.push(`<path d="${def.path}" fill="none"${sw} transform="translate(${it.x} ${it.y}) scale(${scale})" />`);
            }
        }

        return `
<svg xmlns="http://www.w3.org/2000/svg"
  width="${PRODUCT.canvasMm.w}mm"
  height="${PRODUCT.canvasMm.h}mm"
  viewBox="0 0 ${PRODUCT.canvasMm.w} ${PRODUCT.canvasMm.h}">
  ${parts.join("\n  ")}
</svg>`.trim();
    }

    function handleExport() {
        const v = validateAll();
        if (!v.ok) {
            alert("Nejde exportovat:\n- " + v.problems.join("\n- "));
            return;
        }
        const svg = exportSvgMm();
        console.log(svg);
        alert("SVG vygenerováno – koukni do Console (F12).");
    }

    function commitTransform(node: Konva.Node) {
        const id = node.id();
        const item = items.find((i) => i.id === id);
        if (!item) return;

        const sX = node.scaleX();
        const sY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);

        if (item.type === "rect") {
            updateSelected({ w: clamp(item.w * sX, 1, 500), h: clamp(item.h * sY, 1, 500) } as any);
            return;
        }
        if (item.type === "circle") {
            updateSelected({ r: clamp(item.r * Math.max(sX, sY), 1, 500) } as any);
            return;
        }
        if (item.type === "text") {
            updateSelected({
                fontSizeMm: clamp(item.fontSizeMm * Math.max(sX, sY), PRODUCT.minFontMm, PRODUCT.maxFontMm),
            } as any);
            return;
        }
        if (item.type === "ornament") {
            updateSelected({ scaleMm: clamp(item.scaleMm * Math.max(sX, sY), 5, 120) } as any);
            return;
        }
    }

    async function handleBgUpload(file: File) {
        const reader = new FileReader();
        reader.onload = () => {
            setBgDataUrl(String(reader.result || ""));
            setBgId("none");
        };
        reader.readAsDataURL(file);
    }

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "520px 1fr",
                gap: 16,
                padding: 16,
                fontFamily: "system-ui, Arial",
                background: COLORS.bg,
                minHeight: "100vh",
                color: COLORS.text,
            }}
        >
            {/* LEFT */}
            <div style={{ display: "grid", gap: 12 }}>
                {/* BACKGROUND */}
                <div style={panelStyle}>
                    <div style={sectionTitle}>Vložte pozadí</div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {BACKGROUNDS.map((b) => {
                            const active = (bgId === b.id) && !bgDataUrl;
                            return (
                                <button
                                    key={b.id}
                                    onClick={() => {
                                        setBgId(b.id);
                                        setBgDataUrl("");
                                    }}
                                    style={{
                                        ...btnBase(false),
                                        width: 160,
                                        border: active ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
                                        textAlign: "left",
                                    }}
                                >
                                    <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8, color: COLORS.text }}>
                                        {b.label}
                                    </div>
                                    <div
                                        style={{
                                            width: "100%",
                                            height: 70,
                                            borderRadius: 12,
                                            border: `1px solid ${COLORS.border}`,
                                            background: b.url ? `url(${b.url}) center/cover` : "#f3f4f6",
                                        }}
                                    />
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                        <label style={labelStyle}>
                            Vlastní obrázek:
                            <input
                                style={{ marginTop: 6 }}
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleBgUpload(f);
                                }}
                            />
                        </label>

                        {bgDataUrl && (
                            <button onClick={() => setBgDataUrl("")} style={btnBase(false)}>
                                Zrušit vlastní pozadí
                            </button>
                        )}

                        <div style={helpStyle}>
                            Pozadí je jen pro náhled. Export SVG obsahuje pouze gravírování (text/tvary/ozdoby).
                        </div>
                    </div>
                </div>

                {/* ADD ELEMENTS */}
                <div style={panelStyle}>
                    <div style={sectionTitle}>Přidat prvky</div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button style={btnPrimary} onClick={addText}>+ Text</button>
                        <button style={btnPrimary} onClick={addRect}>+ Obdélník</button>
                        <button style={btnPrimary} onClick={addCircle}>+ Kruh</button>
                        <button style={btnPrimary} onClick={addLine}>+ Linka</button>
                    </div>

                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {ORNAMENTS.map((o) => (
                            <button key={o.kind} style={btnBase(false)} onClick={() => addOrnament(o.kind)}>
                                + {o.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button style={btnBase(!selected)} onClick={duplicateSelected} disabled={!selected}>Duplikovat</button>
                        <button style={selected ? btnDanger : btnBase(true)} onClick={deleteSelected} disabled={!selected}>Smazat</button>
                        <button style={btnBase(!selected)} onClick={() => moveSelected("back")} disabled={!selected}>Dozadu</button>
                        <button style={btnBase(!selected)} onClick={() => moveSelected("front")} disabled={!selected}>Dopředu</button>
                    </div>

                    <div style={{ marginTop: 10, ...helpStyle }}>
                        Tip: klikni na prvek v náhledu → objeví se úpravy. Tažením měníš pozici, rohy mění velikost, rotace je povolena.
                    </div>
                </div>

                {/* EDIT SELECTED */}
                <div style={panelStyle}>
                    <div style={sectionTitle}>Upravit vybraný prvek</div>

                    {!selected && <div style={helpStyle}>Klikni na prvek v náhledu vpravo.</div>}

                    {selected?.type === "text" && (
                        <div style={{ display: "grid", gap: 10 }}>
                            <label style={labelStyle}>
                                Text:
                                <input
                                    style={{ ...inputStyle, marginTop: 6 }}
                                    value={selected.text}
                                    onChange={(e) => updateSelected({ text: e.target.value } as any)}
                                />
                            </label>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <label style={labelStyle}>
                                    Písmo:
                                    <select
                                        style={{ ...inputStyle, marginTop: 6 }}
                                        value={selected.fontFamily}
                                        onChange={(e) => updateSelected({ fontFamily: e.target.value } as any)}
                                    >
                                        {FONTS.map((f) => (
                                            <option key={f.id} value={f.id}>
                                                {f.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label style={labelStyle}>
                                    Velikost (mm):
                                    <input
                                        type="number"
                                        style={{ ...inputStyle, marginTop: 6 }}
                                        value={selected.fontSizeMm}
                                        min={PRODUCT.minFontMm}
                                        max={PRODUCT.maxFontMm}
                                        onChange={(e) =>
                                            updateSelected({
                                                fontSizeMm: clamp(Number(e.target.value), PRODUCT.minFontMm, PRODUCT.maxFontMm),
                                            } as any)
                                        }
                                    />
                                </label>
                            </div>

                            <label style={labelStyle}>
                                Barva textu:
                                <input
                                    type="color"
                                    value={(selected.fill && selected.fill.trim()) ? selected.fill : BLACK}
                                    onChange={(e) => updateSelected({ fill: e.target.value } as any)}
                                    style={{
                                        marginTop: 6,
                                        width: 80,
                                        height: 40,
                                        padding: 0,
                                        border: `1px solid ${COLORS.border}`,
                                        borderRadius: 10,
                                        background: "#fff",
                                    }}
                                />
                            </label>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                    style={btnBase(false)}
                                    onClick={() =>
                                        updateSelected({
                                            fontStyle: selected.fontStyle.includes("bold")
                                                ? (selected.fontStyle.includes("italic") ? "italic" : "normal")
                                                : (selected.fontStyle.includes("italic") ? "bold italic" : "bold"),
                                        } as any)
                                    }
                                >
                                    Tučné
                                </button>

                                <button
                                    style={btnBase(false)}
                                    onClick={() =>
                                        updateSelected({
                                            fontStyle: selected.fontStyle.includes("italic")
                                                ? (selected.fontStyle.includes("bold") ? "bold" : "normal")
                                                : (selected.fontStyle.includes("bold") ? "bold italic" : "italic"),
                                        } as any)
                                    }
                                >
                                    Kurzíva
                                </button>

                                <button style={btnBase(false)} onClick={() => updateSelected({ align: "left" } as any)}>Vlevo</button>
                                <button style={btnBase(false)} onClick={() => updateSelected({ align: "center" } as any)}>Na střed</button>
                                <button style={btnBase(false)} onClick={() => updateSelected({ align: "right" } as any)}>Vpravo</button>
                            </div>
                        </div>
                    )}

                    {(selected?.type === "rect" || selected?.type === "circle") && (
                        <div style={{ display: "grid", gap: 10 }}>
                            <label style={labelStyle}>
                                Barva čáry:
                                <input
                                    type="color"
                                    value={selected.stroke ?? BLACK}
                                    onChange={(e) => updateSelected({ stroke: e.target.value } as any)}
                                    style={{ marginTop: 6, width: 80, height: 40, padding: 0, border: `1px solid ${COLORS.border}`, borderRadius: 10 }}
                                />
                            </label>

                            <label style={labelStyle}>
                                Tloušťka čáry (mm):
                                <input
                                    type="number"
                                    style={{ ...inputStyle, marginTop: 6 }}
                                    value={selected.strokeWidthMm ?? 0.4}
                                    min={0}
                                    max={5}
                                    step={0.1}
                                    onChange={(e) => updateSelected({ strokeWidthMm: clamp(Number(e.target.value), 0, 5) } as any)}
                                />
                            </label>

                            <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 10 }}>
                                <input
                                    type="checkbox"
                                    checked={selected.fillEnabled}
                                    onChange={(e) => updateSelected({ fillEnabled: e.target.checked } as any)}
                                />
                                Vyplnit (fill)
                            </label>

                            {selected.fillEnabled && (
                                <label style={labelStyle}>
                                    Barva výplně:
                                    <input
                                        type="color"
                                        value={selected.fill ?? BLACK}
                                        onChange={(e) => updateSelected({ fill: e.target.value } as any)}
                                        style={{ marginTop: 6, width: 80, height: 40, padding: 0, border: `1px solid ${COLORS.border}`, borderRadius: 10 }}
                                    />
                                </label>
                            )}
                        </div>
                    )}

                    {selected?.type === "line" && (
                        <div style={{ display: "grid", gap: 10 }}>
                            <label style={labelStyle}>
                                Barva čáry:
                                <input
                                    type="color"
                                    value={selected.stroke ?? BLACK}
                                    onChange={(e) => updateSelected({ stroke: e.target.value } as any)}
                                    style={{ marginTop: 6, width: 80, height: 40, padding: 0, border: `1px solid ${COLORS.border}`, borderRadius: 10 }}
                                />
                            </label>

                            <label style={labelStyle}>
                                Tloušťka čáry (mm):
                                <input
                                    type="number"
                                    style={{ ...inputStyle, marginTop: 6 }}
                                    value={selected.strokeWidthMm ?? 0.6}
                                    min={0.1}
                                    max={5}
                                    step={0.1}
                                    onChange={(e) => updateSelected({ strokeWidthMm: clamp(Number(e.target.value), 0.1, 5) } as any)}
                                />
                            </label>

                            <div style={helpStyle}>Linka se zatím táhne jako celek. Endpointy doplníme v dalším kroku.</div>
                        </div>
                    )}

                    {selected?.type === "ornament" && (
                        <div style={{ display: "grid", gap: 10 }}>
                            <label style={labelStyle}>
                                Velikost ozdoby (mm):
                                <input
                                    type="number"
                                    style={{ ...inputStyle, marginTop: 6 }}
                                    value={selected.scaleMm}
                                    min={5}
                                    max={120}
                                    onChange={(e) => updateSelected({ scaleMm: clamp(Number(e.target.value), 5, 120) } as any)}
                                />
                            </label>

                            <label style={labelStyle}>
                                Typ ozdoby:
                                <select
                                    style={{ ...inputStyle, marginTop: 6 }}
                                    value={selected.kind}
                                    onChange={(e) => updateSelected({ kind: e.target.value as OrnamentKind } as any)}
                                >
                                    {ORNAMENTS.map((o) => (
                                        <option key={o.kind} value={o.kind}>{o.label}</option>
                                    ))}
                                </select>
                            </label>

                            <label style={labelStyle}>
                                Barva čáry:
                                <input
                                    type="color"
                                    value={selected.stroke ?? BLACK}
                                    onChange={(e) => updateSelected({ stroke: e.target.value } as any)}
                                    style={{ marginTop: 6, width: 80, height: 40, padding: 0, border: `1px solid ${COLORS.border}`, borderRadius: 10 }}
                                />
                            </label>
                        </div>
                    )}
                </div>

                {/* EXPORT */}
                <div style={panelStyle}>
                    <div style={sectionTitle}>Export</div>
                    <button style={btnPrimary} onClick={handleExport}>Export SVG (mm)</button>
                    <div style={{ marginTop: 10, ...helpStyle }}>
                        Pozn.: Text je zatím v SVG jako &lt;text&gt;. Pro laser to často převedeme na křivky na backendu (další krok).
                    </div>
                </div>
            </div>

            {/* RIGHT */}
            <div style={{ ...panelStyle, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontWeight: 900, color: COLORS.text }}>Náhled</div>
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>
                        Gravírovací plocha: {PRODUCT.engraveMm.w}×{PRODUCT.engraveMm.h} mm
                    </div>
                </div>

                <Stage
                    ref={stageRef}
                    width={canvasPx.w}
                    height={canvasPx.h}
                    onMouseDown={(e) => {
                        if (e.target === e.target.getStage()) select(null);
                    }}
                    style={{ background: "#ffffff", borderRadius: 12 }}
                >
                    <Layer>
                        {/* Background */}
                        {bgImg && (() => {
                            const f = fitCover(bgImg.width, bgImg.height, canvasPx.w, canvasPx.h);
                            return (
                                <KonvaImage
                                    image={bgImg}
                                    x={f.x}
                                    y={f.y}
                                    width={f.w}
                                    height={f.h}
                                    listening={false}
                                />
                            );
                        })()}

                        {/* Engrave area */}
                        <Rect
                            x={mm(PRODUCT.engraveMm.x)}
                            y={mm(PRODUCT.engraveMm.y)}
                            width={mm(PRODUCT.engraveMm.w)}
                            height={mm(PRODUCT.engraveMm.h)}
                            stroke="#22c55e"
                            dash={[6, 4]}
                            listening={false}
                        />

                        {items.map((it) => {
                            const commonProps = {
                                id: it.id,
                                draggable: true,
                                onClick: () => select(it.id),
                                onTap: () => select(it.id),
                                onDragEnd: (e: any) => {
                                    const nx = pxToMm(e.target.x());
                                    const ny = pxToMm(e.target.y());
                                    setItems((p) =>
                                        p.map((x) => (x.id === it.id ? ({ ...x, x: nx, y: ny } as Item) : x))
                                    );
                                },
                            };

                            if (it.type === "text") {
                                return (
                                    <Text
                                        key={it.id}
                                        {...commonProps}
                                        text={it.text}
                                        x={mm(it.x)}
                                        y={mm(it.y)}
                                        fontSize={mm(it.fontSizeMm)}
                                        fontFamily={fontCss(it.fontFamily)}
                                        fontStyle={it.fontStyle}
                                        align={it.align}
                                        width={mm(160)}
                                        fill={(it.fill && it.fill.trim()) ? it.fill : BLACK}
                                        opacity={1}
                                        rotation={it.rotation ?? 0}
                                        onTransformEnd={(e) => commitTransform(e.target)}
                                    />
                                );
                            }

                            if (it.type === "rect") {
                                return (
                                    <Rect
                                        key={it.id}
                                        {...commonProps}
                                        x={mm(it.x)}
                                        y={mm(it.y)}
                                        width={mm(it.w)}
                                        height={mm(it.h)}
                                        stroke={it.stroke ?? BLACK}
                                        strokeWidth={mm(it.strokeWidthMm ?? 0.4)}
                                        fill={it.fillEnabled ? (it.fill ?? BLACK) : undefined}
                                        opacity={1}
                                        rotation={it.rotation ?? 0}
                                        onTransformEnd={(e) => commitTransform(e.target)}
                                    />
                                );
                            }

                            if (it.type === "circle") {
                                return (
                                    <Circle
                                        key={it.id}
                                        {...commonProps}
                                        x={mm(it.x)}
                                        y={mm(it.y)}
                                        radius={mm(it.r)}
                                        stroke={it.stroke ?? BLACK}
                                        strokeWidth={mm(it.strokeWidthMm ?? 0.4)}
                                        fill={it.fillEnabled ? (it.fill ?? BLACK) : undefined}
                                        opacity={1}
                                        onTransformEnd={(e) => commitTransform(e.target)}
                                    />
                                );
                            }

                            if (it.type === "line") {
                                return (
                                    <Line
                                        key={it.id}
                                        {...commonProps}
                                        x={0}
                                        y={0}
                                        points={[mm(it.x), mm(it.y), mm(it.x2), mm(it.y2)]}
                                        stroke={it.stroke ?? BLACK}
                                        strokeWidth={mm(it.strokeWidthMm ?? 0.6)}
                                        opacity={1}
                                    />
                                );
                            }

                            if (it.type === "ornament") {
                                const def = ORNAMENTS.find((o) => o.kind === it.kind)!;
                                const scale = it.scaleMm / 60;
                                return (
                                    <Path
                                        key={it.id}
                                        {...commonProps}
                                        data={def.path}
                                        x={mm(it.x)}
                                        y={mm(it.y)}
                                        scaleX={scale}
                                        scaleY={scale}
                                        stroke={it.stroke ?? BLACK}
                                        strokeWidth={mm(it.strokeWidthMm ?? 0.4)}
                                        fill={undefined}
                                        opacity={1}
                                        onTransformEnd={(e) => commitTransform(e.target)}
                                    />
                                );
                            }

                            return null;
                        })}

                        <Transformer
                            ref={trRef}
                            rotateEnabled={true}
                            boundBoxFunc={(oldBox, newBox) => {
                                if (newBox.width < 10 || newBox.height < 10) return oldBox;
                                return newBox;
                            }}
                        />
                    </Layer>
                </Stage>
            </div>
        </div>
    );
}
